"use client";
import { useState } from "react";
import { Download } from "lucide-react";

/** Keep failures beside the download control, without leaving the payment page. */
export function InvoicePdfDownload({ pdfUrl }: { pdfUrl: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(pdfUrl, {
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      if (!response.ok || !response.headers.get("Content-Type")?.startsWith("application/pdf")) {
        setError("The PDF could not be downloaded. Try again or contact the issuer for a copy.");
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download =
        response.headers.get("Content-Disposition")?.match(/filename="([A-Za-z0-9_.-]+)"/)?.[1] ||
        "invoice.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(
        failure instanceof Error && failure.name === "TimeoutError"
          ? "The download is taking too long. Try again. Your invoice is unchanged."
          : "The PDF could not be downloaded. Try again or contact the issuer for a copy.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-lg">
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-[12px] border border-neutral-300 px-4 text-sm font-medium text-neutral-900 hover:border-neutral-900 disabled:opacity-60"
      >
        <Download className="mr-2 h-4 w-4" aria-hidden="true" />
        {busy ? "Preparing PDF…" : "Download PDF invoice"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
