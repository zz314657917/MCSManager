package com.mcsmanager.monitor;

import org.bukkit.Bukkit;
import org.bukkit.scheduler.BukkitTask;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

final class EconomySnapshotReporter {
    private final MinecraftMonitorPlugin plugin;
    private final AgentHttpClient httpClient;
    private BukkitTask task;

    EconomySnapshotReporter(MinecraftMonitorPlugin plugin, AgentHttpClient httpClient) {
        this.plugin = plugin;
        this.httpClient = httpClient;
    }

    void start() {
        long interval = Math.max(100L, plugin.getConfig().getLong("economy.snapshotIntervalTicks", 1200L));
        task = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, new Runnable() {
            @Override
            public void run() {
                sendSnapshot();
            }
        }, 40L, interval);
    }

    void stop() {
        if (task != null) {
            task.cancel();
            task = null;
        }
    }

    private void sendSnapshot() {
        if (!plugin.isEconomyReportingEnabled()) {
            return;
        }
        try {
            Future<Map<String, Object>> future = Bukkit.getScheduler().callSyncMethod(plugin, new Callable<Map<String, Object>>() {
                @Override
                public Map<String, Object> call() {
                    return buildSnapshotPayload();
                }
            });
            Map<String, Object> payload = future.get(2000L, TimeUnit.MILLISECONDS);
            httpClient.postJson(
                    plugin.getEndpointPath("endpoints.economySnapshotPath", "/v1/plugin/economy_snapshot"),
                    payload,
                    plugin.isUploadFailureLogEnabled(),
                    "economy snapshot");
        } catch (Exception exception) {
            if (plugin.isUploadFailureLogEnabled()) {
                plugin.getLogger().warning("Economy snapshot error: " + exception.getMessage());
            }
        }
    }

    private Map<String, Object> buildSnapshotPayload() {
        LinkedHashMap<String, Object> payload = plugin.createBasePayload();
        payload.put("provider", "PlayerCurrency");
        payload.put("providerStatus", plugin.getPlayerCurrencyAdapter().getStatusText());
        List<Map<String, Object>> currencies = plugin.getPlayerCurrencyAdapter().listCurrencies(
                plugin.getDefaultEconomyCurrencyType(),
                plugin.getDefaultEconomyCurrencyName());
        payload.put("currencies", currencies);
        return payload;
    }
}
