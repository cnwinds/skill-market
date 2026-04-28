import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import StatusBadge from '../../components/StatusBadge';
import PermissionBadge from '../../components/PermissionBadge';
import JsonViewer from '../../components/JsonViewer';
import Modal from '../../components/Modal';
import ErrorState from '../../components/ErrorState';

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [removeModal, setRemoveModal] = useState(false);
  const [removeReason, setRemoveReason] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-review', id],
    queryFn: () => adminApi.getReview(id!),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => adminApi.approve(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-review', id] }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => adminApi.reject(id!, rejectReason),
    onSuccess: () => {
      setRejectModal(false);
      queryClient.invalidateQueries({ queryKey: ['admin-review', id] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => {
      const sub = data!.submission;
      return adminApi.removeVersion(sub.publisher!, sub.name!, sub.version!, removeReason);
    },
    onSuccess: () => {
      setRemoveModal(false);
      queryClient.invalidateQueries({ queryKey: ['admin-review', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/2" />
        <div className="h-40 bg-gray-200 rounded" />
        <div className="h-40 bg-gray-200 rounded" />
      </div>
    );
  }

  if (isError || !data) return <ErrorState />;

  const sub = data.submission;
  const perms = sub.manifest?.permissions;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm mb-6">
        <Link to="/admin/reviews" className="text-gray-500 hover:text-gray-700">审核队列</Link>
        <span className="text-gray-300">/</span>
        <span className="font-mono text-xs text-gray-900">{sub.id}</span>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-xl font-semibold text-gray-900">
          {sub.skillId ?? '未知 Skill'}
          {sub.version && <span className="ml-2 font-mono text-sm text-gray-400">v{sub.version}</span>}
        </h1>
        <StatusBadge status={sub.status} />
      </div>

      {/* Risk summary */}
      {perms && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">权限 & 风险</h3>
          <PermissionBadge permissions={perms} />
        </div>
      )}

      {/* Validation */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">自动校验</h3>
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
        {sub.validation.errors.length === 0 && (
          <p className="text-green-700 text-sm">✓ 全部校验通过</p>
        )}
      </div>

      {/* Publisher info */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">发布者信息</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>用户：{sub.user?.displayName ?? '—'} ({sub.user?.email ?? '—'})</p>
          <p>发布者名称：{sub.publisher ?? '—'}</p>
          {sub.submittedAt && (
            <p>提交时间：{new Date(sub.submittedAt).toLocaleString('zh-CN')}</p>
          )}
        </div>
      </div>

      {/* Package info */}
      {sub.package && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">包文件</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>文件名：{sub.package.filename}</p>
            <p>大小：{(sub.package.sizeBytes / 1024).toFixed(1)} KB</p>
            <p className="font-mono text-xs text-gray-400">SHA256: {sub.package.checksumSha256}</p>
          </div>
          {sub.fileEntries.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                查看文件列表（{sub.fileEntries.length} 个文件）
              </summary>
              <div className="mt-2 max-h-48 overflow-y-auto space-y-0.5">
                {sub.fileEntries.map((f) => (
                  <div key={f.path} className="font-mono text-xs text-gray-500 px-2 py-0.5 hover:bg-gray-50 rounded">
                    {f.path}
                    {f.sizeBytes !== undefined && (
                      <span className="text-gray-400 ml-2">{(f.sizeBytes / 1024).toFixed(1)}K</span>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Release notes */}
      {sub.releaseNotes && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">发布说明</h3>
          <p className="text-sm text-gray-600">{sub.releaseNotes}</p>
        </div>
      )}

      {/* Manifest */}
      {sub.manifest && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">manifest</h3>
          <JsonViewer value={sub.manifest as unknown as object} maxHeight="400px" />
        </div>
      )}

      {/* Actions */}
      {sub.status === 'pending_review' && (
        <div className="flex gap-3 justify-end mt-6 sticky bottom-4">
          <button
            onClick={() => { setRejectReason(''); setRejectModal(true); }}
            className="text-sm px-5 py-2.5 rounded-lg border border-red-300 text-red-600 bg-white hover:bg-red-50 shadow-sm"
          >
            拒绝
          </button>
          <button
            onClick={() => { if (confirm('确认通过此提交？')) approveMutation.mutate(); }}
            disabled={approveMutation.isPending || sub.validation.errors.length > 0}
            className="text-sm px-6 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 shadow-sm"
          >
            {approveMutation.isPending ? '处理中…' : '审核通过'}
          </button>
        </div>
      )}

      {sub.status === 'published' && (
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={() => { setRemoveReason(''); setRemoveModal(true); }}
            className="text-sm px-5 py-2.5 rounded-lg border border-orange-300 text-orange-600 hover:bg-orange-50"
          >
            下架此版本
          </button>
        </div>
      )}

      {/* Reject modal */}
      <Modal
        open={rejectModal}
        onClose={() => setRejectModal(false)}
        title="拒绝理由"
        footer={
          <>
            <button
              onClick={() => setRejectModal(false)}
              className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={() => rejectMutation.mutate()}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {rejectMutation.isPending ? '处理中…' : '确认拒绝'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600 mb-3">请填写拒绝原因，发布者将会看到此内容。</p>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={4}
          autoFocus
          placeholder="例如：manifest description 描述不够清晰，scripts 权限未说明用途…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
        {rejectMutation.isError && (
          <p className="text-red-600 text-sm mt-2">
            {rejectMutation.error instanceof Error ? rejectMutation.error.message : '操作失败'}
          </p>
        )}
      </Modal>

      {/* Remove modal */}
      <Modal
        open={removeModal}
        onClose={() => setRemoveModal(false)}
        title="下架此版本"
        footer={
          <>
            <button
              onClick={() => setRemoveModal(false)}
              className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={() => removeMutation.mutate()}
              disabled={!removeReason.trim() || removeMutation.isPending}
              className="text-sm px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {removeMutation.isPending ? '处理中…' : '确认下架'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600 mb-3">请填写下架原因（将记入审计日志）。</p>
        <textarea
          value={removeReason}
          onChange={(e) => setRemoveReason(e.target.value)}
          rows={3}
          autoFocus
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </Modal>
    </div>
  );
}
