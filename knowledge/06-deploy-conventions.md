---
title: Deploy Conventions
type: deploy
repo: MCSManager-monitor
last_verified: 2026-04-15
---

# 远端约定
- `origin`：官方仓库 `MCSManager/MCSManager`
- `zzrepo`：用户仓库 `zz314657917/MCSManager`
- 默认不要直接把本地实验内容 push 到官方远端

# 监控部署约定
- 每台游戏主机运行 MCSManager daemon
- 面板机运行 panel 和 frontend
- 1.12.2 服务端安装 `mcsm-monitor-plugin`
- 插件向本机 daemon 上报心跳
- 面板通过 `/api/monitor/servers` 聚合状态

# Linux 线上常见路径
- 源码仓库：`/root/MCSManager-monitor`
- 线上运行目录：`/opt/mcsmanager`

# 部署脚本
- `prod-scripts/linux/deploy-monitor-daemon-from-repo.sh`
- `prod-scripts/linux/deploy-monitor-web-from-repo.sh`

# 部署前检查
- 当前分支和远端是否正确
- daemon 基础安装是否已存在
- 面板与 daemon 的地址映射是否正确
- HTTPS/WSS 配置是否完整
- 插件配置中的 `serverId` 和 `instanceToken` 是否正确
