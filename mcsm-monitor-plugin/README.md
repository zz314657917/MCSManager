# MCSM Monitor Plugin

适用于 `Spigot 1.12.2 / Java 8` 的轻量监控插件。

当前版本除了基础 heartbeat 之外，还补了 GM 管理页一期需要的插件侧能力：

- 定时上报玩家快照
- 上报聊天消息
- 本地 HTTP 控制端口
- 通过反射兼容 `PlayerChat`、`Vault`、`PlayerPoints`、`LuckPerms`
- 本地 `mute` 能力和持久化

## 配置

编辑 `plugins/MCSMMonitor/config.yml`：

```yml
agentUrl: "http://127.0.0.1:24444"
serverId: "你的实例 UUID"
instanceToken: "你的实例 Token"
heartbeatIntervalTicks: 100
playerSnapshotIntervalTicks: 100

endpoints:
  heartbeatPath: "/v1/plugin/heartbeat"
  playerSnapshotPath: "/v1/plugin/player_snapshot"
  chatMessagePath: "/v1/plugin/chat_message"

localControl:
  enabled: true
  host: "127.0.0.1"
  port: 25681
  token: ""
```

关键字段说明：

- `agentUrl`: 本机 daemon 地址，默认 `http://127.0.0.1:24444`
- `serverId`: MCSManager 中的实例 UUID
- `instanceToken`: 实例 Token；`localControl.token` 为空时也会回退到这里作为本地控制鉴权 token
- `playerSnapshotIntervalTicks`: 玩家快照上报周期，`<= 0` 时关闭
- `endpoints.*`: 插件侧预留的上报接口路径
- `localControl.*`: 本地 HTTP 控制端口配置，默认只监听 `127.0.0.1`
- `mute.*`: 本地禁言持久化和提示配置

## 本地控制端口

默认开启两个接口：

- `GET /health`
- `POST /actions`

鉴权方式：

- Header: `X-MCSM-Token: <token>`
- 或 Header: `Authorization: Bearer <token>`
- 或 query: `?token=<token>`

`POST /actions` 请求体示例：

```json
{
  "action": "economy",
  "operation": "add",
  "player": "Steve",
  "amount": 100
}
```

支持的动作：

- `economy`: `add / take / set / balance`
- `points`: `add / take / set / balance`
- `luckperms`: `add / remove`
- `mute`: `mute / unmute / status`

## 获取实例 Token

如果你知道 daemon 的 `key`，可以在本机请求：

```bash
curl "http://127.0.0.1:24444/v1/plugin/token/<serverId>?apikey=<daemonKey>"
```

返回的 `instanceToken` 填入插件配置即可。

## 重载配置

修改 `plugins/MCSMMonitor/config.yml` 后，可在控制台或游戏内执行：

```text
mcsmmonitor reload
```

游戏内执行需要 `mcsmmonitor.reload` 权限，默认 OP 拥有。

## 构建

```bash
mvn package
```

构建产物：

```text
target/mcsm-monitor-plugin.jar
```
