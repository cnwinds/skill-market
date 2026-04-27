# SkillMarket 首轮实现任务

## 写入范围

本项目只写：

```text
C:\projects\skill-market
```

不要修改：

```text
C:\projects\qizhi
C:\projects\skill-chat
C:\projects\official-skills
```

## 目标

实现一个可被 SkillChat 调用的只读 SkillMarket MVP。

## 必做

1. 完成 `packages/skill-spec` 构建与测试。
2. 新建 `apps/server`，使用 Fastify 或项目内最小 Node HTTP 服务均可，优先 Fastify + TypeScript。
3. 实现本地 registry 扫描：

```text
registry/skills/{publisher}/{name}/{version}/manifest.json
registry/skills/{publisher}/{name}/{version}/package.tgz
```

4. 实现 API：

```text
GET /health
GET /api/v1/skills
GET /api/v1/skills/:publisher/:name
GET /api/v1/skills/:publisher/:name/versions
GET /api/v1/skills/:publisher/:name/versions/:version/manifest
GET /api/v1/skills/:publisher/:name/versions/:version/package
```

5. API 返回结构必须使用 `@qizhi/skill-spec` schema 校验。
6. 增加测试覆盖 registry 扫描和至少 3 个 API。
7. 更新 `docs/HANDOFF.md`，说明如何运行服务。

## 可选

- 做一个极简 `apps/web` 列表页。
- 增加导入 official-skills dist 包的 CLI。

## 禁止

- 不要设计第二套 manifest 字段。
- 不要在市场服务里执行 skill 脚本。
- 不要直接依赖 SkillChat 的数据库或代码。

## 验收

```powershell
npm install
npm run build
npm test
```

