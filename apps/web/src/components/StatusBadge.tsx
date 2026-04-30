import type { MarketSubmissionStatus } from '@qizhi/skill-spec';

const statusConfig: Record<MarketSubmissionStatus, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  pending_review: { label: '审核中', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  approved: { label: '已通过', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  rejected: { label: '已拒绝', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  published: { label: '已发布', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  withdrawn: { label: '已撤回', className: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
  removed: { label: '已下架', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
};

export default function StatusBadge({ status }: { status: MarketSubmissionStatus }) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
