# SkillMarket 核心设计

## 定位

SkillMarket 是 skill 的市场、版本和分发系统。它不执行 skill，不保存 SkillChat 用户会话，也不参与模型运行。

## 职责

- 管理 skill 列表、详情、版本和包下载。
- 维护 `@qizhi/skill-spec` 契约包。
- 校验上传或本地导入的 skill 包。
- 对外提供稳定 Market API。
- 后续支持发布、审核、下架、作者后台、使用统计。

## 非职责

- 不执行 scripts。
- 不管理 SkillChat 会话。
- 不读取 SkillChat 用户文件。
- 不决定用户当前会话启用哪些 skill。

## 第一阶段目录

```text
skill-market/
  apps/
    server/
    web/
  packages/
    skill-spec/
  registry/
    skills/
  docs/
```

第一阶段可以先只实现 server 和 skill-spec，web 可以是轻量列表页或延后。

## API

只读 API：

```text
GET /api/v1/skills
GET /api/v1/skills/{publisher}/{name}
GET /api/v1/skills/{publisher}/{name}/versions
GET /api/v1/skills/{publisher}/{name}/versions/{version}/manifest
GET /api/v1/skills/{publisher}/{name}/versions/{version}/package
```

发布 API 第二阶段再加：

```text
POST /api/v1/publisher/skills
POST /api/v1/publisher/skills/{publisher}/{name}/versions
PATCH /api/v1/publisher/skills/{publisher}/{name}/versions/{version}/review
```

## 存储模型

第一阶段使用本地文件 registry：

```text
registry/
  skills/
    official/
      pdf/
        1.0.0/
          manifest.json
          package.tgz
```

第二阶段迁移到数据库和对象存储。

## 契约源头

`packages/skill-spec` 是三项目共享契约的唯一源头。任何字段变更必须先改这里。

