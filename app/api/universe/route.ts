import { bitgetRTokenMarketsDetailed } from "@/lib/providers/bitget";
import { nameFromBitgetRTokenMarket, UNIVERSE } from "@/lib/universe";

export async function GET() {
  let universe = UNIVERSE;
  let source: "live" | "cached" | "fallback" = "fallback";
  let asOf: string | null = null;
  try {
    const discovered = await bitgetRTokenMarketsDetailed();
    if (discovered.markets.length) {
      universe = discovered.markets.map(nameFromBitgetRTokenMarket);
      source = discovered.source;
      asOf = discovered.fetchedAt;
    }
  } catch {
    // The built-in list remains available only when discovery has never worked.
  }
  return Response.json({
    source,
    asOf,
    universe: universe.map((n) => ({
      native: n.native,
      rToken: n.rToken,
      name: n.name,
      sector: n.sector,
      bitgetSymbols: n.bitgetSymbols,
    })),
  });
}
