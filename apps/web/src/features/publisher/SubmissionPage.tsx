import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { publisherApi } from '../../api/publisher';
import StatusBadge from '../../components/StatusBadge';
import PermissionBadge from '../../components/PermissionBadge';
import JsonViewer from '../../components/JsonViewer';
import ErrorState from '../../components/ErrorState';

export default function SubmissionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['submission', id],
    queryFn: () => publisherApi.getSubmission(id!),
    enabled: !!id,
  });

  const withdrawMutation = useMutation({
    mutationFn: () => publisherApi.withdraw(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['submission', id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => publisherApi.deleteSubmission(id!),
    onSuccess: () => navigate('/publisher/skills'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-40 bg-gray-200 rounded" />
      </div>
    );
  }

  if (isError || !data) return <ErrorState />;

  const sub = data.submission;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm mb-6">
        <Link to="/publisher/skills" className="text-gray-500 hover:text-gray-700">我的提交</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-900 font-mono text-xs">{sub.id}</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {sub.skillId ?? '未解析的提交'}
          {sub.version && <span className="ml-2 font-mono text-gray-400 text-sm">v{sub.version}</span>}
        </h1>
        <StatusBadge status={sub.status} />
      </div>

      {/* Validation result */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">校验结果</h3>
        {sub.validation.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
            <p className="text-red-700 text-sm font-medium mb-1">错误</p>
            <ul className="text-red-600 text-sm space-y-0.5">
              {sub.validation.errors.map((e, i) => <li key={i}>• {e.message}</li>)}
            </ul>
          </div>
        )}
        {sub.validation.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2">
            <p className="text-yellow-700 text-sm font-medium mb-1">警告</p>
            <ul className="text-yellow-600 text-sm space-y-0.5">
              {sub.validation.warnings.map((w, i) => <li key={i}>• {w.message}</li>)}
            </ul>
          </div>
        )}
        {sub.validation.valid && (
          <p className="text-green-700 text-sm">✓ 校验通过</p>
        )}
      </div>

      {/* Reject reason */}
      {sub.status === 'rejected' && sub.reviewReason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-red-700 mb-2">拒绝原因</h3>
          <p className="text-sm text-red-700">{sub.reviewReason}</p>
        </div>
      )}

      {/* Package info */}
      {sub.package && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">包信息</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>文件名：{sub.package.filename}</p>
            <p>大小：{(sub.package.sizeBytes / 1024).toFixed(1)} KB</p>
            <p className="font-mono text-xs text-gray-400">SHA256: {sub.package.checksumSha256}</p>
          </div>
        </div>
      )}

      {/* Permissions */}
      {sub.manifest?.permissions && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">权限声明</h3>
          <PermissionBadge permissions={sub.manifest.permissions} />
        </div>
      )}

      {/* Manifest */}
      {sub.manifest && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">manifest</h3>
          <JsonViewer value={sub.manifest as unknown as object} maxHeight="300px" />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end mt-6">
        {sub.status === 'pending_review' && (
          <button
            onClick={() => { if (confirm('确认撤回？')) withdrawMutation.mutate(); }}
            disabled={withdrawMutation.isPending}
            className="text-sm px-4 py-2 rounded-lg border border-orange-300 text-orange-600 hover:bg-orange-50 disabled:opacity-50"
          >
            撤回
          </button>
        )}
        {(sub.status === 'draft' || sub.status === 'rejected') && (
          <button
            onClick={() => { if (confirm('确认删除？')) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
            className="text-sm px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            删除
          </button>
        )}
      </div>
    </div>
  );
}
