import { fetchJson } from "../http";

export type ChartLibraryPacket = {
  status: string;
  data: {
    symbol: string;
    date: string;
    state: string;
    prev_state: string;
    transition_slow4?: string;
    tape: Record<string, unknown>;
    analogs_of_new_state: {
      status: string;
      reason?: string;
      n: number;
      symbols: number;
      sessions: number;
      excess_followed: Record<
        string,
        { n: number; p10: number; p50: number; p90: number; p_up: number }
      >;
      informative_5d?: {
        verdict?: string;
        ratio_to_base?: number;
        iqr_excess_5d_pp?: number;
        median_excess_5d_pp?: number;
        p10_excess_5d_pp?: number;
        p90_excess_5d_pp?: number;
      };
      closest: [string, string, number][];
    };
    transition_memory?: Record<string, unknown>;
  };
  meta: {
    lane?: string;
    lane_label?: string;
    session?: string;
    note?: string;
  };
};

export async function chartLibraryState(symbol: string): Promise<ChartLibraryPacket> {
  const url = `https://chartlibrary.io/api/v1/state-packet?symbol=${encodeURIComponent(symbol)}`;
  return fetchJson<ChartLibraryPacket>(url, { timeoutMs: 3000, cacheTtlMs: 5 * 60_000 });
}
