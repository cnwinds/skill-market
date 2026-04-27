# SkillMarket Handoff

## 当前交付

- `@qizhi/skill-spec` 是共享契约包，提供 manifest、market summary、version、detail、list response 等 Zod schema 和 TypeScript 类型。
- `apps/server` 是只读 SkillMarket MVP，使用 Fastify + TypeScript。
- server 只扫描本地文件 registry，不执行 skill 脚本，不读取 SkillChat 数据。
- 本地 fixture 位于 `registry/skills/official/hello/1.0.0`，包含 `manifest.json` 和 `package.tgz`。
- 可用 `npm run import:official -- ..\official-skills\dist` 把 Official Skills 产物导入本地 registry。

## Registry 布局

```text
registry/
  skills/
    {publisher}/
      {name}/
        {version}/
          manifest.json
          package.tgz
```

`manifest.json` 必须能通过 `@qizhi/skill-spec` 的 `skillManifestSchema` 校验。目录中的 `{publisher}/{name}/{version}` 必须和 manifest 的 `id`、`version` 一致。

## API

```text
GET /health
GET /api/v1/skills
GET /api/v1/skills/:publisher/:name
GET /api/v1/skills/:publisher/:name/versions
GET /api/v1/skills/:publisher/:name/versions/:version/manifest
GET /api/v1/skills/:publisher/:name/versions/:version/package
```

JSON API 返回前会使用 `@qizhi/skill-spec` schema 校验。`/package` 返回 `application/gzip` 的 `package.tgz` 文件流。

## 运行

```powershell
npm install
npm run build
npm run start --workspace @qizhi/skill-market-server
```

默认监听：

```text
http://127.0.0.1:3100
```

可通过环境变量覆盖：

```powershell
$env:PORT = "3200"
$env:HOST = "127.0.0.1"
npm run start --workspace @qizhi/skill-market-server
```

## 验证

```powershell
npm install
npm run build
npm run typecheck
npm test
npm run import:official -- ..\official-skills\dist
```

已覆盖：

- `packages/skill-spec` schema 解析、market list response、id helper。
- `apps/server` registry 扫描、skill/package 查找。
- `apps/server` 的 `/health`、`/api/v1/skills`、detail、versions、manifest、package API。
