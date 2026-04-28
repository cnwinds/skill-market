# SkillMarket 前端开发需求

## 1. 背景

SkillMarket 当前已经具备只读 Market API，可以提供 Skill 列表、详情、版本、manifest 和 package 下载能力。下一阶段需要补齐 Web 前端，使未登录用户可以浏览和下载 Skill，登录用户可以上传并提交发布，管理员可以审核后上架。

参考站点：`https://skillhub.cn/`。公开体验上重点参考其中文 Skill 市场形态：顶部导航、搜索、分类筛选、精选/热门 Skill、详情页的安装信息、元数据、源码/包下载入口、提交 Skill 入口，以及公开浏览优先的访问方式。

## 2. 产品目标

1. 给 SkillChat 用户提供一个公开可访问的 Skill 浏览和分发入口。
2. 让开发者登录后可以上传、预检、提交和管理自己发布的 Skill。
3. 让管理员能够审核 Skill 的安全、规范和内容质量，审核通过后才进入公开市场。
4. 保持 Market 的边界清晰：市场只负责 Skill 的展示、版本、包分发、审核和元数据管理，不执行 Skill，不读取 SkillChat 用户会话或本地文件。

## 3. 用户角色

### 3.1 游客

未登录用户。可以搜索、筛选、查看 Skill 详情、查看版本信息、下载公开版本包。不能上传、收藏、评论、提交审核。

### 3.2 登录用户 / 发布者

可以拥有 publisher 身份，上传 Skill 包，查看自己的草稿、审核中、已发布、被拒绝版本，重新提交审核，管理作者信息和发布者主页。

### 3.3 管理员

可以查看所有待审核提交，检查 manifest、权限声明、包文件、安全扫描结果、历史版本差异，执行通过、拒绝、下架、恢复、标记精选等操作。

## 4. 信息架构

```text
/
  市场首页
/skills
  Skill 列表页
/skills/:publisher/:name
  Skill 详情页
/skills/:publisher/:name/versions
  版本列表页，可作为详情页 tab
/publish
  上传/发布入口，登录后可访问
/publisher
  发布者控制台
/publisher/skills
  我的 Skill
/publisher/skills/:publisher/:name
  我的 Skill 版本和审核记录
/publisher/submissions/:submissionId
  提交详情
/admin
  管理员控制台
/admin/reviews
  审核队列
/admin/reviews/:submissionId
  审核详情
/admin/skills
  已发布 Skill 管理
/login
  登录页
/account
  账号设置
```

## 5. 页面需求

### 5.1 全局布局

顶部导航包含：

- SkillMarket 标识。
- 首页、全部 Skill、分类、提交 Skill。
- 搜索框，支持按名称、描述、标签、作者搜索。
- 右侧登录入口；登录后显示用户菜单。
- 管理员登录后显示“审核后台”入口。

底部包含：

- 项目说明。
- API 文档链接。
- Skill 规范链接。
- GitHub / 源码链接。
- 联系与问题反馈入口。

响应式要求：

- 桌面端以搜索、筛选、列表密度为主。
- 移动端保留搜索优先，筛选折叠为抽屉或下拉。
- Skill 卡片在移动端单列，桌面端 3 到 4 列或列表视图。

### 5.2 市场首页

目标：让用户快速理解这是 Skill 市场，并立即开始搜索或浏览。

模块：

- 首屏搜索区：主搜索框、常用分类快捷入口、上传 Skill 按钮。
- 精选 Skill：由管理员标记，最多 8 个。
- 最新发布：按公开版本发布时间倒序。
- 热门分类：如文档处理、数据分析、办公自动化、开发工具、研究检索、多媒体等。
- 安全提示：展示“上传审核后上架、权限声明透明、下载包可校验”的简短说明。

交互：

- 搜索后跳转 `/skills?query=...`。
- 点击分类跳转 `/skills?category=...`。
- 未登录点击“提交 Skill”跳转登录页，登录后回到 `/publish`。

### 5.3 Skill 列表页

目标：支持游客高效发现 Skill。

筛选条件：

- 关键词 `query`。
- 类型 `kind`：instruction、runtime、hybrid。
- 分类 `category`。
- 标签 `tag`。
- 作者 / publisher。
- 排序：最新、名称、热门、下载量、评分。MVP 如果后端未提供统计，先实现最新和名称。

列表项展示：

- 图标。
- 显示名 `displayName`，缺省用 `publisher/name`。
- 简介 `description`。
- 最新版本 `latestVersion`。
- 类型 `kind`。
- 作者。
- 分类和标签。
- 更新时间 `updatedAt`。
- 安装/下载按钮。

空状态：

- 无结果时提示调整关键词或筛选条件。
- 如果接口失败，展示重试按钮。

### 5.4 Skill 详情页

目标：展示用户安装和评估 Skill 所需的完整信息。

基础信息：

- 名称、publisher/name、版本、简介、作者、许可证、更新时间。
- 分类、标签、类型。
- 图标和截图，如果 manifest 提供。
- 兼容性信息，如 `compatibility.skillchat`。

核心操作：

- 下载最新版本 package。
- 查看 manifest。
- 复制安装命令或安装配置。命令格式由 SkillChat 最终安装入口决定，MVP 可先展示 market URL、id、version。
- 查看全部版本。

详情 tab：

- 概览：描述、starter prompts、使用场景。
- 权限：filesystem、network、scripts、secrets 明细，需要用清晰风险文案展示。
- 版本：所有公开版本、发布日期、包大小、sha256。
- manifest：格式化 JSON，只读。
- 资源：homepage、repository、screenshots。

权限展示规则：

- `scripts=true` 显示高风险标签。
- `network=true` 或存在 `allowedHosts` 显示网络访问范围。
- `secrets` 非空时突出显示所需密钥名称。
- 文件系统权限按读写分组。

### 5.5 登录页

目标：让发布和管理功能有清晰入口。

MVP 推荐支持：

- 邮箱 + 密码登录。
- 管理员账号同一入口登录，通过角色判断展示后台。

后续可扩展：

- GitHub OAuth。
- 邮箱验证码。
- 企业 SSO。

登录后跳转：

- 从提交 Skill 进入时，回到 `/publish`。
- 从管理员后台进入时，回到 `/admin/reviews`。
- 普通登录默认回首页或上一个页面。

### 5.6 上传发布页

目标：登录用户可以提交一个可审核的 Skill 包。

上传方式：

- 上传 `.tgz`、`.tar.gz` 或 `.zip` 包。
- 可选：填写 Git 仓库地址，由后端拉取构建。此项不进 MVP，先作为二期。

上传流程：

1. 用户选择 `.tgz`、`.tar.gz` 或 `.zip` 文件。
2. 前端显示文件名和大小。
3. 上传到后端创建 draft submission。
4. 后端解析包内 manifest 并返回预检结果。
5. 前端展示 manifest 摘要、权限、包大小、校验值、错误和警告。
6. 用户补充发布说明。
7. 用户点击“提交审核”。
8. 状态进入 `pending_review`，用户跳转到提交详情页。

表单字段：

- 包文件，必填。
- 发布说明，选填。
- 变更说明，选填，新版本建议填写。
- 是否确认拥有发布权限，必选 checkbox。
- 是否确认已阅读 Skill 规范，必选 checkbox。

前端校验：

- 文件后缀必须为 `.tgz`、`.tar.gz` 或 `.zip`。
- 文件大小限制需要从后端配置读取，默认建议 20MB。
- 不能在前端解析通过就直接发布，最终校验必须以后端结果为准。

### 5.7 发布者控制台

目标：发布者管理自己的 Skill 和提交记录。

模块：

- 我的 Skill：按 skill 聚合展示最新公开版本、审核中版本、草稿数量。
- 审核记录：draft、pending_review、approved、rejected、published、removed。
- 操作：继续编辑草稿、重新上传、查看拒绝原因、提交新版本。

状态展示：

- 草稿：可删除、可继续提交。
- 审核中：不可修改包，只能撤回。
- 已拒绝：显示原因，可基于该提交重新上传。
- 已发布：显示公开详情页链接。
- 已下架：显示下架原因。

### 5.8 管理员审核队列

目标：管理员可以高效判断提交是否可上架。

列表字段：

- 提交 ID。
- Skill id。
- 版本。
- 发布者。
- 提交时间。
- 当前状态。
- 风险标签：scripts、network、secrets、large_package、new_publisher、first_version。

筛选：

- 状态。
- 发布者。
- Skill id。
- 风险等级。
- 提交时间。

批量操作：

- MVP 不做批量通过。
- 可批量标记需要人工复核或批量关闭明显重复提交。

### 5.9 管理员审核详情

目标：完整展示审核判断所需信息。

内容：

- manifest 摘要。
- 权限声明。
- 包文件元数据：大小、sha256、文件列表。
- 自动校验结果：schema 校验、id/version 一致性、包结构检查、恶意路径检查、禁止文件检查。
- 与上一公开版本差异：manifest diff、文件列表 diff。MVP 可先只做 manifest diff。
- 发布者历史：注册时间、历史通过/拒绝次数。
- 管理员备注历史。

审核操作：

- 通过：提交进入 `approved`，后端将 package 和 manifest 写入公开 registry，状态变为 `published`。
- 拒绝：必须填写拒绝原因，状态变为 `rejected`。
- 要求修改：可作为 `changes_requested`，MVP 可并入 rejected。
- 下架：对已发布版本执行，必须填写原因。

审核通过前必须满足：

- manifest schema 校验通过。
- `id`、`name`、`version` 与包结构一致。
- package sha256 已生成。
- 同一 `publisher/name/version` 未被公开占用。
- 发布者有该 publisher 的发布权限。

## 6. 状态模型

### 6.1 Submission 状态

```text
draft
pending_review
approved
rejected
published
withdrawn
removed
```

说明：

- `draft`：已上传但未提交审核。
- `pending_review`：等待管理员审核。
- `approved`：审核通过但尚未完成发布入库，通常是短暂中间态。
- `published`：已进入公开市场。
- `rejected`：审核拒绝。
- `withdrawn`：发布者撤回。
- `removed`：管理员下架。

### 6.2 公开可见规则

只有 `published` 状态的版本进入游客可见列表、详情、版本和 package 下载接口。

### 6.3 版本规则

- 同一个 `publisher/name/version` 一旦发布，不允许覆盖。
- 同一个 Skill 的多个版本按 semver 倒序展示。
- 详情页默认展示最新 published 版本。
- 被拒绝、撤回、草稿版本不出现在公开版本列表。

## 7. 数据需求

现有 `skillManifestSchema` 字段需要在前端完整消费：

- `id`
- `name`
- `displayName`
- `version`
- `kind`
- `description`
- `author`
- `license`
- `homepage`
- `repository`
- `tags`
- `categories`
- `compatibility`
- `permissions`
- `runtime`
- `starterPrompts`
- `assets`

市场扩展字段建议新增：

- `downloads`
- `stars`
- `featured`
- `reviewStatus`
- `publisherProfile`
- `createdAt`
- `publishedAt`
- `updatedAt`
- `reviewedAt`
- `reviewedBy`
- `reviewComment`

这些扩展字段不应写入 skill manifest；应由市场数据库维护。

## 8. API 需求

### 8.1 已有公开 API

```text
GET /health
GET /api/v1/skills
GET /api/v1/skills/:publisher/:name
GET /api/v1/skills/:publisher/:name/versions
GET /api/v1/skills/:publisher/:name/versions/:version/manifest
GET /api/v1/skills/:publisher/:name/versions/:version/package
```

前端 MVP 可直接消费这些接口完成游客浏览。

### 8.2 公开 API 建议补齐

```text
GET /api/v1/categories
GET /api/v1/tags
GET /api/v1/featured-skills
```

说明：

- 分类和标签可从公开 Skill 聚合生成。
- 精选 Skill 需要市场扩展字段支持。

### 8.3 认证 API

```text
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET /api/v1/auth/me
POST /api/v1/auth/register
POST /api/v1/auth/refresh
```

`GET /api/v1/auth/me` 返回：

```json
{
  "user": {
    "id": "user_001",
    "email": "user@example.com",
    "displayName": "Alice",
    "roles": ["publisher"],
    "publishers": ["alice"]
  }
}
```

### 8.4 发布者 API

```text
POST /api/v1/publisher/submissions
GET /api/v1/publisher/submissions
GET /api/v1/publisher/submissions/:submissionId
POST /api/v1/publisher/submissions/:submissionId/submit
POST /api/v1/publisher/submissions/:submissionId/withdraw
DELETE /api/v1/publisher/submissions/:submissionId
GET /api/v1/publisher/skills
GET /api/v1/publisher/skills/:publisher/:name
```

上传接口建议使用 `multipart/form-data`：

```text
POST /api/v1/publisher/submissions
Content-Type: multipart/form-data

file: package.tgz | package.tar.gz | package.zip
releaseNotes?: string
```

返回：

```json
{
  "submission": {
    "id": "sub_001",
    "status": "draft",
    "manifest": {},
    "package": {
      "sizeBytes": 12345,
      "checksumSha256": "..."
    },
    "validation": {
      "valid": true,
      "errors": [],
      "warnings": []
    }
  }
}
```

### 8.5 管理员 API

```text
GET /api/v1/admin/reviews
GET /api/v1/admin/reviews/:submissionId
POST /api/v1/admin/reviews/:submissionId/approve
POST /api/v1/admin/reviews/:submissionId/reject
POST /api/v1/admin/skills/:publisher/:name/versions/:version/remove
POST /api/v1/admin/skills/:publisher/:name/versions/:version/restore
POST /api/v1/admin/skills/:publisher/:name/feature
POST /api/v1/admin/skills/:publisher/:name/unfeature
```

拒绝请求：

```json
{
  "reason": "manifest description is too vague and scripts permission is not justified"
}
```

## 9. 权限与安全

前端权限：

- 游客只能访问公开页面。
- 未登录访问 `/publish`、`/publisher/*` 时跳转登录。
- 非管理员访问 `/admin/*` 显示 403。
- 前端隐藏无权限入口，但所有权限必须由后端强校验。

上传安全：

- 后端必须解包到隔离临时目录。
- 禁止绝对路径、`..` 路径穿越、符号链接逃逸。
- 限制包大小、文件数量、单文件大小。
- 禁止包含明显敏感文件，如 `.env`、私钥、系统缓存。
- 不执行包内脚本。
- 生成 sha256，公开下载时返回校验信息。

审核安全：

- 高权限 Skill 不自动通过。
- `scripts=true`、`network=true`、`secrets` 非空必须在审核页高亮。
- 管理员操作需要审计日志。

## 10. 前端技术建议

当前仓库是 npm workspaces，建议新增：

```text
apps/web
```

推荐技术栈：

- Vite + React + TypeScript。
- React Router。
- TanStack Query 或轻量 fetch client。
- Zod 复用 `@qizhi/skill-spec` 做前端响应校验。
- CSS Modules、Tailwind CSS 或项目自定 CSS。若没有设计系统，建议先用 CSS Modules，减少依赖。

前端目录建议：

```text
apps/web/src
  api/
  components/
  features/
    skills/
    auth/
    publisher/
    admin/
  routes/
  styles/
  types/
```

## 11. UI 设计原则

视觉方向：

- 中文开发者工具市场风格，信息密度适中。
- 搜索和筛选优先，不做营销式落地页。
- Skill 卡片要便于扫描，不用大面积装饰。
- 权限、安全和版本信息要清晰可信。

组件要求：

- Skill 卡片。
- 搜索框。
- 分类/标签筛选。
- 类型 segmented control。
- 版本选择器。
- 权限风险 badge。
- 代码/JSON 查看器。
- 文件上传 dropzone。
- 审核状态 badge。
- 审核操作确认弹窗。
- 错误、空状态、加载骨架。

## 12. MVP 范围

第一阶段必须交付：

- 首页。
- Skill 列表页。
- Skill 详情页。
- manifest 查看。
- package 下载。
- 登录页壳和登录状态管理。
- 上传发布页。
- 发布者提交记录页。
- 管理员审核队列。
- 管理员审核详情。

第一阶段可以延后：

- 评分和评论。
- 收藏。
- 下载量真实统计。
- Git 仓库自动构建。
- 在线预览截图管理。
- OAuth 登录。
- 多语言。

## 13. 验收标准

游客浏览：

- 未登录访问首页、列表、详情、版本和下载均可正常使用。
- 搜索、分类、标签、类型筛选可以通过 URL query 保持状态。
- 接口失败时页面可恢复，不出现空白页。

发布流程：

- 未登录点击提交 Skill 会进入登录页，登录后回到上传页。
- 登录用户可以上传 `.tgz`、`.tar.gz` 或 `.zip` 并看到后端校验结果。
- 用户提交审核后，可以在发布者控制台看到状态。
- 被拒绝的提交显示拒绝原因。

审核流程：

- 普通用户不能进入管理员页面。
- 管理员可以查看待审核列表和详情。
- 管理员通过后，该版本出现在公开市场。
- 管理员拒绝时必须填写原因。
- 管理员下架后，该版本不再公开下载。

接口契约：

- 前端类型以 `@qizhi/skill-spec` 为准。
- 已发布公开接口保持向后兼容。
- 只有 `published` 版本可通过公开 API 获取。

质量：

- 关键页面有 loading、empty、error 状态。
- 桌面和移动端布局无明显遮挡或溢出。
- 上传、审核等高风险操作有确认提示。
- `npm run typecheck` 和前端测试通过。

## 14. 迭代计划

### 阶段 1：公开浏览

- 新增 `apps/web`。
- 接入现有只读 API。
- 完成首页、列表、详情、版本、manifest、下载。

### 阶段 2：账号和发布

- 补齐认证 API。
- 完成登录态、发布者控制台、上传预检、提交审核。
- 后端增加 submission 存储。

### 阶段 3：管理员审核

- 补齐管理员 API。
- 完成审核队列、审核详情、通过、拒绝、下架。
- 审核通过后写入公开 registry。

### 阶段 4：市场增强

- 精选、热门、下载统计。
- 评分、收藏、发布者主页。
- Git 仓库导入和自动构建。

## 15. 当前项目差距

当前代码已经具备：

- `@qizhi/skill-spec` 契约。
- Fastify 只读 API。
- 本地 registry 扫描。
- package 下载。

仍需补齐：

- `apps/web` 前端应用。
- 用户、角色、登录态。
- 数据库或持久化 submission 存储。
- 上传包解析和安全校验。
- 审核状态机。
- 管理员审核接口。
- 公开 registry 与审核通过版本的写入流程。
- 市场扩展字段，如精选、下载量、审核状态。
