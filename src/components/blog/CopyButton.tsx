'use client';

import { useState } from 'react';
import type { CodeLabels } from './mdx-components';

/** Kod bloğu için "Kopyala" düğmesi; sonucu ekran okuyucuya da duyurur. */
export default function CopyButton({ text, labels }: { text: string; labels: CodeLabels }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* pano erişimi reddedildi: sessizce geç */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={labels.copyAria}
        className="shrink-0 border border-[#F1F3FA] px-2 py-0.5 text-xs font-bold transition hover:bg-primary hover:text-white"
      >
        {copied ? labels.copied : labels.copy}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? labels.copiedAnnounce : ''}
      </span>
    </>
  );
}
