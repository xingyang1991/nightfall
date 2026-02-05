# 上线前联调自检清单

> 目标：确认 Beta/小流量上线所需闭环完整、风格一致、稳定性可控。

## 1. 自动化预检（推荐）

```bash
scripts/preflight_smoke.sh
```

输出应全部 PASS。

## 2. 手动联调清单（必测）

### Discover → Tonight → Pocket 闭环
- 场景卡片可见、有图、有标签
- 点击场景 → 进入 Tonight，输入被预填
- 提交需求后返回候选列表
- 选择候选 → 出票根
- 保存票根 → Pocket 可见

### Pocket → 归档 → 分享 → 导出
- 生成归档成功
- 分享链接可访问（含二维码）
- `share?print=1` 自动打印

### Sky 氛围
- `/api/atmosphere` 返回 pulse/traffic/weather
- WS 推送 `atmosphere:update`
- `user:nearby` 推送生效

### Veil 幕布
- 上传前提示弹窗
- 上传后进入瀑布流
- 屏保模式正常轮播
- 点赞有效

## 3. 退化模式

- 无 Amap Key：Tonight 候选仍可工作（降级）
- 无 Redis：匿名在线采用内存统计
- 无 AI 审核服务：仍可上传但建议开启 `NF_MOMENTS_REVIEW=true`

## 4. 安全项

- 分享页无 XSS 注入
- 未授权访问被拒绝（`NF_AUTH_SECRET` 启用时）
- 管理员审批 API 仅管理员可用

