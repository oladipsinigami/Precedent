import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const model = url.searchParams.get("model") || "liquid/lfm-2.5-2.6b:free";

  const rawKey =
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENROUTER_KEY ||
    (process.env.OPENAI_API_KEY?.startsWith("sk-or-") ? process.env.OPENAI_API_KEY : undefined);
  const apiKey = rawKey && rawKey !== "[SENSITIVE]" ? rawKey : undefined;

  if (!apiKey) {
    return Response.json({ error: "No OpenRouter key found in environment" }, { status: 500 });
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    maxRetries: 0,
  });

  const start = Date.now();
  try {
    const res = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: "You are a financial research assistant. Output valid JSON only with keys: title, summary, points. No explanations.",
        },
        {
          role: "user",
          content: "Summarize Apple (AAPL) stock situation for a swing trader.",
        },
      ],
    });

    const elapsed = Date.now() - start;
    const msg = res.choices[0]?.message;
    const content = msg?.content || "";
    const finish = res.choices[0]?.finish_reason;

    let parsed = null;
    let parseError = null;
    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else parsed = JSON.parse(content);
    } catch (e: any) {
      parseError = e.message;
    }

    return Response.json({
      model,
      actualModel: res.model,
      elapsedMs: elapsed,
      finish,
      contentLength: content.length,
      sample: content.slice(0, 200),
      parsedOk: !!parsed,
      parseError,
    });
  } catch (err: any) {
    return Response.json(
      {
        model,
        elapsedMs: Date.now() - start,
        error: err.message,
        status: err.status,
      },
      { status: 500 }
    );
  }
}
