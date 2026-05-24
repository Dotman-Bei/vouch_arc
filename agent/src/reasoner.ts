import Anthropic from "@anthropic-ai/sdk";
import { keccak256, toUtf8Bytes } from "ethers";
import { request } from "undici";
import { z } from "zod";
import { config } from "./config.js";
import type { AnalysisResult } from "./analyzer.js";

const TraceSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  verdict: z.enum(["follow", "watch", "avoid"]),
  confidence: z.number().min(0).max(1),
  slashRisk: z.enum(["low", "medium", "high"]),
});
export type Trace = z.infer<typeof TraceSchema>;

export interface ReasoningResult {
  leader: string;
  trace: Trace;
  traceJson: string;
  reasonHash: `0x${string}`;
  ipfsCid: string | null;
  generatedAt: string;
}

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const SYSTEM = `You are a quantitative trading analyst. Given a trader's performance metrics, produce a structured analysis. Treat reliability_score below 70, data_coverage_days below 14, or history_capped=true as major evidence risks. Strong raw returns from unreliable data must not justify "follow"; lean "avoid" with "high" slashRisk unless the history is broad, uncapped, and internally consistent. Respond ONLY in valid JSON with no preamble. Output schema: { "summary": string (2 sentences max), "strengths": string[], "risks": string[], "verdict": "follow" | "watch" | "avoid", "confidence": number (0-1), "slashRisk": "low" | "medium" | "high" }`;

async function llmTrace(a: AnalysisResult): Promise<Trace> {
  const userPayload = {
    sharpe_30d: a.sharpe30d,
    sortino_30d: a.sortino30d,
    max_drawdown: a.maxDrawdown,
    win_rate: a.winRate,
    profit_factor: a.profitFactor,
    return_24h_bps: a.return24hBps,
    return_7d_bps: a.return7dBps,
    degradation_score: a.degradationScore,
    fill_count: a.fillCount,
    data_coverage_days: Number(a.coverageDays.toFixed(2)),
    history_capped: a.historyCapped,
    reliability_score: a.reliabilityScore,
  };
  const msg = await anthropic.messages.create({
    model: config.ANTHROPIC_MODEL,
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(userPayload) }],
  });
  const text = msg.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("Anthropic response did not include text content");
  }
  const json = JSON.parse(extractJson(text.text));
  return TraceSchema.parse(json);
}

// The model is asked for bare JSON but sometimes wraps it in a ```json fence
// or adds preamble. Pull out the first complete JSON object regardless.
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in Anthropic response");
  }
  return body.slice(start, end + 1);
}

// Pin the reasoning trace to IPFS via Pinata. Returns the CID.
async function pinIpfs(trace: Trace): Promise<string> {
  const res = await request("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: trace,
      pinataMetadata: { name: `vouch-trace-${Date.now()}.json` },
    }),
  });
  if (res.statusCode >= 400) {
    throw new Error(`Pinata ${res.statusCode}: ${await res.body.text()}`);
  }
  const body = (await res.body.json()) as { IpfsHash: string };
  return body.IpfsHash;
}

export async function reason(a: AnalysisResult): Promise<ReasoningResult> {
  const trace = await llmTrace(a);
  const traceJson = JSON.stringify(trace);
  const reasonHash = keccak256(toUtf8Bytes(traceJson)) as `0x${string}`;
  const ipfsCid = await pinIpfs(trace);
  return {
    leader: a.leader,
    trace,
    traceJson,
    reasonHash,
    ipfsCid,
    generatedAt: new Date().toISOString(),
  };
}
