import assert from "node:assert/strict";
import { youcomNews } from "../lib/providers/youcom";

type Call = { url: string; init: RequestInit };

function stubFetch(payload: unknown, status = 200) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  const originalWarn = console.warn;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Upstream Error",
      json: async () => payload,
    } as unknown as Response;
  }) as typeof fetch;
  console.warn = () => {};
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
      console.warn = originalWarn;
    },
  };
}

const PAYLOAD = {
  results: {
    news: [
      { title: "Chip stocks retreat as Qualcomm secures Apple licensing", url: "https://www.investors.com/news/tech/apple-qualcomm/", page_age: "2026-09-24T15:53:00" },
      { title: "  ", url: "https://example.com/blank", page_age: "2026-09-24T10:00:00" },
      { title: "Apple beats on services revenue", url: "not-a-valid-url", page_age: "2026-09-24T09:00:00" },
    ],
    web: [
      { title: "Web-only page that must not be used when news exists", url: "https://example.com/web" },
      { title: "Chip stocks retreat as Qualcomm secures Apple licensing", url: "https://www.investors.com/news/tech/apple-qualcomm/" },
    ],
  },
};

// 1. No key configured: the provider is a no-op and never calls the network.
async function main() {
const savedKey = process.env.YDC_API_KEY;
delete process.env.YDC_API_KEY;
{
  const stub = stubFetch(PAYLOAD);
  const out = await youcomNews("Apple AAPL earnings");
  assert.deepEqual(out, []);
  assert.equal(stub.calls.length, 0, "must not call the API without a key");
  stub.restore();
  console.log("ok - youcom provider is a no-op when YDC_API_KEY is unset");
}

// 2. With a key: news wins over web, outlet comes from the host, blanks and
//    duplicate URLs are dropped, and the request carries the documented shape.
process.env.YDC_API_KEY = "test-key";
{
  const stub = stubFetch(PAYLOAD);
  const out = await youcomNews("Apple AAPL earnings");
  assert.deepEqual(
    out.map((h) => h.publisher),
    ["investors.com", "You.com"],
    `unexpected publishers: ${JSON.stringify(out)}`,
  );
  assert.equal(out.length, 2, "blank titles, duplicate URLs and the web section should be dropped");
  assert.equal(out[0].published, "2026-09-24T15:53:00");
  assert.equal(stub.calls.length, 1);
  const call = stub.calls[0];
  assert.equal(call.url, "https://ydc-index.io/v1/search");
  const headers = call.init.headers as Record<string, string>;
  assert.equal(headers["X-API-Key"], "test-key");
  const body = JSON.parse(String(call.init.body));
  assert.equal(body.query, "Apple AAPL earnings");
  assert.equal(body.freshness, "week");
  assert.ok(body.count >= 1 && body.count <= 100, `count out of range: ${body.count}`);
  stub.restore();
  console.log("ok - youcom provider prefers news, attributes the outlet, and sends the documented request");
}

// 3. Upstream failure: degrade to an empty list rather than throwing.
{
  const stub = stubFetch({}, 429);
  const out = await youcomNews("Apple AAPL earnings");
  assert.deepEqual(out, []);
  stub.restore();
  console.log("ok - youcom provider degrades to an empty list on an upstream error");
}

  if (savedKey === undefined) delete process.env.YDC_API_KEY;
  else process.env.YDC_API_KEY = savedKey;

  console.log("3 news-provider checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
