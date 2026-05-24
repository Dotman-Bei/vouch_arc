import { request } from "undici";
import { config } from "./config.js";
import { logger } from "./logger.js";
import type { AnalysisResult } from "./analyzer.js";
import type { DispatchResult } from "./dispatcher.js";

export async function notifySlash(a: AnalysisResult, d: DispatchResult, handle: string) {
  if (!config.DISCORD_WEBHOOK_URL || !d.slashed) return;
  const lines = [
    `**VOUCH SLASH** — ${handle}`,
    `Degradation score: ${a.degradationScore}/100`,
    `Slash: ${(d.slashBps / 100).toFixed(2)}% of bond`,
    `Sharpe 30d: ${a.sharpe30d.toFixed(2)} · Drawdown: ${(a.maxDrawdown * 100).toFixed(1)}%`,
    `Tx: ${d.slashTx ?? "—"}`,
  ];
  try {
    await request(config.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: lines.join("\n") }),
    });
  } catch (e) {
    logger.warn({ err: String(e) }, "discord notify failed");
  }
}
