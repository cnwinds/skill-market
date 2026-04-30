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

function CommandExample({ title, command, desc }: { title: string; command: string; desc: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{desc}</p>
        </div>
        <CopyButton value={command} idleLabel="复制" />
      </div>
      <div className="rounded-md bg-white px-3 py-2 font-mono text-xs text-gray-800 dark:bg-gray-950 dark:text-gray-200">
        {command}
      </div>
    </div>
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
  const toolPrompt = `请读取市场发现文件，后续按我给的命令安装或上传 Skill。

市场发现文件：${discoveryUrl}

安装时下载后校验 X-Skill-Sha256；如果不知道本地 Skill 安装目录，先问我。
上传时不要把 Publish Key 或 Developer Key 写进代码、仓库、日志或 URL query。`;

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

        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/30">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">1. 复制基础提示词</h3>
                <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  先贴给工具一次。工具会读取市场发现文件，之后就能按你的命令安装或上传。
                </p>
              </div>
              <CopyButton value={toolPrompt} idleLabel="复制提示词" />
            </div>
            <pre className="max-h-40 overflow-auto rounded-md bg-white p-3 font-mono text-xs leading-relaxed text-gray-700 dark:bg-gray-900 dark:text-gray-300">
              {toolPrompt}
            </pre>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">2. 复制一条命令</h3>
              <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                基础提示词贴完后，再复制下面任意一条给工具。
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <CommandExample
                title="安装指定 Skill"
                desc="已知道 publisher/name 时使用。"
                command="安装Skill：official/xlsx"
              />
              <CommandExample
                title="搜索并安装"
                desc="只知道关键词时使用。"
                command="搜索并安装Skill：pdf"
              />
              <CommandExample
                title="上传正式版"
                desc="需要 Publish Key，提交后进入审核。"
                command="上传Skill：C:\\path\\package.tgz，Publish Key：skpub_..."
              />
              <CommandExample
                title="安装开发版"
                desc="需要 Developer Key，只用于本地测试。"
                command="安装开发版Skill：official/xlsx@0.1.1，Developer Key：skdev_..."
              />
            </div>
          </div>
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
