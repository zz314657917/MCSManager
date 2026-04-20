package com.mcsmanager.monitor;

import org.bukkit.Bukkit;
import org.bukkit.World;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitTask;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

final class PlayerSnapshotReporter {
    private final MinecraftMonitorPlugin plugin;
    private final AgentHttpClient httpClient;
    private BukkitTask task;

    PlayerSnapshotReporter(MinecraftMonitorPlugin plugin, AgentHttpClient httpClient) {
        this.plugin = plugin;
        this.httpClient = httpClient;
    }

    void start() {
        long interval = Math.max(20L, plugin.getConfig().getLong("playerSnapshotIntervalTicks", 100L));
        task = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, new Runnable() {
            @Override
            public void run() {
                sendSnapshot();
            }
        }, interval, interval);
    }

    void stop() {
        if (task != null) {
            task.cancel();
            task = null;
        }
    }

    private void sendSnapshot() {
        try {
            Future<Map<String, Object>> future = Bukkit.getScheduler().callSyncMethod(plugin, new Callable<Map<String, Object>>() {
                @Override
                public Map<String, Object> call() {
                    return buildSnapshotPayload();
                }
            });
            Map<String, Object> payload = future.get(2000L, TimeUnit.MILLISECONDS);
            httpClient.postJson(plugin.getEndpointPath("endpoints.playerSnapshotPath", "/v1/plugin/player_snapshot"),
                    payload,
                    plugin.isUploadFailureLogEnabled(),
                    "player snapshot");
        } catch (Exception exception) {
            if (plugin.isUploadFailureLogEnabled()) {
                plugin.getLogger().warning("Player snapshot error: " + exception.getMessage());
            }
        }
    }

    private Map<String, Object> buildSnapshotPayload() {
        LinkedHashMap<String, Object> payload = plugin.createBasePayload();
        payload.put("pluginVersion", plugin.getDescription().getVersion());
        payload.put("serverVersion", Bukkit.getVersion());
        payload.put("onlinePlayers", Integer.valueOf(Bukkit.getOnlinePlayers().size()));
        payload.put("maxPlayers", Integer.valueOf(Bukkit.getMaxPlayers()));
        payload.put("worlds", buildWorlds());
        payload.put("supports", plugin.createSupportFlags());
        payload.put("localControl", plugin.createLocalControlMetadata());
        payload.put("localControlToken", plugin.getLocalControlSettings().getToken());
        payload.put("players", buildPlayers());
        return payload;
    }

    private List<String> buildWorlds() {
        List<String> worlds = new ArrayList<String>();
        for (World world : Bukkit.getWorlds()) {
            worlds.add(world.getName());
        }
        return worlds;
    }

    private List<Map<String, Object>> buildPlayers() {
        FileConfiguration configuration = plugin.getConfig();
        boolean includePing = configuration.getBoolean("snapshot.includePing", true);
        List<Map<String, Object>> players = new ArrayList<Map<String, Object>>();
        for (Player player : Bukkit.getOnlinePlayers()) {
            LinkedHashMap<String, Object> item = new LinkedHashMap<String, Object>();
            item.put("uuid", player.getUniqueId().toString());
            item.put("name", player.getName());
            item.put("displayName", player.getDisplayName());
            item.put("world", player.getWorld().getName());
            item.put("gameMode", player.getGameMode().name());
            item.put("health", Double.valueOf(player.getHealth()));
            item.put("maxHealth", Double.valueOf(player.getMaxHealth()));
            item.put("foodLevel", Integer.valueOf(player.getFoodLevel()));
            item.put("level", Integer.valueOf(player.getLevel()));
            item.put("exp", Float.valueOf(player.getExp()));
            item.put("muted", Boolean.valueOf(plugin.getMuteService().getActiveMute(player.getUniqueId()) != null));
            MuteService.MuteRecord muteRecord = plugin.getMuteService().getActiveMute(player.getUniqueId());
            if (muteRecord != null) {
                item.put("muteReason", muteRecord.toMap().get("reason"));
                item.put("muteExpiresAt", muteRecord.toMap().get("expiresAt"));
                item.put("muteOperatorName", muteRecord.toMap().get("operatorName"));
            }
            if (includePing) {
                Integer ping = readPing(player);
                if (ping != null) {
                    item.put("ping", ping);
                }
            }
            players.add(item);
        }
        return players;
    }

    private Integer readPing(Player player) {
        try {
            Method method = player.getClass().getMethod("getHandle");
            Object handle = method.invoke(player);
            Field field = handle.getClass().getField("ping");
            return Integer.valueOf(field.getInt(handle));
        } catch (Exception ignored) {
            return null;
        }
    }
}
