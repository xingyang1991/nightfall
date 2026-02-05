# Nightfall V2 部署说明

## 1. 环境准备

- Node.js 18+（建议 20）
- npm（或 pnpm / yarn）

## 2. 安装依赖

```bash
npm install
```

## 3. 环境变量

复制并填写：

```bash
cp .env.example .env
```

关键变量（生产环境必配）：
- `NF_AUTH_SECRET`
- `AMAP_API_KEY`
- `UPSTASH_REDIS_URL` / `UPSTASH_REDIS_TOKEN`
- `NF_ADMIN_USER_IDS`（逗号分隔）

可选变量：
- `BING_IMAGE_SEARCH_KEY` + `NF_IMAGE_SEARCH_ENABLED=true`
- `UNSPLASH_ACCESS_KEY`
- `NF_MOMENTS_AI_REVIEW=true` + `NF_MOMENTS_MODERATION_URL`
- `CLOUDFLARE_R2_*`

## 4. 本地开发

```bash
npm run dev:full
```

前端默认端口：5173  
后端默认端口：4000（可用 `PORT` 覆盖）

## 5. 生产部署（推荐）

```bash
npm run build
NODE_ENV=production PORT=4000 npm run server
```

生产建议使用反向代理：
- `/api/*` 走后端
- 其他路径走静态 `dist`（server 已支持）

## 6. 运行时自检

请先运行联调脚本：

```bash
scripts/preflight_smoke.sh
```

若失败，查看日志：

```
artifacts/preflight_server.log
```

