import { useState } from 'react';

interface Props {
  value: string;
  idleLabel?: string;
  copiedLabel?: string;
  className?: string;
}

export default function CopyButton({
  value,
  idleLabel = '复制',
  copiedLabel = '已复制',
  className = 'rounded-md border border-blue-300 px-2.5 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950',
}: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? copiedLabel : idleLabel}
    </button>
  );
}
