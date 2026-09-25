import { bitgetRTokenMarkets } from "@/lib/providers/bitget";
import { nameFromBitgetRTokenMarket, UNIVERSE } from "@/lib/universe";

export async function GET() {
  let universe = UNIVERSE;
  let source: "live" | "fallback" = "fallback";
  try {
    const liveUniverse = (await bitgetRTokenMarkets()).map(nameFromBitgetRTokenMarket);
    if (liveUniverse.length) {
      universe = liveUniverse;
      source = "live";
    }
  } catch {
    // The built-in list remains available if Bitget discovery is unavailable.
  }
  return Response.json({
    source,
    asOf: new Date().toISOString(),
    universe: universe.map((n) => ({
      native: n.native,
      rToken: n.rToken,
      name: n.name,
      sector: n.sector,
      bitgetSymbols: n.bitgetSymbols,
    })),
  });
}
