# Skill 编辑系统需求与开发设计

本文是 SkillMarket 的编辑系统设计稿。它描述即将开发的需求、推荐技术方案、接口草案、前后端拆分和验收标准。

当前 `docs/market-api.md` 是已实现 API 合约；本文中的接口在实现前属于草案。真正落地接口时，需要同步更新 `docs/market-api.md`、`packages/skill-spec` 和后端测试。

## 1. 背景

现有系统已经支持登录用户上传 Skill 包，后端解析包中的 `skill.json` 或 `manifest.json`，校验后生成 submission，经管理员审核后写入公开 registry：

```text
registry/
  skills/
    {publisher}/
      {name}/
        {version}/
          manifest.json
          package.tgz or package.zip
```

这个模型里，公开版本天然应该保持不可变。新增编辑系统时，不建议直接修改已经发布的版本目录，而是把某个公开版本解包成一个受控的编辑工作区；用户在工作区内编辑文件，确认后重新打包成一个新版本 submission，再走发布或审核流程。

## 2. 目标

- Skill 所有者或管理员可以从某个已发布版本创建编辑工作区。
- 用户可以像编辑目录一样查看、创建、修改、重命名、删除 Skill 包内文件。
- 用户可以编辑 `skill.json` 或 `manifest.json`，并在发布前看到结构校验、权限声明、版本冲突等问题。
- 确认发布时，系统重新打包工作区，生成一个新的 Skill 版本。
- 开发阶段可以从工作区生成“开发版本”，供使用端填写开发者 key 后下载测试。
- 公开 registry 仍只分发不可变版本包；旧版本不被覆盖。
- 所有编辑、打包、提交、发布动作都有权限校验和审计记录。

## 3. 非目标

- 不在 SkillMarket 中执行 Skill 脚本。
- 不读取 SkillChat 会话或用户文件。
- 不支持覆盖已发布版本。
- 不在第一版实现多人实时协同编辑。
- 不在第一版实现 Git 级别的分支、合并和冲突解决。

## 4. 核心原则

### 4.1 公开版本不可变

已经发布的 `{publisher}/{name}/{version}` 目录只能被读取、下架或恢复，不允许原地编辑。编辑只会产生新版本，例如从 `1.0.0` 编辑后发布 `1.0.1`。

### 4.2 编辑工作区是私有草稿

工作区存储在 `registry/market-data/edit-workspaces` 下，只允许 Skill 所有者和管理员访问。工作区不是公开分发内容，也不能被公共 API 下载。

### 4.3 复用现有发布链路

工作区确认后先打包，再复用现有 package validator 和 submission/review 流程。

推荐规则：

- 普通所有者：确认后创建 `pending_review` submission，等待管理员审核。
- 管理员：可以选择直接发布，也可以创建 submission 后再审核。

### 4.4 Skill 身份固定

编辑已有 Skill 时，`manifest.id` 的 `{publisher}/{name}` 不允许修改。允许修改描述、标签、权限、运行入口、资源、说明文件等内容。版本号必须改成新的 semver，且不能与现有公开版本重复。

### 4.5 开发版本不进入公开市场

开发版本用于联调测试，不进入公开 Skill 列表、分类、标签、featured、普通版本列表和默认下载接口。使用端必须显式开启开发安装路径，并提供开发者 key 后，才能读取开发版本 manifest 和 package。

开发版本仍然是不可变构建产物。每次生成开发版本都写入一个新的 dev release，例如 `1.0.1-dev.1`、`1.0.1-dev.2`。可以提供 `dev` 或 `latest-dev` 别名指向最新可用开发版本，但别名只是解析指针，不覆盖已有构建。

## 5. 角色与权限

| 角色 | 权限 |
| --- | --- |
| Skill 所有者 | 可以编辑自己 `user.publishers` 下的 Skill；可以创建工作区、编辑文件、校验、打包、提交审核 |
| 管理员 | 可以编辑任意 Skill；可以直接发布新版本、审核他人提交、下架或恢复版本 |
| 持有开发者 key 的使用端 | 只能下载 key 授权范围内的开发版本，不能编辑、提交、发布或访问正式后台 |
| 未登录用户 | 不能访问编辑系统 |
| 非所有者普通用户 | 不能访问其他 publisher 的编辑工作区 |

判定逻辑沿用现有 `canPublishFor(user, publisher)`：

```text
admin: true
publisher owner: user.publishers includes publisher
otherwise: false
```

## 6. 用户流程

### 6.1 创建编辑工作区

入口：

- 公开 Skill 详情页：所有者或管理员看到“编辑”按钮。
- Publisher 后台：在“我的 Skill”中选择一个已发布 Skill。
- Admin 后台：在 Skill 详情或版本列表中选择“编辑此版本”。

流程：

1. 用户选择来源版本，默认是最新公开版本。
2. 系统读取该版本的原始包并安全解包到工作区。
3. 系统生成目标版本号建议，例如 patch bump：`1.0.0` -> `1.0.1`。
4. 用户进入编辑器页面。

### 6.2 编辑文件

页面布局建议：

```text
------------------------------------------------------------
顶部栏：Skill ID / 来源版本 / 目标版本 / 保存状态 / 校验 / 提交发布
------------------------------------------------------------
左侧：文件树       中间：文件编辑器             右侧：校验与 manifest 摘要
      新建文件          文本文件编辑                 版本号
      新建目录          二进制文件预览/下载           权限声明
      上传资源          图片预览                     错误/警告
      重命名/删除       Diff 入口                    文件统计
------------------------------------------------------------
```

第一版可以用普通 `textarea` 加语法提示占位，后续再接 Monaco Editor。必须先支持这些基本操作：

- 展示目录树。
- 打开文本文件并编辑。
- 新建文件和目录。
- 重命名文件或目录。
- 删除文件或目录。
- 上传图片、文档等二进制资源。
- 对二进制文件展示大小、类型、下载按钮，不直接当文本编辑。
- 修改目标版本号。
- 查看工作区和来源版本的变更摘要。

### 6.3 校验

用户点击“校验”或提交前，后端执行：

- 路径安全校验：禁止绝对路径、`..`、Windows drive path。
- 文件数量、单文件大小、总大小限制。
- 敏感文件检查：`.env`、私钥、证书等。
- manifest 解析和 `skillManifestSchema` 校验。
- `manifest.id` 必须等于原 Skill ID。
- `manifest.name` 必须等于 ID 的 name 段。
- `manifest.version` 必须等于目标版本。
- 目标版本不能已经存在。
- 推荐目标版本大于当前最新公开版本。
- package 内建议包含 `SKILL.md`。

校验结果显示为 errors 和 warnings。errors 阻止提交；warnings 不阻止提交。

### 6.4 提交或发布

普通所有者：

1. 点击“提交审核”。
2. 后端再次校验工作区。
3. 后端打包工作区为 `package.tgz`。
4. 后端创建 submission，状态为 `pending_review`。
5. 管理员在现有审核队列中审核，通过后写入公开 registry。

管理员：

- 可以走同样的 submission/review 流程。
- 也可以点击“直接发布”，后端再次校验、打包并写入公开 registry，同时生成 `published` submission 和 audit log。

### 6.5 生成开发版本并测试

开发版本入口放在编辑器页面的“开发测试”区域。

流程：

1. 所有者或管理员编辑工作区。
2. 点击“生成开发版本”。
3. 后端再次校验工作区。
4. 后端把工作区打包成 dev release，例如 `1.0.1-dev.3`。
5. 系统返回开发版本号、测试下载地址和可用的开发者 key 状态。
6. 开发者在 SkillChat 或其他使用端填写 Market 地址、Skill ID、开发版本号或 `dev` 别名、开发者 key。
7. 使用端通过 dev API 下载 manifest 和 package 进行测试。
8. 测试通过后，开发者再把工作区提交审核或由管理员直接发布正式版本。

开发版本不改变工作区状态。工作区仍可继续编辑并生成新的开发版本。

### 6.6 开发者 key 管理

所有者或管理员可以为某个 Skill 生成开发者 key。key 可以在后台反复查看，方便复制到使用端测试。

key 属性建议：

- 名称：方便识别，例如 `Alice local test`。
- 作用域：默认绑定单个 `skillId`；管理员可生成 publisher 级 key。
- 权限：第一版只有 `dev:read`。
- 过期时间：默认 30 天，可手动设置。
- 状态：active、revoked、expired。

使用端只拿 key 下载开发版本，不需要登录账号。

## 7. 状态模型

新增工作区状态：

```text
draft          可编辑
validating     后端正在校验
ready          最近一次校验通过
submitted      已生成待审核 submission
published      已直接发布或对应 submission 已发布
discarded      已丢弃，不可编辑
```

允许流转：

```text
draft -> validating -> ready
ready -> draft
draft|ready -> submitted
draft|ready -> published   admin only
draft|ready -> draft        生成开发版本后继续编辑
draft|ready -> discarded
submitted -> published     submission approved
submitted -> draft         submission rejected 后可复制成新工作区
```

## 8. 存储设计

### 8.1 文件布局

```text
registry/
  market-data/
    market.json
    uploads/
    edit-workspaces/
      {workspaceId}/
        files/
          skill.json
          SKILL.md
          assets/
            icon.png
        source-package.tgz
        builds/
          {buildId}/
            package.tgz
            manifest.json
            validation.json
    dev-releases/
      {publisher}/
        {name}/
          {devVersion}/
            manifest.json
            package.tgz
            dev-release.json
```

说明：

- `files/` 是用户编辑的真实工作树。
- `source-package.*` 保留创建工作区时的来源包，便于比对和重建。
- `builds/` 保存每次提交或直接发布时生成的不可变构建产物。
- `dev-releases/` 保存开发测试用的私有构建，不被公共 registry scanner 扫描。
- 工作区被丢弃后可以删除 `files/`，保留轻量 metadata 和 audit log。

### 8.2 market.json 扩展

在 `MarketData` 中新增：

```ts
type StoredEditWorkspace = {
  id: string;
  status: 'draft' | 'validating' | 'ready' | 'submitted' | 'published' | 'discarded';
  ownerUserId: string;
  publisher: string;
  name: string;
  skillId: string;
  sourceVersion: string;
  targetVersion: string;
  manifestPath?: string;
  packageFormat: 'tgz' | 'zip';
  revision: number;
  validation?: MarketPackageValidation;
  fileEntries: MarketPackageFileEntry[];
  latestBuildId?: string;
  devReleaseIds: string[];
  submissionId?: string;
  createdAt: string;
  updatedAt: string;
  lastValidatedAt?: string;
  discardedAt?: string;
};
```

新增开发版本记录：

```ts
type StoredDevRelease = {
  id: string;
  status: 'active' | 'revoked' | 'expired';
  publisher: string;
  name: string;
  skillId: string;
  version: string;
  sourceWorkspaceId: string;
  sourceVersion: string;
  packagePath: string;
  manifestPath: string;
  package: MarketPackageInfo;
  validation: MarketPackageValidation;
  fileEntries: MarketPackageFileEntry[];
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
  revokeReason?: string;
};
```

新增开发者 key 记录：

```ts
type StoredDeveloperKey = {
  id: string;
  name: string;
  secret: string;
  keyHash: string;
  scopes: Array<'dev:read'>;
  publisher?: string;
  skillId?: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
  lastUsedAt?: string;
};
```

MVP 为了支持反复查看，会在 `market.json` 中保存 `secret`。后续如果引入服务端主密钥，可以改为加密存储 secret；`keyHash` 继续用于请求校验。

在 submission 中建议增加来源信息：

```ts
type MarketSubmissionSource = {
  type: 'upload' | 'editor';
  workspaceId?: string;
  sourceSkillId?: string;
  sourceVersion?: string;
  devReleaseId?: string;
};
```

第一版也可以只在内部 `StoredSubmission` 中保存 `sourceWorkspaceId`，公共 API 暂时不暴露；但审核页面如果要显示 diff，建议把来源信息加入共享 schema。

## 9. API 草案

所有接口都要求登录。除管理员外，只允许访问自己 publisher 下的 Skill 和自己创建的工作区。

### 9.1 创建工作区

```text
POST /api/v1/publisher/skills/{publisher}/{name}/edit-workspaces
```

Request:

```json
{
  "sourceVersion": "1.0.0",
  "targetVersion": "1.0.1",
  "packageFormat": "tgz"
}
```

Response:

```json
{
  "workspace": {
    "id": "ws_...",
    "status": "draft",
    "skillId": "alice/example",
    "sourceVersion": "1.0.0",
    "targetVersion": "1.0.1",
    "revision": 1,
    "validation": null,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### 9.2 列出工作区

```text
GET /api/v1/publisher/edit-workspaces?skillId=alice/example&status=draft
```

返回当前用户可访问的工作区。管理员可看到全部或按 `publisher` 过滤。

### 9.3 获取工作区详情

```text
GET /api/v1/publisher/edit-workspaces/{workspaceId}
```

返回 metadata、文件统计、最近校验结果、来源版本信息、目标版本。

### 9.4 文件树

```text
GET /api/v1/publisher/edit-workspaces/{workspaceId}/files?path=assets
```

Response:

```json
{
  "path": "assets",
  "entries": [
    {
      "path": "assets/icon.png",
      "name": "icon.png",
      "kind": "file",
      "sizeBytes": 12345,
      "contentType": "image/png",
      "editable": false,
      "updatedAt": "..."
    }
  ],
  "revision": 3
}
```

### 9.5 读取文件内容

```text
GET /api/v1/publisher/edit-workspaces/{workspaceId}/files/content?path=SKILL.md
```

文本文件 Response:

```json
{
  "path": "SKILL.md",
  "encoding": "utf8",
  "content": "# Example",
  "revision": 3
}
```

二进制文件返回 `409` 或只返回 metadata，并提示使用下载接口：

```text
GET /api/v1/publisher/edit-workspaces/{workspaceId}/files/download?path=assets/icon.png
```

### 9.6 写入文件内容

```text
PUT /api/v1/publisher/edit-workspaces/{workspaceId}/files/content
```

Request:

```json
{
  "path": "SKILL.md",
  "content": "# Example\n",
  "baseRevision": 3
}
```

如果 `baseRevision` 过旧，返回 `409` 和当前 revision，前端提示用户刷新或手动合并。

### 9.7 新建、上传、移动、删除

```text
POST   /api/v1/publisher/edit-workspaces/{workspaceId}/files
PATCH  /api/v1/publisher/edit-workspaces/{workspaceId}/files/move
DELETE /api/v1/publisher/edit-workspaces/{workspaceId}/files?path=old.md
```

新建文件 Request:

```json
{
  "path": "docs/usage.md",
  "kind": "file",
  "content": ""
}
```

上传二进制文件：

```text
POST /api/v1/publisher/edit-workspaces/{workspaceId}/files/upload
multipart/form-data:
  path: assets/icon.png
  file: <binary>
  baseRevision: 4
```

移动 Request:

```json
{
  "from": "old.md",
  "to": "docs/new.md",
  "baseRevision": 5
}
```

### 9.8 修改目标版本

```text
PATCH /api/v1/publisher/edit-workspaces/{workspaceId}
```

Request:

```json
{
  "targetVersion": "1.0.2",
  "baseRevision": 6
}
```

后端同时更新工作区 metadata，并要求 manifest 中的 `version` 最终与该值一致。也可以在前端修改 manifest 后调用校验发现不一致。

### 9.9 校验工作区

```text
POST /api/v1/publisher/edit-workspaces/{workspaceId}/validate
```

Response:

```json
{
  "workspace": {},
  "validation": {
    "valid": true,
    "errors": [],
    "warnings": []
  },
  "manifest": {},
  "fileEntries": []
}
```

### 9.10 查看 diff

```text
GET /api/v1/publisher/edit-workspaces/{workspaceId}/diff
```

Response:

```json
{
  "sourceVersion": "1.0.0",
  "targetVersion": "1.0.1",
  "files": [
    { "path": "SKILL.md", "change": "modified", "text": true },
    { "path": "assets/icon.png", "change": "added", "text": false }
  ]
}
```

第一版 diff 可以只做文件级别 added/modified/deleted。后续再做文本行级 diff。

### 9.11 提交审核

```text
POST /api/v1/publisher/edit-workspaces/{workspaceId}/submit
```

Request:

```json
{
  "releaseNotes": "Improve docs",
  "changeNotes": "Edited SKILL.md and icon"
}
```

行为：

1. 再次校验工作区。
2. 校验通过后打包到 `builds/{buildId}/package.tgz`。
3. 创建 submission，状态为 `pending_review`。
4. 工作区状态变为 `submitted`。

### 9.12 管理员直接发布

```text
POST /api/v1/admin/edit-workspaces/{workspaceId}/publish
```

Request:

```json
{
  "releaseNotes": "Admin release",
  "changeNotes": "Patch docs",
  "reason": "Owner-maintained change"
}
```

行为：

1. 要求当前用户是管理员。
2. 再次校验工作区。
3. 打包并写入：

```text
registry/skills/{publisher}/{name}/{targetVersion}/manifest.json
registry/skills/{publisher}/{name}/{targetVersion}/package.tgz
```

4. 创建 `published` submission。
5. 写入 audit log。
6. 工作区状态变为 `published`。

### 9.13 生成开发版本

```text
POST /api/v1/publisher/edit-workspaces/{workspaceId}/dev-releases
```

Request:

```json
{
  "version": "1.0.1-dev.3",
  "label": "local test build",
  "expiresAt": "2026-05-28T00:00:00.000Z"
}
```

行为：

1. 要求当前用户是 Skill 所有者或管理员。
2. 再次校验工作区。
3. 要求 `manifest.version` 等于 request 中的 `version`。
4. 要求该版本不与公开版本或现有 active dev release 冲突。
5. 打包到 `market-data/dev-releases/{publisher}/{name}/{version}`。
6. 记录 `StoredDevRelease` 和 audit log。
7. 返回 dev release 信息和 `dev` 别名当前指向。

Response:

```json
{
  "devRelease": {
    "id": "dev_...",
    "status": "active",
    "skillId": "alice/example",
    "version": "1.0.1-dev.3",
    "sourceWorkspaceId": "ws_...",
    "packageUrl": "/api/v1/dev/skills/alice/example/versions/1.0.1-dev.3/package",
    "createdAt": "...",
    "expiresAt": "..."
  },
  "latestDevVersion": "1.0.1-dev.3"
}
```

### 9.14 管理开发者 key

创建 key：

```text
POST /api/v1/publisher/dev-keys
```

Request:

```json
{
  "name": "Alice local SkillChat",
  "skillId": "alice/example",
  "expiresAt": "2026-05-28T00:00:00.000Z"
}
```

Response:

```json
{
  "developerKey": {
    "id": "devkey_...",
    "name": "Alice local SkillChat",
    "skillId": "alice/example",
    "scopes": ["dev:read"],
    "createdAt": "...",
    "expiresAt": "..."
  },
  "secret": "skdev_..."
}
```

`secret` 可以在创建、列表和详情中返回给 Skill 所有者或管理员。服务端同时保存 `keyHash`，使用端请求时按 hash 校验。

列表和吊销：

```text
GET  /api/v1/publisher/dev-keys?skillId=alice/example
POST /api/v1/publisher/dev-keys/{keyId}/revoke
```

### 9.15 使用端下载开发版本

开发版本下载接口不使用登录 token，使用开发者 key：

```text
X-Skill-Dev-Key: skdev_...
```

不要把 key 放在 query string，避免进入代理和访问日志。

开发版本详情：

```text
GET /api/v1/dev/skills/{publisher}/{name}
```

版本列表：

```text
GET /api/v1/dev/skills/{publisher}/{name}/versions
```

manifest：

```text
GET /api/v1/dev/skills/{publisher}/{name}/versions/{version}/manifest
```

package：

```text
GET /api/v1/dev/skills/{publisher}/{name}/versions/{version}/package
```

`{version}` 可以是具体开发版本，也可以是别名：

```text
dev
latest-dev
```

别名解析为当前 skill 下最新 active 且未过期的 dev release。

下载响应头沿用正式版本：

```text
Content-Type: application/gzip
Content-Disposition: attachment; filename="package.tgz"
X-Skill-Id: publisher/name
X-Skill-Version: 1.0.1-dev.3
X-Skill-Sha256: <hex>
X-Skill-Channel: dev
```

### 9.16 吊销开发版本

```text
POST /api/v1/publisher/dev-releases/{devReleaseId}/revoke
```

Request:

```json
{
  "reason": "superseded by 1.0.1-dev.4"
}
```

吊销后，具体版本和 `dev` 别名都不能再下载该 release。已经下载到使用端的包不由 Market 强制删除，使用端需要在下一次检查更新时处理吊销状态。

## 10. 后端开发设计

### 10.1 新增模块

建议把编辑系统从 `app.ts` 中拆出去，避免主路由继续膨胀：

```text
apps/server/src/
  editor-store.ts
  editor-archive.ts
  editor-validator.ts
  editor-routes.ts
  dev-release-store.ts
  dev-key-store.ts
  dev-routes.ts
```

职责：

- `editor-store.ts`：工作区 metadata 读写、revision 递增、状态流转。
- `editor-archive.ts`：安全解包、目录遍历、文件读写、重新打包。
- `editor-validator.ts`：工作区级校验，最终复用 `validateSkillPackage`。
- `editor-routes.ts`：注册 publisher/admin 编辑接口。
- `dev-release-store.ts`：开发版本 metadata、别名解析、吊销和过期判断。
- `dev-key-store.ts`：开发者 key 生成、hash 校验、作用域判断、吊销。
- `dev-routes.ts`：注册使用端开发版本下载接口。

### 10.2 安全解包

解包时必须：

- 只写入 `edit-workspaces/{workspaceId}/files` 内。
- 拒绝绝对路径、`..`、Windows drive path。
- 拒绝 symlink 和 hard link。
- 保留普通文件和目录。
- 对 manifest 候选路径做大小限制。
- 对总文件数量、总大小做限制。

不要直接信任压缩包里的路径。所有路径必须经过统一的 `normalizeArchivePath` 和 `resolveWorkspacePath`。

### 10.3 文件操作

所有写操作都必须：

- 校验工作区状态必须是 `draft` 或 `ready`。
- 校验用户有权限访问该工作区。
- 校验 `baseRevision`。
- 校验路径安全。
- 写入后递增 revision。
- 清空或标记过期最近一次 validation。
- 更新 `updatedAt`。

### 10.4 打包

第一版推荐统一打包为 `package.tgz`，即使来源是 zip。原因：

- 后端已有 `tar` 依赖。
- registry 已支持 `.tgz`。
- 可以减少前端和审核页面分支。

如果必须保留来源格式，可以让工作区 `packageFormat` 支持 `tgz | zip`，但 MVP 不必优先实现 zip 重新打包。

### 10.5 与现有 submission 集成

新增一个内部 helper：

```ts
createSubmissionFromPackage({
  userId,
  packagePath,
  filename,
  releaseNotes,
  changeNotes,
  source,
})
```

上传接口和编辑器提交接口都调用它，避免重复创建 submission 的逻辑。

管理员直接发布也应该复用现有 approve 逻辑中的核心写 registry 代码，建议抽成：

```ts
publishSubmissionPackage(submission, admin, reason)
publishBuiltPackage(build, admin, reason)
```

### 10.6 审计日志

新增 audit action：

```text
edit_workspace_create
edit_workspace_update_file
edit_workspace_delete_file
edit_workspace_validate
edit_workspace_submit
edit_workspace_publish
edit_workspace_discard
dev_release_create
dev_release_revoke
dev_key_create
dev_key_revoke
```

文件内容变更不建议把完整内容写入 audit log，只记录路径、动作、workspaceId、actor、时间。

## 11. 前端开发设计

### 11.1 路由

新增路由：

```text
/publisher/skills/:publisher/:name/edit
/publisher/edit-workspaces/:workspaceId
/admin/edit-workspaces/:workspaceId
```

其中 `/publisher/skills/:publisher/:name/edit` 可以只负责创建或选择工作区，然后跳转到 `/publisher/edit-workspaces/:workspaceId`。

### 11.2 API client

新增：

```text
apps/web/src/api/editor.ts
```

封装：

- createWorkspace
- listWorkspaces
- getWorkspace
- listFiles
- readFile
- writeFile
- createFile
- uploadFile
- moveFile
- deleteFile
- validate
- diff
- submit
- adminPublish
- createDevRelease
- listDevReleases
- revokeDevRelease
- createDevKey
- listDevKeys
- revokeDevKey

### 11.3 页面和组件

建议结构：

```text
apps/web/src/features/editor/
  SkillEditorPage.tsx
  CreateWorkspacePage.tsx
  FileTree.tsx
  FileToolbar.tsx
  TextFileEditor.tsx
  BinaryFilePreview.tsx
  ManifestPanel.tsx
  ValidationPanel.tsx
  VersionDialog.tsx
  DiffPanel.tsx
  DevReleasePanel.tsx
  DeveloperKeyDialog.tsx
```

第一版重点保证工作流完整，不追求复杂 IDE 能力。

### 11.4 前端状态

推荐使用 React Query 管理服务端状态：

- workspace detail：`['edit-workspace', workspaceId]`
- file tree：`['edit-workspace-files', workspaceId, path]`
- file content：`['edit-workspace-file', workspaceId, path]`
- validation：作为 workspace detail 的一部分

编辑器本地维护：

- 当前打开文件。
- 当前文件 dirty 状态。
- 保存中的 loading。
- baseRevision。
- 文件树展开状态。

保存策略：

- MVP：手动保存。
- 后续：debounced autosave，但仍要处理 `409 revision conflict`。

### 11.5 开发测试 UI

编辑器右侧或顶部增加“开发测试”入口：

- 显示最近开发版本、版本号、创建时间、过期时间、吊销状态。
- 提供“生成开发版本”按钮。
- 生成前提示用户确认当前 `manifest.version` 是 dev semver，例如 `1.0.1-dev.3`。
- 显示使用端配置项：Market 地址、Skill ID、版本号或 `dev`、开发者 key。
- 提供“创建开发者 key”弹窗，key 可在后台反复查看和复制。
- 提供“吊销 key”和“吊销开发版本”操作。

使用端集成建议：

- SkillChat 安装界面新增“开发版本”开关。
- 开启后要求填写 Market URL、Skill ID、版本或 `dev`、开发者 key。
- 使用端保存 key 时按本地密钥处理，不写入普通日志。
- 请求 dev API 时发送 `X-Skill-Dev-Key`。

## 12. 版本规则

必须满足：

- `targetVersion` 是合法 semver。
- `targetVersion` 不存在于公开 registry。
- `manifest.version === targetVersion`。
- `manifest.id === source skillId`。
- `manifest.name === source name`。

建议满足：

- `targetVersion` 大于当前最新公开版本。
- 默认建议 patch bump。
- 若当前是 prerelease，则建议同一 prerelease 序列递增或转 stable。

开发版本规则：

- 开发版本必须是合法 semver，推荐使用 prerelease 后缀，例如 `1.0.1-dev.1`。
- 开发版本不能与公开版本冲突，也不能与 active dev release 冲突。
- `dev` 和 `latest-dev` 不是 manifest version，只是下载接口的别名。
- 开发版本测试通过后，正式发布建议改成稳定版本号，例如从 `1.0.1-dev.3` 改为 `1.0.1` 后提交审核。
- 如果团队希望把 `1.0.1-rc.1` 作为公开候选版本发布，也可以走正式审核流程；一旦进入公开 registry，就不再视为开发版本。

如果用户只改文件没改版本，提交时返回错误：

```json
{
  "error": "Target version must be different from the source version"
}
```

## 13. 安全与限制

默认限制建议：

| 项 | 默认值 |
| --- | --- |
| 工作区总大小 | 20 MB |
| 文件数量 | 500 |
| 单文件大小 | 10 MB |
| 可在线编辑文本大小 | 1 MB |
| manifest 大小 | 512 KB |
| 工作区保留时间 | 30 天未更新后可清理 |

安全规则：

- 后端永不执行工作区内代码。
- 所有文件读写都必须在工作区根目录内。
- 禁止 symlink、hard link。
- 禁止上传敏感文件名和私钥扩展名。
- 下载工作区文件必须鉴权。
- 开发版本下载必须使用 `X-Skill-Dev-Key`，且 key 必须 active、未过期、scope 匹配。
- 开发者 key 可由所有者或管理员反复查看；MVP 在 `market.json` 保存 secret 和 hash。
- 开发者 key 不能用于登录、编辑、提交、发布或访问 admin/publisher API。
- 开发版本不出现在任何公共列表和普通 package 下载接口中。
- 不向公共 API 暴露工作区路径。
- 打包前必须再次完整校验，不能只信任前端状态。

## 14. 测试计划

后端测试：

- 所有者可以从公开版本创建工作区。
- 非所有者不能创建或读取工作区。
- 管理员可以创建任意 Skill 的工作区。
- 路径穿越写入被拒绝。
- symlink/hard link 解包被拒绝。
- 文本文件读写会递增 revision。
- stale `baseRevision` 返回 409。
- 删除 manifest 后校验失败。
- 修改 `manifest.id` 后校验失败。
- 重复版本号提交失败。
- 工作区打包后可通过 `validateSkillPackage`。
- owner submit 后生成 pending_review submission。
- admin direct publish 后公开 detail 能看到新版本。
- owner 可以从工作区生成 dev release。
- 未带开发者 key 下载 dev package 返回 401。
- 错误 scope 的开发者 key 下载 dev package 返回 403。
- 吊销或过期的开发者 key 不能下载。
- `dev` 别名解析到最新 active dev release。
- dev release 不出现在公共 `/api/v1/skills` 和普通 versions API 中。

前端测试或手动验收：

- 创建工作区后进入编辑页。
- 文件树能展开和刷新。
- 编辑 `SKILL.md` 保存后刷新仍存在。
- 修改 manifest version 后校验通过。
- 删除文件后 diff 显示 deleted。
- 二进制文件不进入文本编辑器。
- 普通所有者只能看到“提交审核”，管理员能看到“直接发布”。
- 可以生成开发版本，并看到使用端配置说明。
- 可以创建开发者 key，刷新后仍可查看和复制 secret。
- 使用端填 key 后能下载 dev 版本；吊销 key 后下载失败。

## 15. 分阶段开发计划

### Phase 1: 合约和存储

- 在 `packages/skill-spec` 增加 workspace 相关 schema 和 types。
- 在 `MarketData` 增加 `editWorkspaces: []`、`devReleases: []`、`developerKeys: []`，并保持旧 `market.json` 可正常 normalize。
- 新增 `editor-store.ts`。
- 补后端 metadata 单元测试。

### Phase 2: 解包、文件操作、校验

- 实现安全解包。
- 实现文件树、读文件、写文件、新建、移动、删除、上传。
- 实现 workspace validator。
- 补路径安全、revision、manifest 校验测试。

### Phase 3: 打包和提交

- 实现工作区重新打包。
- 抽取 submission 创建 helper。
- 实现 `submit` 接口。
- 管理员直接发布接口可在本阶段一起完成，或放到 Phase 4。
- 实现 dev release 打包、保存和吊销。
- 实现 developer key 生成、hash 校验、作用域判断和吊销。
- 实现使用端 dev 下载接口。

### Phase 4: 前端编辑器

- 增加 editor API client。
- 增加创建工作区入口。
- 实现文件树、文本编辑、二进制预览、校验面板、版本号修改、提交审核。
- 实现开发版本生成、developer key 管理和使用端配置展示。
- 管理员显示直接发布入口。

### Phase 5: 审核增强

- 审核详情展示来源版本、目标版本、文件级 diff。
- submission 列表标记来源为 upload/editor。
- 审核详情展示是否从某个 dev release 演进而来。
- 增加工作区清理任务或手动清理按钮。

## 16. MVP 验收标准

MVP 完成时必须满足：

- 所有者可以从自己已发布 Skill 的最新版本创建编辑工作区。
- 管理员可以从任意已发布 Skill 创建编辑工作区。
- 可以在线编辑至少 `SKILL.md` 和 `skill.json`/`manifest.json`。
- 可以新增、删除、重命名文件。
- 提交前能看到校验错误和警告。
- 可以生成开发版本，开发版本不进入公开市场列表。
- 可以生成和吊销开发者 key。
- 使用端填写开发者 key 后可以下载开发版本进行测试。
- 不能覆盖已有版本。
- 普通所有者确认后生成 `pending_review` submission。
- 管理员审核通过后，新版本出现在公开 Skill 详情和下载接口中。
- 旧版本仍可下载，内容不变。
- 所有关键后端路径有自动化测试。

## 17. 后续增强

- Monaco Editor、JSON schema 提示和 manifest 表单编辑。
- 文本行级 diff。
- 自动保存。
- 工作区复制和从 rejected submission 继续编辑。
- 多人协作锁或评论。
- 版本发布 changelog 自动生成。
- 图片裁剪、资源尺寸检查。
- 定时清理长期未更新的 abandoned 工作区。
