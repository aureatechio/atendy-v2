"use client";

import { useEffect, useState } from "react";
import { FaCheck, FaRegCopy } from "react-icons/fa";

interface Props {
  value: string;
}

export function WhatsAppCopyButton({ value }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timeout = window.setTimeout(() => {
      setCopied(false);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      className={`cliente-info-copy-btn ${copied ? "is-copied" : ""}`}
      onClick={handleCopy}
      title={copied ? "Número copiado" : "Copiar WhatsApp"}
      aria-label={copied ? "Número copiado" : "Copiar número do WhatsApp"}
      aria-live="polite"
    >
      {copied ? <FaCheck className="h-3.5 w-3.5" /> : <FaRegCopy className="h-3.5 w-3.5" />}
      <span className="sr-only">{copied ? "Copiado" : "Copiar"}</span>
    </button>
  );
}
