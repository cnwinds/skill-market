# SkillMarket

SkillMarket 是 Skill 的市场、版本和分发系统。它负责浏览、上传、审核、发布和下载 Skill，不执行 Skill 脚本，不管理 SkillChat 会话，也不读取 SkillChat 用户文件。

## 目录

```text
apps/server              Market API 服务
apps/web                 Web 前端
packages/skill-spec      前后端共享契约和 schema
registry/skills          仓库内置的公开 Skill 种子
docker                   Docker 构建、编排和运行数据目录
docs                     API、交接和开发文档
scripts                  导入官方包等脚本
```

## 本地开发

```powershell
npm install
npm run build
npm run typecheck
npm test
```

后端默认监听：

```text
http://127.0.0.1:3100
```

健康检查：

```powershell
curl http://127.0.0.1:3100/health
curl http://127.0.0.1:3100/api/v1/skills
```

## Docker

Docker 相关文件集中在：

```text
docker/
  Dockerfile
  Dockerfile.dockerignore
  compose.yml
  entrypoint.sh
  data/
```

启动：

```powershell
npm run docker:up
```

日志：

```powershell
npm run docker:logs
```

停止：

```powershell
npm run docker:down
```

Docker 启动后的落地数据放在：

```text
docker/data/registry
```

Compose 会把 `docker/data/registry` 挂载到容器内的 `/app/registry`。首次启动时，容器会把镜像内置的 `registry/skills` 种子复制到 `docker/data/registry/skills`；后续用户、会话、上传、审核、发布、精选和下架数据都会写入 `docker/data/registry`。

等价 Compose 命令：

```powershell
docker compose -f docker/compose.yml up -d --build
```

## API

完整接口契约见：

```text
docs/market-api.md
```

前后端共享类型和 schema 以 `packages/skill-spec` 为准。前端用到的接口、参数、枚举和响应结构必须同步维护在 `docs/market-api.md`。

## 官方 Skill 导入

从 `official-skills/dist` 导入官方包到仓库内置 registry：

```powershell
npm run import:official -- ..\official-skills\dist
```

如果 Docker 运行数据已经初始化，导入仓库内置 registry 后不会自动覆盖 `docker/data/registry`。需要重置 Docker 运行数据时，先停止服务，再清空 `docker/data/registry`。
