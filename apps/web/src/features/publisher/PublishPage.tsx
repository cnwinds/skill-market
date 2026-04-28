import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { publisherApi } from '../../api/publisher';
import type { MarketSubmission } from '@qizhi/skill-spec';
import PermissionBadge from '../../components/PermissionBadge';

const MAX_SIZE_MB = 20;

export default function PublishPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [submission, setSubmission] = useState<MarketSubmission | null>(null);
  const [releaseNotes, setReleaseNotes] = useState('');
  const [changeNotes, setChangeNotes] = useState('');
  const [confirmOwnership, setConfirmOwnership] = useState(false);
  const [confirmSpec, setConfirmSpec] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: (f: File) => publisherApi.uploadSubmission(f),
    onSuccess: (res) => setSubmission(res.submission),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      publisherApi.submitForReview(submission!.id, releaseNotes || undefined, changeNotes || undefined),
    onSuccess: (res) => navigate(`/publisher/submissions/${res.submission.id}`),
  });

  const handleFile = (f: File) => {
    setFileError('');
    if (!f.name.endsWith('.tgz')) {
      setFileError('只支持 .tgz 格式');
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileError(`文件大小不能超过 ${MAX_SIZE_MB}MB`);
      return;
    }
    setFile(f);
    setSubmission(null);
    uploadMutation.mutate(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const canSubmit = submission && confirmOwnership && confirmSpec && !submitMutation.isPending;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">提交 Skill</h1>
      <p className="text-gray-500 text-sm mb-8">上传 .tgz 包，经审核通过后即可公开发布。</p>

      {/* Upload zone */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">1. 选择包文件</h2>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".tgz"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />
          <div className="text-3xl mb-2">📦</div>
          {file ? (
            <div>
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 text-sm">拖拽或点击选择 .tgz 文件</p>
              <p className="text-gray-400 text-xs mt-1">最大 {MAX_SIZE_MB}MB</p>
            </div>
          )}
        </div>
        {fileError && <p className="text-red-600 text-sm mt-2">{fileError}</p>}
        {uploadMutation.isPending && (
          <p className="text-blue-600 text-sm mt-2 animate-pulse">上传中，解析包…</p>
        )}
        {uploadMutation.isError && (
          <p className="text-red-600 text-sm mt-2">
            上传失败：{uploadMutation.error instanceof Error ? uploadMutation.error.message : '请重试'}
          </p>
        )}
      </section>

      {/* Pre-check results */}
      {submission && (
        <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">2. 预检结果</h2>

          {submission.validation.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
              <p className="text-red-700 text-sm font-medium mb-1">存在错误（无法提交）</p>
              <ul className="text-red-600 text-sm space-y-0.5">
                {submission.validation.errors.map((e, i) => (
                  <li key={i}>• {e.message}</li>
                ))}
              </ul>
            </div>
          )}

          {submission.validation.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
              <p className="text-yellow-700 text-sm font-medium mb-1">警告</p>
              <ul className="text-yellow-600 text-sm space-y-0.5">
                {submission.validation.warnings.map((w, i) => (
                  <li key={i}>• {w.message}</li>
                ))}
              </ul>
            </div>
          )}

          {submission.validation.valid && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
              <p className="text-green-700 text-sm font-medium">✓ 包格式校验通过</p>
            </div>
          )}

          {submission.manifest && (
            <div className="space-y-3 text-sm">
              <div className="flex gap-4 flex-wrap text-gray-600">
                <span><strong>ID：</strong>{submission.manifest.id}</span>
                <span><strong>版本：</strong>{submission.manifest.version}</span>
                <span><strong>类型：</strong>{submission.manifest.kind}</span>
              </div>
              {submission.package && (
                <div className="flex gap-4 flex-wrap text-gray-500 text-xs font-mono">
                  <span>大小：{(submission.package.sizeBytes / 1024).toFixed(1)} KB</span>
                  <span>SHA256：{submission.package.checksumSha256.slice(0, 16)}…</span>
                </div>
              )}
              {submission.manifest.permissions && (
                <div>
                  <p className="text-gray-600 mb-1">权限：</p>
                  <PermissionBadge permissions={submission.manifest.permissions} />
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Release notes + confirmation */}
      {submission?.validation.valid && (
        <section className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">3. 补充信息</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                发布说明 <span className="text-gray-400 font-normal">（选填）</span>
              </label>
              <textarea
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                rows={3}
                placeholder="描述此次发布的内容…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                变更说明 <span className="text-gray-400 font-normal">（新版本建议填写）</span>
              </label>
              <textarea
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                rows={2}
                placeholder="相比上个版本的主要变更…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmOwnership}
                  onChange={(e) => setConfirmOwnership(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-sm text-gray-700">
                  我确认拥有发布此 Skill 的权限，或已获得相应授权
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmSpec}
                  onChange={(e) => setConfirmSpec(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-sm text-gray-700">
                  我已阅读并遵守 SkillMarket Skill 发布规范
                </span>
              </label>
            </div>
          </div>
        </section>
      )}

      {submitMutation.isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          提交失败：{submitMutation.error instanceof Error ? submitMutation.error.message : '请重试'}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button
          onClick={() => navigate('/publisher/skills')}
          className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          取消
        </button>
        <button
          disabled={!canSubmit}
          onClick={() => submitMutation.mutate()}
          className="text-sm bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitMutation.isPending ? '提交中…' : '提交审核'}
        </button>
      </div>
    </div>
  );
}
