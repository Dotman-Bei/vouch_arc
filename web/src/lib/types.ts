export interface ReasoningTraceData {
  summary: string;
  strengths: string[];
  risks: string[];
  verdict: "follow" | "watch" | "avoid";
  confidence: number;
  slashRisk: "low" | "medium" | "high";
}

export interface LeaderRow {
  address: string;
  handle: string;
  hlWallet: string;
  bondAmount: number;     // USDC (decimal-corrected)
  bondOriginal: number;
  tvl: number;
  hasMetrics: boolean;
  sharpe30d: number;
  maxDrawdown: number;
  winRate: number;
  return7dBps: number;
  degradationScore: number;
  verdict: "follow" | "watch" | "avoid";
  slashRisk: "low" | "medium" | "high";
  confidence: number;
  reasonHash: string;
  ipfsCid: string | null;
  reasoningTrace: ReasoningTraceData | null;
  lastAnalyzed: string | null;
}

export interface AgentRunSummary {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  leadersAnalyzed: number;
  slashesTriggered: number;
  avgSharpe: number;
  newTraces: number;
  errors: string[];
}

export interface SlashEventRow {
  id: string;
  leader: string;
  handle: string;
  slashBps: number;
  slashAmount: number;
  reasonHash: string;
  ipfsCid: string | null;
  txHash: string;
  timestamp: string;
}
