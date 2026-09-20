// Minimal MCP-over-HTTP (JSON-RPC 2.0 + SSE) client for Bitget's public
// market-data MCP service — the same data backend that powers the official
// `bitget-signal` skill stack (macro-analyst, sentiment-analyst, market-intel,
// news-briefing, technical-analysis). No API key required.
//
// Wire format (verified live): POST JSON-RPC to the endpoint, server replies
// with `Content-Type: text/event-stream` frames of the form
//   event: message
//   data: {"jsonrpc":"2.0","id":N,"result":{...}}
// Session id is returned in the `mcp-session-id` response header and must be
// echoed on subsequent calls within the session.

const MCP_URL = process.env.BITGET_MCP_URL?.trim() || "https://datahub.noxiaohao.com/mcp";
const PROTOCOL_VERSION = "2024-11-05";
const CLIENT_INFO = { name: "precedent-research-desk", version: "0.1.0" };

type JsonRpcResponse<T> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string };
};

export type McpToolCallResult = {
  content?: { type: string; text?: string }[];
  isError?: boolean;
};

function headers(sessionId?: string): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) h["mcp-session-id"] = sessionId;
  return h;
}

// Reads an SSE response body and returns the first parsed JSON-RPC message
// whose `id` matches the request (or the first message when id is absent).
async function readSseJsonRpc<T>(res: Response, wantId: number, timeoutMs: number): Promise<T> {
  if (!res.body) throw new Error("MCP response has no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // This server delimits SSE frames with CRLF; tolerate plain LF too.
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const dataLine = frame.split(/\r?\n/).find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const msg = JSON.parse(payload) as JsonRpcResponse<T>;
        if (msg.id === wantId) {
          if (msg.error) throw new Error(`MCP error ${msg.error.code}: ${msg.error.message}`);
          // Cancel the remainder of the stream; we have what we need.
          reader.cancel().catch(() => undefined);
          return msg.result as T;
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("MCP error")) throw err;
        // Non-JSON keepalive / partial frame — keep reading.
      }
    }
  }
  throw new Error("MCP call timed out waiting for result frame");
}

async function rpc<T>(method: string, params: unknown, id: number, sessionId: string | undefined, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: headers(sessionId),
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`MCP HTTP ${res.status} for ${method}`);
    const result = await readSseJsonRpc<T>(res, id, timeoutMs);
    return { result, sessionId: res.headers.get("mcp-session-id") ?? sessionId };
  } finally {
    clearTimeout(timer);
  }
}

// Opens a session, calls one tool, returns the tool result. A fresh session per
// call is deliberate: serverless instances are ephemeral and this service is
// stateless-friendly (session is just a routing header).
export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
  timeoutMs = 12_000,
): Promise<McpToolCallResult> {
  const init = await rpc<{ serverInfo?: { name?: string } }>(
    "initialize",
    { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: CLIENT_INFO },
    1,
    undefined,
    timeoutMs,
  );
  const sessionId = init.sessionId;
  const called = await rpc<McpToolCallResult>("tools/call", { name, arguments: args }, 2, sessionId, timeoutMs);
  return called.result;
}

// Extracts concatenated text blocks from a tool call result.
export function mcpText(result: McpToolCallResult): string {
  return (result.content ?? [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("\n");
}

// Attempts JSON.parse on the text payload; falls back to raw text.
export function mcpJson<T = unknown>(result: McpToolCallResult): T | string {
  const text = mcpText(result);
  try {
    return JSON.parse(text) as T;
  } catch {
    return text;
  }
}
