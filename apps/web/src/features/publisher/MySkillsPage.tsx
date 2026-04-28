import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { publisherApi } from '../../api/publisher';
import StatusBadge from '../../components/StatusBadge';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';

export default function MySkillsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['publisher-submissions'],
    queryFn: publisherApi.listSubmissions,
  });

  const deleteMutation = useMutation({
    mutationFn: publisherApi.deleteSubmission,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['publisher-submissions'] }),
  });

  const withdrawMutation = useMutation({
    mutationFn: publisherApi.withdraw,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['publisher-submissions'] }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const submissions = data?.submissions ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">我的提交</h1>
        <Link
          to="/publish"
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + 新建提交
        </Link>
      </div>

      {submissions.length === 0 ? (
        <EmptyState
          title="还没有提交记录"
          message="上传你的第一个 Skill 包"
          action={
            <Link to="/publish" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              立即提交
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <div key={sub.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Link
                      to={`/publisher/submissions/${sub.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {sub.skillId ?? '未解析'}
                    </Link>
                    {sub.version && (
                      <span className="text-gray-400 text-sm font-mono">v{sub.version}</span>
                    )}
                    <StatusBadge status={sub.status} />
                  </div>
                  <div className="text-xs text-gray-400">
                    提交时间：{sub.submittedAt
                      ? new Date(sub.submittedAt).toLocaleString('zh-CN')
                      : new Date(sub.createdAt).toLocaleString('zh-CN')}
                  </div>
                  {sub.status === 'rejected' && sub.reviewReason && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
                      拒绝原因：{sub.reviewReason}
                    </div>
                  )}
                  {sub.status === 'published' && sub.skillId && (
                    <Link
                      to={`/skills/${sub.skillId.replace('/', '/')}`}
                      className="mt-1 text-xs text-blue-600 hover:underline block"
                    >
                      查看公开页面 →
                    </Link>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link
                    to={`/publisher/submissions/${sub.id}`}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
                  >
                    详情
                  </Link>
                  {sub.status === 'pending_review' && (
                    <button
                      onClick={() => {
                        if (confirm('确认撤回此提交？')) withdrawMutation.mutate(sub.id);
                      }}
                      className="text-xs text-orange-600 hover:text-orange-700 px-2 py-1 rounded border border-orange-200 hover:bg-orange-50"
                    >
                      撤回
                    </button>
                  )}
                  {(sub.status === 'draft' || sub.status === 'rejected') && (
                    <button
                      onClick={() => {
                        if (confirm('确认删除此提交？')) deleteMutation.mutate(sub.id);
                      }}
                      className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
