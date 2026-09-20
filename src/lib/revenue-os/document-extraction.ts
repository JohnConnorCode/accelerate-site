import "server-only";
import { Worker } from "node:worker_threads";
import { pathToFileURL } from "node:url";

export const DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;
export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
] as const;
export interface ExtractedDocument {
  text: string;
  locations: Array<{ label: string; start: number; end: number }>;
}

/** Untrusted parsers run off the request thread with a hard deadline and heap
 * limit. No HTML conversion, embedded scripts, remote resources or OCR. */
export async function extractDocument(
  data: Uint8Array,
  mime: string,
  signal?: AbortSignal,
): Promise<ExtractedDocument> {
  if (!DOCUMENT_MIME_TYPES.includes(mime as (typeof DOCUMENT_MIME_TYPES)[number]))
    throw new Error("Use PDF, DOCX, plain text or Markdown");
  if (!data.byteLength || data.byteLength > DOCUMENT_MAX_BYTES)
    throw new Error("Upload a nonempty document up to 8 MB");
  signal?.throwIfAborted();
  if (mime === "text/plain" || mime === "text/markdown") {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(data).trim();
    if (!text || text.length > 500000 || text.includes("\0"))
      throw new Error("Text must be UTF-8 and contain 1–500000 readable characters");
    return { text, locations: [{ label: "Document", start: 0, end: text.length }] };
  }
  const worker = new Worker(
    `
    const { parentPort, workerData } = require('node:worker_threads');
    (async () => {
      let text = ''; const locations = [];
      const append = (value,label) => {
        const start=text.length; text+=value+'\\n';
        if(text.length>500000) throw new Error('Document exceeds 500000 extracted characters');
        locations.push({label,start,end:text.length});
      };
      if(workerData.mime==='application/pdf') {
        const pdfjs=await import(workerData.pdfPath);
        const task=pdfjs.getDocument({data:new Uint8Array(workerData.data),isEvalSupported:false,disableFontFace:true,useSystemFonts:true,useWorkerFetch:false,disableAutoFetch:true});
        try {
          const pdf=await task.promise;
          if(pdf.numPages>100) throw new Error('PDF exceeds 100 pages');
          for(let page=1;page<=pdf.numPages;page++) {
            const value=await (await pdf.getPage(page)).getTextContent();
            append(value.items.map(item=>'str' in item ? item.str : '').join(' '),'Page '+page);
          }
        } finally { await task.destroy(); }
      } else {
        const result=await require(workerData.docxPath).extractRawText({buffer:Buffer.from(workerData.data)});
        append(result.value,'Document');
      }
      if(!text.trim()) throw new Error('No readable text found. Scanned documents need OCR before uploading.');
      parentPort.postMessage({text,locations});
    })().catch(error=>parentPort.postMessage({error:error.name==='PasswordException'?'Encrypted PDFs must be unlocked before uploading.':error.message}));
  `,
    {
      eval: true,
      workerData: {
        data,
        mime,
        pdfPath: pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href,
        docxPath: require.resolve("mammoth"),
      },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 32 },
    },
  );
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, result?: ExtractedDocument) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      void worker.terminate();
      if (error) reject(error);
      else resolve(result!);
    };
    const abort = () => finish(new Error("Document extraction was cancelled; retry indexing"));
    const timeout = setTimeout(
      () => finish(new Error("Document extraction exceeded 15 seconds; use a smaller document")),
      15000,
    );
    signal?.addEventListener("abort", abort, { once: true });
    worker.once("message", (result: ExtractedDocument & { error?: string }) =>
      finish(result.error ? new Error(result.error) : undefined, result),
    );
    worker.once("error", (error) => finish(error));
    worker.once("exit", (code) => {
      if (!settled)
        finish(new Error(`Document extraction stopped (${code}); use a smaller document`));
    });
  });
}
