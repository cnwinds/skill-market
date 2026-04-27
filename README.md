# SkillMarket

源码仓库：<https://github.com/cnwinds/skill-market>

SkillMarket 是 Skill 的市场、版本和分发系统。它不执行 Skill，不管理聊天会话，也不读取用户文件。

## 三仓库关系

当前 Skill 系统拆成三个独立仓库：

```text
skill-market
  仓库：https://github.com/cnwinds/skill-market
  职责：Skill 市场、版本分发、Market API、@qizhi/skill-spec 契约源头。

official-skills
  仓库：https://github.com/cnwinds/official-skills
  职责：官方 Skill 源码、skill.json、SKILL.md、脚本、参考资料、校验和打包。

skill-chat
  仓库：https://github.com/cnwinds/skill-chat
  职责：聊天应用、用户会话、Skill 安装、会话启用、运行本地已安装 Skill。
```

本地开发推荐三个项目并列放置：

```text
C:\projects\skill-market
C:\projects\official-skills
C:\projects\skill-chat
```

修改规则：

- 契约字段、manifest schema、Market API 类型先改本仓库的 `packages/skill-spec`。
- 官方 Skill 内容只改 `official-skills/skills/*`，不要在 Market 中手写 Skill 源码。
- SkillChat 只消费 Market API 和安装包，不在聊天应用中私自发明市场字段。
- 详细边界见 `PROJECT_DESIGN.md`。

## 目录

```text
apps/server              Market API 服务
packages/skill-spec      三项目共享契约源头
registry/skills          第一阶段本地文件 registry
scripts                  官方包导入等脚本
docs                     交接和 API 文档
```

## 开发命令

```bash
npm install
npm run typecheck
npm test
```

从 `official-skills/dist` 导入官方打包产物：

```bash
npm run import:official
```

## API

第一阶段只提供安装所需只读接口：

```text
GET /api/v1/skills
GET /api/v1/skills/{publisher}/{name}
GET /api/v1/skills/{publisher}/{name}/versions
GET /api/v1/skills/{publisher}/{name}/versions/{version}/manifest
GET /api/v1/skills/{publisher}/{name}/versions/{version}/package
```
