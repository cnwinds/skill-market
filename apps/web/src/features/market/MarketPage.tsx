import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import CopyButton from '../../components/CopyButton';

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
      {children}
    </code>
  );
}

function ActionLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
    >
      {children}
    </Link>
  );
}

export default function MarketPage() {
  const { data: rawMd, isLoading, error } = useQuery<string>({
    queryKey: ['skill-market-md'],
    queryFn: async () => {
      const res = await fetch('/.well-known/skill-market.md');
      if (!res.ok) throw new Error('Failed to fetch discovery file');
      return res.text();
    },
    staleTime: 60_000,
  });

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const discoveryUrl = `${baseUrl}/.well-known/skill-market.md`;
  const toolPrompt = `你是一个 SkillMarket 自动化助手。下面是这个市场的发现文件内容，请先理解其中的安装和发布接口。之后我只会告诉你我要安装哪个 Skill，或者我要上传哪个本地包，你按发现文件里的接口自动完成。

使用规则：
1. 安装正式版 Skill：搜索或解析 publisher/name，下载最新版本 package，校验 X-Skill-Sha256，然后安装到当前工具支持的 Skill 目录；如果不知道目录，先问我。
2. 上传正式版 Skill：使用我提供的 skpub_ Publish Key，按 Authorization: Bearer {key} 请求；multipart/form-data 的文件字段必须叫 file；预检有 errors 就停止；通过后提交审核并告诉我 submission id 和状态。
3. 安装开发版 Skill：必须使用我提供的 skdev_ Developer Key，请求头是 X-Skill-Dev-Key；开发版只用于本地测试，不要当成正式版本。
4. 不要把 key 写进代码、仓库、日志或 URL query。

${rawMd ?? `请读取 ${discoveryUrl} 获取发现文件。`}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link to="/" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">首页</Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-gray-900 dark:text-gray-100">开发文档</span>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">开发文档</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">
          只需要选一种方式：给工具用就复制提示词；人工操作就点页面入口。
        </p>
      </div>

      <section className="mb-10">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">for tools</p>
        <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">给工具用</h2>
          <CopyButton value={toolPrompt} idleLabel="复制工具提示词" />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">1. 复制</div>
              <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                点击上面的“复制工具提示词”。提示词里已经包含市场发现文件内容。
              </p>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">2. 粘贴</div>
              <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                贴到 Claude Code、SkillChat 或其他能联网/读写文件的工具。
              </p>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">3. 下命令</div>
              <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                例如：安装 <InlineCode>official/xlsx</InlineCode>，或上传 <InlineCode>package.tgz</InlineCode>。
              </p>
            </div>
          </div>
          <pre className="mt-4 max-h-48 overflow-auto rounded-md bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-700 dark:bg-gray-900 dark:text-gray-300">
            {toolPrompt}
          </pre>
        </div>
      </section>

      <section className="mb-10">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">for humans</p>
        <h2 className="mb-4 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">人工操作</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">安装正式版 Skill</h3>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
              去探索页，打开 Skill 详情，下载包，然后导入本地工具。
            </p>
            <div className="mt-4">
              <ActionLink to="/skills">去探索</ActionLink>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">上传正式版 Skill</h3>
            <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
              登录后上传包，预检通过后提交审核。自动化发布先创建 Publish Key。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionLink to="/publish">上传 Skill</ActionLink>
              <Link to="/publisher/keys" className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
                Publish Keys
              </Link>
            </div>
          </div>
        </div>
      </section>

      <details className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
          工具调试信息
        </summary>
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <p className="mb-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
            工具优先读取 <InlineCode>/.well-known/skill-market.md</InlineCode>。人工用户通常不需要看这里。
          </p>
          {isLoading && <p className="text-sm text-gray-400 dark:text-gray-500">加载中...</p>}
          {error && <p className="text-sm text-red-500">加载失败</p>}
          {rawMd && (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">GET /.well-known/skill-market.md</span>
                <CopyButton value={rawMd} idleLabel="复制 md" />
              </div>
              <pre className="max-h-80 overflow-auto rounded-md bg-gray-50 p-3 font-mono text-xs leading-relaxed text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                {rawMd}
              </pre>
            </>
          )}
        </div>
      </details>
    </div>
  );
}
