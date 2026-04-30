import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { publishKeysApi } from '../../api/publishKeys';
import { useAuth } from '../auth/useAuth';

function NewKeySecret({ secret, onDone }: { secret: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4 mb-6">
      <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Key 已创建，请立即复制保存，关闭后不再显示</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 rounded px-3 py-2 font-mono break-all select-all text-gray-900 dark:text-gray-100">
          {secret}
        </code>
        <button
          onClick={copy}
          className="shrink-0 text-xs bg-green-600 dark:bg-green-500 text-white px-3 py-2 rounded hover:bg-green-700 dark:hover:bg-green-600"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <button onClick={onDone} className="mt-3 text-xs text-green-700 dark:text-green-300 hover:underline">
        我已保存，关闭
      </button>
    </div>
  );
}

export default function PublishKeysPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPublisher, setFormPublisher] = useState(user?.publishers[0] ?? '');
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['publish-keys'],
    queryFn: () => publishKeysApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => publishKeysApi.create(formName.trim(), formPublisher),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['publish-keys'] });
      setNewSecret(res.publishKey.secret ?? null);
      setShowForm(false);
      setFormName('');
      setFormError('');
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => publishKeysApi.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['publish-keys'] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('请输入 Key 名称');
      return;
    }
    createMutation.mutate();
  };

  const keys = data?.publishKeys ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Publish Keys</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">用于 CI/CD 和自动化工具发布 Skill，无需账号密码</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            新建 Key
          </button>
        )}
      </div>

      {newSecret && (
        <NewKeySecret secret={newSecret} onDone={() => setNewSecret(null)} />
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6 bg-gray-50 dark:bg-gray-800">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">新建 Publish Key</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Key 名称</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例如：GitHub Actions"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Publisher</label>
              <select
                value={formPublisher}
                onChange={(e) => setFormPublisher(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {(user?.publishers ?? []).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            {formError && <p className="text-xs text-red-500 dark:text-red-400">{formError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="text-sm bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
              >
                {createMutation.isPending ? '创建中...' : '创建'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormError(''); }}
                className="text-sm text-gray-600 dark:text-gray-400 px-4 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                取消
              </button>
            </div>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">加载中...</p>
      ) : keys.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p className="text-sm">还没有 Publish Key</p>
          <p className="text-xs mt-1">创建一个 Key 用于 CI/CD 自动发布</p>
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2 px-4">名称</th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider py-2 px-4">状态</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 px-4">
              {keys.map((k) => (
                <tr key={k.id} className={k.revokedAt ? 'opacity-50' : ''}>
                  <td className="py-3 px-4">
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{k.name}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {k.publisher} · 创建于 {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt && ` · 最近使用 ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {k.revokedAt ? (
                      <span className="text-red-500 dark:text-red-400">已撤销</span>
                    ) : k.expiresAt && Date.parse(k.expiresAt) <= Date.now() ? (
                      <span className="text-yellow-600 dark:text-yellow-400">已过期</span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">有效</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {!k.revokedAt && (
                      <button
                        onClick={() => revokeMutation.mutate(k.id)}
                        disabled={revokeMutation.isPending}
                        className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                      >
                        撤销
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">使用方法</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">将 Key 作为 Bearer Token 用于发布请求：</p>
        <code className="block text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 font-mono text-gray-900 dark:text-gray-100">
          Authorization: Bearer skpub_...
        </code>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          详见 <a href="/docs" className="text-blue-500 dark:text-blue-400 hover:underline">/docs</a> 页面的完整发布协议说明。
        </p>
      </div>
    </div>
  );
}
