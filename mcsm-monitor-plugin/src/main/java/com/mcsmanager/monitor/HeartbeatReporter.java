package com.mcsmanager.monitor;

import org.bukkit.Bukkit;
import org.bukkit.World;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.scheduler.BukkitTask;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

public final class HeartbeatReporter {
    private final MinecraftMonitorPlugin plugin;
    private final AgentHttpClient httpClient;
    private BukkitTask task;

    public HeartbeatReporter(MinecraftMonitorPlugin plugin, AgentHttpClient httpClient) {
        this.plugin = plugin;
        this.httpClient = httpClient;
    }

    public void start() {
        long interval = Math.max(20L, plugin.getConfig().getLong("heartbeatIntervalTicks", 100L));
        task = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, new Runnable() {
            @Override
            public void run() {
                sendHeartbeat();
            }
        }, interval, interval);
    }

    public void stop() {
        if (task != null) {
            task.cancel();
            task = null;
        }
    }

    private void sendHeartbeat() {
        try {
            Future<Map<String, Object>> future = Bukkit.getScheduler().callSyncMethod(plugin, new Callable<Map<String, Object>>() {
                @Override
                public Map<String, Object> call() {
                    return buildHeartbeatPayload();
                }
            });
            Map<String, Object> payload = future.get(2000L, TimeUnit.MILLISECONDS);
            httpClient.postJson(
                    plugin.getEndpointPath("endpoints.heartbeatPath", "/v1/plugin/heartbeat"),
                    payload,
                    isFailureLogEnabled(plugin.getConfig()),
                    "heartbeat");
        } catch (Exception exception) {
            if (isFailureLogEnabled(plugin.getConfig())) {
                plugin.getLogger().warning("Heartbeat error: " + exception.getMessage());
            }
        }
    }

    private boolean isFailureLogEnabled(FileConfiguration config) {
        return config.getBoolean("logHeartbeatFailures", config.getBoolean("logUploadFailures", true));
    }

    private Map<String, Object> buildHeartbeatPayload() {
        double[] tps = getTps();
        List<String> worlds = new ArrayList<String>();
        List<World> worldList = Bukkit.getWorlds();
        for (int index = 0; index < worldList.size(); index++) {
            worlds.add(worldList.get(index).getName());
        }

        LinkedHashMap<String, Object> payload = plugin.createBasePayload();
        LinkedHashMap<String, Object> tpsPayload = new LinkedHashMap<String, Object>();
        tpsPayload.put("oneMin", Double.valueOf(tps[0]));
        tpsPayload.put("fiveMin", Double.valueOf(tps[1]));
        tpsPayload.put("fifteenMin", Double.valueOf(tps[2]));

        payload.put("tps", tpsPayload);
        payload.put("onlinePlayers", Integer.valueOf(Bukkit.getOnlinePlayers().size()));
        payload.put("maxPlayers", Integer.valueOf(Bukkit.getMaxPlayers()));
        payload.put("worlds", worlds);
        payload.put("pluginVersion", plugin.getDescription().getVersion());
        payload.put("serverVersion", Bukkit.getVersion());
        payload.put("motd", Bukkit.getMotd());
        payload.put("mainThreadBlocked", Boolean.valueOf(plugin.isMainThreadBlocked()));
        payload.put("supports", plugin.createSupportFlags());
        payload.put("localControl", plugin.createLocalControlMetadata());
        return payload;
    }

    private double[] getTps() {
        return plugin.getCalculatedTps();
    }
}
