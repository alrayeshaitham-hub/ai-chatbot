import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language?: string;
  value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-neutral-700/60 bg-neutral-900/90 shadow-lg">
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950/70 px-4 py-1.5 text-xs text-neutral-400">
        <span className="font-mono font-medium tracking-wide uppercase text-neutral-300">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          type="button"
          aria-label="Copy code to clipboard"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100 focus:outline-none"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-neutral-200">
        <pre className="m-0">
          <code>{value}</code>
        </pre>
      </div>
    </div>
  );
};
