import { useQuery } from '@tanstack/react-query';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { skillsApi } from '../../api/skills';
import ErrorState from '../../components/ErrorState';
import PermissionBadge from '../../components/PermissionBadge';
import KindBadge from '../../components/KindBadge';
import JsonViewer from '../../components/JsonViewer';
import { useAuth } from '../auth/useAuth';

type Tab = 'overview' | 'permissions' | 'versions' | 'manifest';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: '概览' },
  { id: 'permissions', label: '权限' },
  { id: 'versions', label: '版本' },
  { id: 'manifest', label: 'manifest' },
];

export default function SkillDetailPage() {
  const { publisher, name } = useParams<{ publisher: string; name: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const tab = (searchParams.get('tab') as Tab) ?? 'overview';

  const { data: skill, isLoading, isError, refetch } = useQuery({
    queryKey: ['skill', publisher, name],
    queryFn: () => skillsApi.detail(publisher!, name!),
    enabled: !!publisher && !!name,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  if (isError || !skill) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ErrorState message="无法加载 Skill 详情" onRetry={() => refetch()} />
      </div>
    );
  }

  const latest = skill.versions[0];
  const manifest = latest?.manifest;

  const setTab = (t: Tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', t);
      return next;
    });
  };

  const packageUrl = latest
    ? skillsApi.packageUrl(publisher!, name!, latest.version)
    : null;
  const canEdit = Boolean(user && publisher && (user.roles.includes('admin') || user.publishers.includes(publisher)));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6">
        <Link to="/" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">首页</Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <Link to="/skills" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">探索</Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-gray-900 dark:text-gray-100">{skill.id}</span>
      </div>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                {skill.displayName ?? skill.id}
              </h1>
              <KindBadge kind={skill.kind} />
            </div>
            <p className="text-gray-400 dark:text-gray-500 text-sm mb-2">{skill.id}</p>
            <p className="text-gray-600 dark:text-gray-300">{skill.description}</p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-gray-500 dark:text-gray-400">
              <span>作者：{skill.author.name}</span>
              {manifest?.license && <span>协议：{manifest.license}</span>}
              <span>最新版本：v{skill.latestVersion}</span>
              <span>更新：{new Date(skill.updatedAt).toLocaleDateString('zh-CN')}</span>
            </div>

            {skill.categories.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {skill.categories.map((c) => (
                  <Link
                    key={c}
                    to={`/skills?category=${encodeURIComponent(c)}`}
                    className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  >
                    {c}
                  </Link>
                ))}
                {skill.tags.map((t) => (
                  <Link
                    key={t}
                    to={`/skills?tag=${encodeURIComponent(t)}`}
                    className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {canEdit && (
              <Link
                to={`/publisher/skills/${publisher}/${name}/edit`}
                className="flex items-center gap-2 text-sm border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              >
                编辑
              </Link>
            )}
            {packageUrl && (
              <a
                href={packageUrl}
                download
                className="flex items-center gap-2 bg-blue-600 dark:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                下载包
              </a>
            )}
            <button
              onClick={() => setTab('manifest')}
              className="flex items-center gap-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              manifest
            </button>
          </div>
        </div>
      </div>

      {/* Install hint */}
      {latest && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-6 font-mono text-xs text-gray-700 dark:text-gray-300 flex items-center gap-2 overflow-x-auto">
          <span className="text-gray-400 dark:text-gray-500 shrink-0">安装 ID：</span>
          <code className="select-all">{skill.id}@{latest.version}</code>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'overview' && manifest && (
        <div className="space-y-6">
          {manifest.starterPrompts.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">示例提示词</h3>
              <div className="space-y-2">
                {manifest.starterPrompts.map((p, i) => (
                  <div key={i} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2.5 text-sm text-blue-900 dark:text-blue-200">
                    {p}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">运行时</h3>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">类型：</span>{manifest.runtime.type}
              {manifest.runtime.entrypoints.length > 0 && (
                <div className="mt-2 space-y-1">
                  {manifest.runtime.entrypoints.slice(0, 5).map((ep) => (
                    <div key={ep.name} className="bg-gray-50 dark:bg-gray-800 rounded px-3 py-1.5">
                      <code className="text-xs font-mono">{ep.name}</code>
                      {ep.description && <span className="ml-2 text-gray-500 dark:text-gray-400 text-xs">— {ep.description}</span>}
                    </div>
                  ))}
                  {manifest.runtime.entrypoints.length > 5 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">+ {manifest.runtime.entrypoints.length - 5} 个入口…</p>
                  )}
                </div>
              )}
            </div>
          </section>

          {(manifest.homepage || manifest.repository) && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">资源链接</h3>
              <div className="space-y-1 text-sm">
                {manifest.homepage && (
                  <a href={manifest.homepage} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline">
                    主页
                  </a>
                )}
                {manifest.repository && (
                  <a href={manifest.repository} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline">
                    代码仓库
                  </a>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'permissions' && manifest && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">权限声明</h3>
            <PermissionBadge permissions={manifest.permissions} />
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p>所有权限均由 Skill 作者声明，经审核后上架。高风险权限（scripts、网络访问）须人工复核。</p>
          </div>
        </div>
      )}

      {tab === 'versions' && (
        <VersionsTab publisher={publisher!} name={name!} />
      )}

      {tab === 'manifest' && manifest && (
        <div>
          <JsonViewer value={manifest as unknown as object} maxHeight="600px" />
        </div>
      )}
    </div>
  );
}

function VersionsTab({ publisher, name }: { publisher: string; name: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['skill-versions', publisher, name],
    queryFn: () => skillsApi.versions(publisher, name),
  });

  if (isLoading) return <div className="text-sm text-gray-500 dark:text-gray-400 py-4">加载中…</div>;
  if (isError) return <ErrorState message="版本加载失败" />;

  const versions = data?.versions ?? [];

  return (
    <div className="space-y-2">
      {versions.map((v) => (
        <div key={v.version} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="text-sm">
            <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">v{v.version}</span>
            <span className="text-gray-400 dark:text-gray-500 ml-3">
              {new Date(v.publishedAt).toLocaleDateString('zh-CN')}
            </span>
            {v.sizeBytes && (
              <span className="text-gray-400 dark:text-gray-500 ml-3">{(v.sizeBytes / 1024).toFixed(1)} KB</span>
            )}
            {v.checksumSha256 && (
              <code className="text-xs text-gray-400 dark:text-gray-500 ml-3 font-mono">
                sha256:{v.checksumSha256.slice(0, 12)}…
              </code>
            )}
          </div>
          <a
            href={skillsApi.packageUrl(publisher, name, v.version)}
            download
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline shrink-0"
          >
            下载
          </a>
        </div>
      ))}
    </div>
  );
}
