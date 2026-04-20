import type { InstanceConfigs } from "@/hooks/useInstance";
import type { Schedule } from "@/types";

const CONTROL_FEATURE_PREVIEW_SERVER_CONFIGS: Array<{
  matcher: (instanceType: string) => boolean;
  files: InstanceConfigs[];
}> = [
  {
    matcher: (instanceType) => instanceType.startsWith("minecraft/java"),
    files: [
      {
        fileName: "server.properties",
        path: "server.properties",
        redirect: "common/server.properties",
        type: "properties",
        info: "Minecraft Java 服务端核心配置文件。",
        category: ["minecraft/java"]
      },
      {
        fileName: "eula.txt",
        path: "eula.txt",
        redirect: "common/eula.txt",
        type: "properties",
        info: "EULA 协议确认文件。",
        category: ["minecraft/java"]
      },
      {
        fileName: "spigot.yml",
        path: "spigot.yml",
        redirect: "minecraft/spigot.yml",
        type: "yaml",
        info: "Spigot/Paper 兼容配置文件。",
        category: ["minecraft/java"]
      }
    ]
  },
  {
    matcher: (instanceType) => instanceType.startsWith("minecraft/bedrock"),
    files: [
      {
        fileName: "server.properties",
        path: "server.properties",
        redirect: "common/server.properties",
        type: "properties",
        info: "Bedrock 服务端基础配置文件。",
        category: ["minecraft/bedrock"]
      }
    ]
  }
];

const CONTROL_FEATURE_PREVIEW_SCHEDULES: Record<string, Schedule[]> = {
  "paper-lobby": [
    {
      instanceUuid: "paper-lobby",
      name: "broadcast-status",
      count: -1,
      time: "0 0/15 * * * *",
      type: 2,
      actions: [
        {
          type: "command",
          payload: "say [Preview] Lobby status heartbeat"
        }
      ]
    },
    {
      instanceUuid: "paper-lobby",
      name: "daily-restart",
      count: -1,
      time: "0 30 5 * * 1,2,3,4,5,6,0",
      type: 2,
      actions: [
        {
          type: "restart",
          payload: ""
        }
      ]
    }
  ],
  "survival-main": [
    {
      instanceUuid: "survival-main",
      name: "backup-world",
      count: -1,
      time: "0 0 4 * * *",
      type: 2,
      actions: [
        {
          type: "command",
          payload: "backup start"
        }
      ]
    }
  ],
  "creative-test": [
    {
      instanceUuid: "creative-test",
      name: "clear-drops",
      count: -1,
      time: "600",
      type: 1,
      actions: [
        {
          type: "command",
          payload: "kill @e[type=item]"
        }
      ]
    }
  ]
};

export const getPreviewServerConfigFiles = (instanceType?: string): InstanceConfigs[] => {
  if (!instanceType) return [];
  const matched = CONTROL_FEATURE_PREVIEW_SERVER_CONFIGS.find((item) => item.matcher(instanceType));
  return matched ? JSON.parse(JSON.stringify(matched.files)) : [];
};

export const getControlFeaturePreviewSchedules = (instanceId?: string): Schedule[] => {
  if (!instanceId) return [];
  return CONTROL_FEATURE_PREVIEW_SCHEDULES[instanceId] || [];
};
