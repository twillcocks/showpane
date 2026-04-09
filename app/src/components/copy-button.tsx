"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

type CopyButtonProps = {
  text: string;
  invert?: boolean;
};

export function CopyButton({ text, invert = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    if (!copied && !copyError) return;

    const timeout = window.setTimeout(() => {
      setCopied(false);
      setCopyError(false);
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [copied, copyError]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        invert
          ? "inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
          : "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      }
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : copyError ? "Failed" : "Copy"}
    </button>
  );
}
