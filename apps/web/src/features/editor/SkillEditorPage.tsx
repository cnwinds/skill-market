import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { editorApi } from '../../api/editor';
import { useAuth } from '../auth/useAuth';
import ErrorState from '../../components/ErrorState';
import type { MarketWorkspaceFileEntry } from '@qizhi/skill-spec';

export default function SkillEditorPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [currentDir, setCurrentDir] = useState('');
  const [currentFile, setCurrentFile] = useState('');
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: ['edit-workspace', id],
    queryFn: () => editorApi.getWorkspace(id!),
    enabled: !!id,
  });

  const workspace = workspaceQuery.data?.workspace;
  const isAdmin = user?.roles.includes('admin') ?? false;

  const filesQuery = useQuery({
    queryKey: ['edit-workspace-files', id, currentDir],
    queryFn: () => editorApi.listFiles(id!, currentDir),
    enabled: !!id,
  });

  const contentQuery = useQuery({
    queryKey: ['edit-workspace-file', id, currentFile],
    queryFn: () => editorApi.readFile(id!, currentFile),
    enabled: !!id && !!currentFile,
  });

  const devReleasesQuery = useQuery({
    queryKey: ['edit-workspace-dev-releases', id],
    queryFn: () => editorApi.listDevReleases(id!),
    enabled: !!id,
  });

  const developerKeysQuery = useQuery({
    queryKey: ['developer-keys', workspace?.skillId],
    queryFn: () => editorApi.listDeveloperKeys(workspace!.skillId),
    enabled: !!workspace?.skillId,
  });

  useEffect(() => {
    if (contentQuery.data) {
      setDraft(contentQuery.data.content);
      setDirty(false);
    }
  }, [contentQuery.data]);

  useEffect(() => {
    if (!currentFile && filesQuery.data?.entries.length) {
      const preferred = filesQuery.data.entries.find((entry) => entry.kind === 'file' && entry.name === 'skill.json')
        ?? filesQuery.data.entries.find((entry) => entry.kind === 'file' && entry.name === 'manifest.json')
        ?? filesQuery.data.entries.find((entry) => entry.kind === 'file' && entry.editable);
      if (preferred) setCurrentFile(preferred.path);
    }
  }, [currentFile, filesQuery.data]);

  const refreshWorkspace = () => {
    queryClient.invalidateQueries({ queryKey: ['edit-workspace', id] });
    queryClient.invalidateQueries({ queryKey: ['edit-workspace-files', id] });
    queryClient.invalidateQueries({ queryKey: ['edit-workspace-file', id, currentFile] });
  };

  const saveMutation = useMutation({
    mutationFn: () => editorApi.writeFile(id!, currentFile, draft, workspace!.revision),
    onSuccess: () => {
      setDirty(false);
      refreshWorkspace();
    },
  });

  const validateMutation = useMutation({
    mutationFn: () => editorApi.validate(id!),
    onSuccess: () => refreshWorkspace(),
  });

  const submitMutation = useMutation({
    mutationFn: () => editorApi.submit(id!, undefined, 'Submitted from online editor.'),
    onSuccess: () => refreshWorkspace(),
  });

  const createDevMutation = useMutation({
    mutationFn: (version?: string) => editorApi.createDevRelease(id!, version),
    onSuccess: () => {
      refreshWorkspace();
      queryClient.invalidateQueries({ queryKey: ['edit-workspace-dev-releases', id] });
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => editorApi.createDeveloperKey(name, workspace!.skillId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['developer-keys', workspace?.skillId] }),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: editorApi.revokeDeveloperKey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['developer-keys', workspace?.skillId] }),
  });

  const createFileMutation = useMutation({
    mutationFn: (input: { path: string; kind: 'file' | 'directory' }) =>
      editorApi.createFile(id!, input.path, input.kind, workspace!.revision),
    onSuccess: () => refreshWorkspace(),
  });

  const deleteFileMutation = useMutation({
    mutationFn: (path: string) => editorApi.deleteFile(id!, path, workspace!.revision),
    onSuccess: () => {
      setCurrentFile('');
      refreshWorkspace();
    },
  });

  const validation = validateMutation.data?.validation ?? workspace?.validation;
  const currentEntries = filesQuery.data?.entries ?? [];
  const parentDir = useMemo(() => {
    if (!currentDir) return '';
    const parts = currentDir.split('/');
    parts.pop();
    return parts.join('/');
  }, [currentDir]);

  if (workspaceQuery.isLoading) {
    return <div className="max-w-7xl mx-auto px-4 py-8 text-sm text-gray-500">加载中...</div>;
  }

  if (workspaceQuery.isError || !workspace) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ErrorState message="无法加载编辑工作区" onRetry={() => workspaceQuery.refetch()} />
      </div>
    );
  }

  const handleNewFile = () => {
    const name = prompt('文件路径');
    if (!name) return;
    createFileMutation.mutate({ path: name, kind: 'file' });
  };

  const handleNewDirectory = () => {
    const name = prompt('目录路径');
    if (!name) return;
    createFileMutation.mutate({ path: name, kind: 'directory' });
  };

  const handleCreateDev = () => {
    const version = prompt('开发版本', workspace.targetVersion);
    if (!version) return;
    createDevMutation.mutate(version);
  };

  const handleCreateKey = () => {
    const name = prompt('Key 名称', 'Local SkillChat');
    if (!name) return;
    createKeyMutation.mutate(name);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to={`/skills/${workspace.publisher}/${workspace.name}`} className="hover:text-gray-700">
              {workspace.skillId}
            </Link>
            <span>/</span>
            <span>v{workspace.sourceVersion}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">编辑 v{workspace.targetVersion}</h1>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{workspace.status}</span>
            {dirty && <span className="text-xs text-orange-600">未保存</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => validateMutation.mutate()}
            disabled={validateMutation.isPending}
            className="text-sm px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            校验
          </button>
          <button
            onClick={handleCreateDev}
            disabled={createDevMutation.isPending}
            className="text-sm px-3 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            生成开发版本
          </button>
          <button
            onClick={() => {
              if (confirm('提交审核？')) submitMutation.mutate();
            }}
            disabled={submitMutation.isPending}
            className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            提交审核
          </button>
          {isAdmin && (
            <span className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-1">Admin</span>
          )}
        </div>
      </div>

      {(saveMutation.isError || validateMutation.isError || createDevMutation.isError || submitMutation.isError) && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          {[
            saveMutation.error,
            validateMutation.error,
            createDevMutation.error,
            submitMutation.error,
          ].find(Boolean) instanceof Error
            ? ([saveMutation.error, validateMutation.error, createDevMutation.error, submitMutation.error].find(Boolean) as Error).message
            : '操作失败'}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px] gap-4">
        <aside className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700">文件</span>
            <div className="flex gap-1">
              <button onClick={handleNewFile} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">
                文件
              </button>
              <button onClick={handleNewDirectory} className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">
                目录
              </button>
            </div>
          </div>
          <div className="px-3 py-2 border-b border-gray-100 text-xs text-gray-500 flex items-center gap-2">
            {currentDir && (
              <button onClick={() => setCurrentDir(parentDir)} className="text-blue-600 hover:underline">
                上级
              </button>
            )}
            <span className="truncate">{currentDir || '/'}</span>
          </div>
          <div className="max-h-[640px] overflow-auto p-2">
            {currentEntries.map((entry) => (
              <FileRow
                key={entry.path}
                entry={entry}
                active={entry.path === currentFile}
                onOpen={() => {
                  if (entry.kind === 'directory') setCurrentDir(entry.path);
                  else setCurrentFile(entry.path);
                }}
                onDelete={() => {
                  if (confirm(`删除 ${entry.path}？`)) deleteFileMutation.mutate(entry.path);
                }}
              />
            ))}
          </div>
        </aside>

        <main className="bg-white border border-gray-200 rounded-lg overflow-hidden min-h-[640px]">
          <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-200">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{currentFile || '未选择文件'}</p>
              {contentQuery.data && (
                <p className="text-xs text-gray-400">revision {contentQuery.data.revision}</p>
              )}
            </div>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!currentFile || !dirty || saveMutation.isPending}
              className="text-sm px-4 py-1.5 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40"
            >
              保存
            </button>
          </div>
          {currentFile ? (
            <textarea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setDirty(true);
              }}
              spellCheck={false}
              className="w-full h-[590px] p-4 font-mono text-sm text-gray-800 outline-none resize-none"
            />
          ) : (
            <div className="p-8 text-sm text-gray-500">选择一个文本文件</div>
          )}
        </main>

        <aside className="space-y-4 lg:col-span-2 xl:col-span-1">
          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">校验</h2>
            {!validation ? (
              <p className="text-sm text-gray-500">暂无结果</p>
            ) : (
              <div className="space-y-3">
                <div className={`text-sm font-medium ${validation.valid ? 'text-green-700' : 'text-red-700'}`}>
                  {validation.valid ? '通过' : '未通过'}
                </div>
                {validation.errors.length > 0 && (
                  <IssueList title="错误" items={validation.errors.map((item) => item.message)} tone="red" />
                )}
                {validation.warnings.length > 0 && (
                  <IssueList title="警告" items={validation.warnings.map((item) => item.message)} tone="yellow" />
                )}
              </div>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">开发版本</h2>
              <button onClick={handleCreateDev} className="text-xs text-blue-600 hover:underline">
                生成
              </button>
            </div>
            <div className="space-y-2">
              {(devReleasesQuery.data?.devReleases ?? []).slice(0, 5).map((release) => (
                <div key={release.id} className="border border-gray-100 rounded px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono text-gray-800">{release.version}</code>
                    <span className="text-xs text-gray-400">{release.status}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(release.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              ))}
              {devReleasesQuery.data?.devReleases.length === 0 && (
                <p className="text-sm text-gray-500">暂无开发版本</p>
              )}
            </div>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-800">开发者 Key</h2>
              <button onClick={handleCreateKey} className="text-xs text-blue-600 hover:underline">
                新建
              </button>
            </div>
            <div className="space-y-2">
              {(developerKeysQuery.data?.developerKeys ?? []).map((key) => (
                <div key={key.id} className="border border-gray-100 rounded px-3 py-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-700">{key.name}</span>
                    <button
                      onClick={() => revokeKeyMutation.mutate(key.id)}
                      disabled={Boolean(key.revokedAt)}
                      className="text-xs text-red-600 hover:underline disabled:text-gray-300"
                    >
                      吊销
                    </button>
                  </div>
                  <code className="block text-xs font-mono text-gray-500 break-all select-all">{key.secret}</code>
                </div>
              ))}
              {developerKeysQuery.data?.developerKeys.length === 0 && (
                <p className="text-sm text-gray-500">暂无 Key</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function FileRow({
  entry,
  active,
  onOpen,
  onDelete,
}: {
  entry: MarketWorkspaceFileEntry;
  active: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
        active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <button onClick={onOpen} className="flex-1 min-w-0 text-left truncate">
        <span className="text-gray-400 mr-1">{entry.kind === 'directory' ? '▸' : '•'}</span>
        {entry.name}
      </button>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-700"
      >
        删除
      </button>
    </div>
  );
}

function IssueList({ title, items, tone }: { title: string; items: string[]; tone: 'red' | 'yellow' }) {
  const classes = tone === 'red'
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-yellow-50 border-yellow-200 text-yellow-700';
  return (
    <div className={`border rounded p-3 ${classes}`}>
      <p className="text-xs font-medium mb-1">{title}</p>
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li key={index} className="text-xs">{item}</li>
        ))}
      </ul>
    </div>
  );
}
