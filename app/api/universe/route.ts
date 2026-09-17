import { bitgetRTokenMarkets } from "@/lib/providers/bitget";
import { nameFromBitgetRTokenMarket, UNIVERSE } from "@/lib/universe";

export async function GET() {
  let universe = UNIVERSE;
  try {
    universe = (await bitgetRTokenMarkets()).map(nameFromBitgetRTokenMarket);
  } catch {
    // The built-in list remains available if Bitget discovery is unavailable.
  }
  return Response.json({
    env: {
      hasOpenCode: Boolean(process.env.OPENCODE_API_KEY),
      hasOpenRouter: Boolean(process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY),
      hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
      hasXAI: Boolean(process.env.XAI_API_KEY),
      hasBitgetQwen: Boolean(process.env.BITGET_QWEN_API_KEY),
    },
    universe: universe.map((n) => ({
      native: n.native,
      rToken: n.rToken,
      name: n.name,
      sector: n.sector,
      bitgetSymbols: n.bitgetSymbols,
    })),
  });
}
