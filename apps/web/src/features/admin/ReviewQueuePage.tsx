import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import StatusBadge from '../../components/StatusBadge';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import type { MarketSubmission } from '@qizhi/skill-spec';

function riskTags(sub: MarketSubmission) {
  const tags: { label: string; className: string }[] = [];
  const perms = sub.manifest?.permissions;
  if (perms?.scripts) tags.push({ label: 'scripts', className: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300' });
  if (perms?.network === true || (perms?.network && typeof perms.network === 'object'))
    tags.push({ label: 'network', className: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' });
  if (perms?.secrets && perms.secrets.length > 0)
    tags.push({ label: 'secrets', className: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' });
  if (sub.package && sub.package.sizeBytes > 5 * 1024 * 1024)
    tags.push({ label: 'large_pkg', className: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400' });
  return tags;
}

const STATUS_FILTER_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending_review', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'published', label: '已发布' },
];

export default function ReviewQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? 'pending_review';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-reviews', status],
    queryFn: () => adminApi.listReviews({ status: status || undefined }),
  });

  const submissions = data?.submissions ?? [];

  const setStatus = (s: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (s) next.set('status', s);
      else next.delete('status');
      return next;
    });
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">审核队列</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatus(opt.value)}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
              status === opt.value
                ? 'bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && submissions.length === 0 && (
        <EmptyState title="没有符合条件的提交" />
      )}

      {!isLoading && !isError && submissions.length > 0 && (
        <div className="space-y-3">
          {submissions.map((sub) => {
            const tags = riskTags(sub);
            return (
              <Link
                key={sub.id}
                to={`/admin/reviews/${sub.id}`}
                className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{sub.skillId ?? '未知'}</span>
                      {sub.version && (
                        <span className="font-mono text-xs text-gray-400 dark:text-gray-500">v{sub.version}</span>
                      )}
                      <StatusBadge status={sub.status} />
                      {tags.map((t) => (
                        <span key={t.label} className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.className}`}>
                          {t.label}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 flex gap-3 flex-wrap">
                      <span>发布者：{sub.user?.displayName ?? sub.publisher ?? '—'}</span>
                      <span>提交：{sub.submittedAt
                        ? new Date(sub.submittedAt).toLocaleString('zh-CN')
                        : new Date(sub.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-blue-600 dark:text-blue-400 shrink-0">审核 →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
