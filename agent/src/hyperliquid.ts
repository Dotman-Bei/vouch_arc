import { request } from "undici";
import { config } from "./config.js";

export interface HLFill {
  time: number;       // ms
  hash?: string;
  tid?: number;
  px: string;
  sz: string;
  side: "B" | "A";
  closedPnl: string;
  fee: string;
  coin: string;
}

export interface HLFillsHistory {
  fills: HLFill[];
  capped: boolean;
  requests: number;
}

export interface HLClearinghouse {
  marginSummary?: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  assetPositions?: Array<{
    position: {
      coin: string;
      szi: string;
      entryPx: string;
      unrealizedPnl: string;
    };
  }>;
}

async function hlPost<T>(body: object): Promise<T> {
  const res = await request(config.HL_API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.statusCode >= 400) {
    throw new Error(`HL API ${res.statusCode}: ${await res.body.text()}`);
  }
  return (await res.body.json()) as T;
}

export async function getUserFills(user: string, startTime: number): Promise<HLFill[]> {
  return hlPost<HLFill[]>({ type: "userFills", user, startTime });
}

export async function getUserFillsByTime(user: string, startTime: number, endTime: number): Promise<HLFill[]> {
  return hlPost<HLFill[]>({
    type: "userFillsByTime",
    user,
    startTime,
    endTime,
    aggregateByTime: true,
  });
}

export async function getUserFillsHistory(
  user: string,
  startTime: number,
  endTime: number,
): Promise<HLFillsHistory> {
  const maxPerRequest = 2000;
  const minWindowMs = 10 * 60_000;
  const maxRequests = 80;
  const maxFills = 10_000;
  let requests = 0;
  let capped = false;
  const byKey = new Map<string, HLFill>();

  async function fetchRange(start: number, end: number): Promise<void> {
    if (requests >= maxRequests || byKey.size >= maxFills) {
      capped = true;
      return;
    }

    requests++;
    const fills = await getUserFillsByTime(user, start, end);

    if (fills.length >= maxPerRequest && end - start > minWindowMs) {
      const mid = start + Math.floor((end - start) / 2);
      await fetchRange(start, mid);
      await fetchRange(mid + 1, end);
      return;
    }

    if (fills.length >= maxPerRequest) capped = true;
    for (const fill of fills) {
      const key = fill.hash && fill.tid != null
        ? `${fill.hash}:${fill.tid}`
        : `${fill.time}:${fill.coin}:${fill.side}:${fill.px}:${fill.sz}:${fill.closedPnl}:${fill.fee}`;
      byKey.set(key, fill);
      if (byKey.size >= maxFills) capped = true;
    }
  }

  await fetchRange(startTime, endTime);

  return {
    fills: [...byKey.values()].sort((a, b) => a.time - b.time).slice(-maxFills),
    capped,
    requests,
  };
}

export async function getClearinghouseState(user: string): Promise<HLClearinghouse> {
  return hlPost<HLClearinghouse>({ type: "clearinghouseState", user });
}
