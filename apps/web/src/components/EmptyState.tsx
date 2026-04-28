interface Props {
  title?: string;
  message?: string;
  action?: React.ReactNode;
}

export default function EmptyState({
  title = '暂无数据',
  message,
  action,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-3">📭</div>
      <h3 className="text-lg font-semibold text-gray-700 mb-1">{title}</h3>
      {message && <p className="text-sm text-gray-500 mb-4">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
