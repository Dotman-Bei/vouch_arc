import { VerdictBadge } from "./VerdictBadge";
import type { ReasoningTraceData } from "@/lib/types";

export function ReasoningTrace({
  trace,
  reasonHash,
  ipfsCid,
}: { trace: ReasoningTraceData; reasonHash: string; ipfsCid?: string | null }) {
  return (
    <article className="callout">
      <div className="flex items-center justify-between mb-4">
        <span className="label">AI reasoning trace</span>
        <div className="flex items-center gap-3">
          <VerdictBadge verdict={trace.verdict} />
          <span className="text-xs text-fg-secondary tabular">
            confidence {(trace.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      <p className="text-base mb-5">{trace.summary}</p>
      {trace.strengths.length > 0 && (
        <>
          <div className="label mb-2">strengths</div>
          <ul className="em-list mb-5">
            {trace.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}
      {trace.risks.length > 0 && (
        <>
          <div className="label mb-2">risks</div>
          <ul className="em-list mb-5">
            {trace.risks.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </>
      )}
      <div className="border-t border-line pt-3 mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-fg-tertiary">
        <span>slash-risk: <span className="text-fg-secondary">{trace.slashRisk}</span></span>
        <span>hash: <span className="text-fg-secondary tabular">{reasonHash.slice(0, 14)}…</span></span>
        <a href={`/api/trace/${reasonHash}`} target="_blank" rel="noreferrer">
          view raw trace ↗
        </a>
        {ipfsCid && (
          <a
            href={`https://ipfs.io/ipfs/${ipfsCid}`}
            target="_blank"
            rel="noreferrer"
          >IPFS ↗</a>
        )}
      </div>
    </article>
  );
}
