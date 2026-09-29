import { MCP_MAX_REQUEST_BYTES } from "../../src/lib/revenue-os/mcp-request";

/** Drain oversized lines without retaining them; the next valid message still works. */
export async function* readMcpLines(input: AsyncIterable<Uint8Array>) {
  let chunks: Uint8Array[] = [];
  let size = 0;
  let oversized = false;
  const finish = () => {
    const result = oversized
      ? { error: "MCP request exceeds 256,000 bytes" }
      : (() => {
          const bytes = Buffer.concat(chunks, size);
          try {
            return { line: new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim() };
          } catch {
            return { error: "MCP request must contain valid UTF-8" };
          }
        })();
    chunks = [];
    size = 0;
    oversized = false;
    return result;
  };
  for await (const chunk of input) {
    let offset = 0;
    while (offset < chunk.length) {
      const newline = chunk.indexOf(10, offset);
      const end = newline === -1 ? chunk.length : newline;
      const part = chunk.subarray(offset, end);
      if (!oversized) {
        size += part.length;
        if (size > MCP_MAX_REQUEST_BYTES) {
          oversized = true;
          chunks = [];
          size = 0;
        } else chunks.push(Buffer.from(part));
      }
      if (newline !== -1) yield finish();
      offset = end + 1;
    }
  }
  if (size || oversized) yield finish();
}
