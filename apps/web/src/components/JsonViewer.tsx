interface Props {
  value: object;
  maxHeight?: string;
}

export default function JsonViewer({ value, maxHeight = '400px' }: Props) {
  const formatted = JSON.stringify(value, null, 2);
  return (
    <div
      className="bg-gray-950 rounded-lg overflow-auto text-xs font-mono"
      style={{ maxHeight }}
    >
      <pre className="p-4 text-green-300 whitespace-pre">{formatted}</pre>
    </div>
  );
}
