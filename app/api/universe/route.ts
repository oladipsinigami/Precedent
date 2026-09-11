import { bitgetRTokenMarkets } from "@/lib/providers/bitget";
import { nameFromBitgetRTokenMarket, UNIVERSE } from "@/lib/universe";

export async function GET() {
  let universe = UNIVERSE;
  try {
    universe = (await bitgetRTokenMarkets()).map(nameFromBitgetRTokenMarket);
  } catch {
    // The built-in list remains available if Bitget discovery is unavailable.
  }
  return Response.json(
    universe.map((n) => ({
      native: n.native,
      rToken: n.rToken,
      name: n.name,
      sector: n.sector,
      bitgetSymbols: n.bitgetSymbols,
    })),
  );
}
