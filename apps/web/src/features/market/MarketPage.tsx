import { useQuery } from '@tanstack/react-query';

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-xs font-mono leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">{title}</h2>
      {children}
    </section>
  );
}

function Field({ name, desc }: { name: string; desc: string }) {
  return (
    <tr>
      <td className="py-1.5 pr-4 align-top">
        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-800">{name}</code>
      </td>
      <td className="py-1.5 text-sm text-gray-600">{desc}</td>
    </tr>
  );
}

export default function MarketPage() {
  const { data: rawMd, isLoading, error } = useQuery<string>({
    queryKey: ['market-md'],
    queryFn: async () => {
      const res = await fetch('/market.md');
      if (!res.ok) throw new Error('Failed to fetch market.md');
      return res.text();
    },
    staleTime: 60_000,
  });

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">SkillMarket 协议</h1>
        <p className="text-gray-500 mt-2 text-sm">
          工具通过 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">/market.md</code> 发现本 market 的安装和发布端点。
        </p>
      </div>

      <Section title="market.md 文件">
        <p className="text-sm text-gray-600 mb-3">
          工具通过 <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">GET /market.md</code> 获取本文件，解析其中的 <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">skill-market</code> 代码块来发现端点。
        </p>
        {isLoading && <p className="text-sm text-gray-400">加载中...</p>}
        {error && <p className="text-sm text-red-500">加载失败</p>}
        {rawMd && (
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-200">
              <span className="text-xs text-gray-500 font-mono">GET /market.md</span>
              <a
                href="/market.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline"
              >
                查看原始文件
              </a>
            </div>
            <pre className="p-4 text-xs font-mono text-gray-700 overflow-x-auto leading-relaxed bg-white max-h-64 overflow-y-auto">
              {rawMd}
            </pre>
          </div>
        )}
      </Section>

      <Section title="安装 Skill">
        <p className="text-sm text-gray-600 mb-4">安装不需要认证，直接调用公开 API。</p>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">1. 搜索 Skill</p>
            <CodeBlock>{`GET ${baseUrl}/api/v1/skills?query=pdf&kind=instruction`}</CodeBlock>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">2. 下载包</p>
            <CodeBlock>{`GET ${baseUrl}/api/v1/skills/{publisher}/{name}/versions/{version}/package`}</CodeBlock>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          响应头包含 <code className="font-mono">X-Skill-Sha256</code>，下载后请验证校验和。
        </p>
      </Section>

      <Section title="发布 Skill">
        <p className="text-sm text-gray-600 mb-4">发布需要认证。推荐使用 Publish Key，适合 CI/CD 和自动化工具。</p>

        <h3 className="text-sm font-semibold text-gray-800 mb-2">认证方式一：Publish Key（推荐）</h3>
        <p className="text-sm text-gray-600 mb-2">
          在 <a href="/publisher/keys" className="text-blue-500 hover:underline">发布者控制台 → Publish Keys</a> 创建 Key，然后用作 Bearer Token：
        </p>
        <CodeBlock>{`Authorization: Bearer skpub_...`}</CodeBlock>

        <h3 className="text-sm font-semibold text-gray-800 mt-5 mb-2">认证方式二：登录获取 Token</h3>
        <CodeBlock>{`POST ${baseUrl}/api/v1/auth/login
Content-Type: application/json

{ "email": "you@example.com", "password": "..." }

# 响应中的 token 字段即为 Bearer Token`}</CodeBlock>

        <h3 className="text-sm font-semibold text-gray-800 mt-6 mb-3">发布流程</h3>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">1. 上传包</p>
            <CodeBlock>{`POST ${baseUrl}/api/v1/publisher/submissions
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: package.tgz   # 或 package.zip`}</CodeBlock>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">2. 提交审核</p>
            <CodeBlock>{`POST ${baseUrl}/api/v1/publisher/submissions/{id}/submit
Authorization: Bearer <token>`}</CodeBlock>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">3. 查询状态</p>
            <CodeBlock>{`GET ${baseUrl}/api/v1/publisher/submissions/{id}
Authorization: Bearer <token>

# status: draft → pending_review → published | rejected`}</CodeBlock>
          </div>
        </div>
      </Section>

      <Section title="包格式">
        <p className="text-sm text-gray-600 mb-3">
          Skill 包是 <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">.tgz</code> 或 <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">.zip</code> 文件，根目录必须包含 manifest 文件：
        </p>
        <table className="w-full text-sm mb-3">
          <tbody>
            <Field name="skill.json" desc="Skill manifest（推荐路径）" />
            <Field name="manifest.json" desc="Skill manifest（备用路径）" />
            <Field name="package/skill.json" desc="嵌套在 package/ 目录下也支持" />
          </tbody>
        </table>
        <p className="text-sm text-gray-600 mb-2">manifest 必填字段：</p>
        <table className="w-full text-sm">
          <tbody>
            <Field name="skillSpecVersion" desc='"1.0"' />
            <Field name="id" desc="publisher/name 格式，例如 alice/pdf-reader" />
            <Field name="name" desc="小写字母和连字符，2-64 字符" />
            <Field name="version" desc="语义化版本，例如 1.0.0" />
            <Field name="kind" desc="instruction | runtime | hybrid" />
            <Field name="description" desc="1-500 字符" />
            <Field name="author.name" desc="作者名称" />
          </tbody>
        </table>
      </Section>
    </div>
  );
}
