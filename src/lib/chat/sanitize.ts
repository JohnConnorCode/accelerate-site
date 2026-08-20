/**
 * House-style enforcement on the streamed chat reply.
 *
 * The system prompt tells the model never to use an em dash, and a prompt
 * instruction is not a guarantee: one was observed in production reading "no
 * catch, no sales pitch—just a clear plan you keep". It is the single most
 * common tell that a machine wrote the sentence, so it gets enforced in the
 * stream rather than hoped for in the prompt.
 *
 * Doing this on a byte stream is only safe if multi-byte characters split
 * across chunk boundaries are handled. An em dash is three bytes in UTF-8, so a
 * naive per-chunk replace misses any dash that straddles two chunks. The
 * decoder is created once with `{ stream: true }` on every decode, which is
 * exactly what holds a partial character back until its remaining bytes arrive.
 */

/** Characters that read as an em dash, and what replaces each. */
const REPLACEMENTS: Array<[RegExp, string]> = [
  // Spaced em dash: "a — b" becomes "a, b" rather than "a,  b".
  [/\s*—\s*/g, ", "],
  // Spaced en dash used as a clause break, same treatment.
  [/\s+–\s+/g, ", "],
];

export function applyHouseStyle(text: string): string {
  return REPLACEMENTS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

/**
 * Rewrite a streamed reply as it passes through, without buffering the whole
 * answer. The visitor still sees tokens arrive one at a time.
 */
export function enforceHouseStyle(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = stream.getReader();
  /**
   * Text whose meaning still depends on what arrives next.
   *
   * The rewrite matches a dash together with the whitespace around it, so it is
   * not enough to hold back the final character: with small chunks the spaces
   * preceding a dash are already gone by the time the dash shows up, and
   * "business — then" comes out as "business ,  then". What has to be held is
   * the entire trailing run of whitespace and dashes, since nothing earlier can
   * change meaning.
   */
  let held = "";
  /** Guard against a pathological all-whitespace stream buffering forever. */
  const MAX_HELD = 64;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        // Loop until there is something to emit or the stream ends. Returning
        // from pull without enqueueing or closing stalls the stream: nothing
        // pulls again, the reader never settles, and the process can exit with
        // no output at all. That happens routinely here, because a chunk
        // carrying one byte of a multi-byte character decodes to nothing.
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            if (held) controller.enqueue(encoder.encode(applyHouseStyle(held)));
            controller.close();
            return;
          }
          const text = held + decoder.decode(value, { stream: true });
          if (!text) continue;
          const boundary = text.length - (/[\s—–]*$/.exec(text)?.[0].length ?? 0);
          if (boundary === 0 && text.length <= MAX_HELD) {
            // Everything so far could still be part of a match.
            held = text;
            continue;
          }
          const emit = applyHouseStyle(text.slice(0, boundary));
          held = text.slice(boundary);
          if (emit) {
            controller.enqueue(encoder.encode(emit));
            return;
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
