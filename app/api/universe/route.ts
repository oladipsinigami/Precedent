import { bitgetRTokenMarkets } from "@/lib/providers/bitget";
import { nameFromBitgetRTokenMarket, UNIVERSE } from "@/lib/universe";

export async function GET() {
  let universe = UNIVERSE;
  try {
    universe = (await bitgetRTokenMarkets()).map(nameFromBitgetRTokenMarket);
  } catch {
    // The built-in list remains available if Bitget discovery is unavailable.
  }
  let openCodeTest: any = "not run";
  if (process.env.OPENCODE_API_KEY) {
    try {
      const client = new (await import("openai")).default({
        apiKey: process.env.OPENCODE_API_KEY.trim(),
        baseURL: process.env.OPENCODE_BASE_URL || "https://opencode.ai/zen/v1",
      });
      const res = await client.chat.completions.create({
        model: "ling-3.0-flash-fin-free",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 5,
      });
      openCodeTest = { success: true, text: res.choices[0]?.message?.content };
    } catch (e: any) {
      openCodeTest = { success: false, error: e.message, status: e.status, code: e.code };
    }
  }

  return Response.json({
    env: {
      hasOpenCode: Boolean(process.env.OPENCODE_API_KEY),
      openCodeTest,
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
