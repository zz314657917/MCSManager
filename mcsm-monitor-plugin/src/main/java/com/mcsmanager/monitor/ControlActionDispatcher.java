package com.mcsmanager.monitor;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

final class ControlActionDispatcher {
    private final MinecraftMonitorPlugin plugin;

    ControlActionDispatcher(MinecraftMonitorPlugin plugin) {
        this.plugin = plugin;
    }

    ActionResult dispatch(final Map<String, Object> request) {
        if (Bukkit.isPrimaryThread()) {
            return dispatchSync(request);
        }
        try {
            Future<ActionResult> future = Bukkit.getScheduler().callSyncMethod(plugin, new java.util.concurrent.Callable<ActionResult>() {
                @Override
                public ActionResult call() {
                    return dispatchSync(request);
                }
            });
            return future.get(plugin.getLocalControlSettings().getRequestTimeoutMs(), TimeUnit.MILLISECONDS);
        } catch (Exception exception) {
            return ActionResult.error(504, "Action execution timed out: " + exception.getMessage());
        }
    }

    private ActionResult dispatchSync(Map<String, Object> request) {
        String action = readString(request, "action");
        if (action.isEmpty()) {
            return ActionResult.error(400, "action is required.");
        }

        if ("economy".equalsIgnoreCase(action)) {
            return handleEconomy(request);
        }
        if ("points".equalsIgnoreCase(action)) {
            return handlePoints(request);
        }
        if ("luckperms".equalsIgnoreCase(action)) {
            return handleLuckPerms(request);
        }
        if ("mute".equalsIgnoreCase(action)) {
            return handleMute(request);
        }
        return ActionResult.error(400, "Unsupported action: " + action);
    }

    private ActionResult handleEconomy(Map<String, Object> request) {
        OfflinePlayer player = resolvePlayer(request, true);
        if (player == null) {
            return ActionResult.error(404, "Player not found.");
        }
        return plugin.getVaultEconomyAdapter().execute(readString(request, "operation"), player, readDouble(request, "amount"));
    }

    private ActionResult handlePoints(Map<String, Object> request) {
        OfflinePlayer player = resolvePlayer(request, true);
        if (player == null) {
            return ActionResult.error(404, "Player not found.");
        }
        return plugin.getPlayerPointsAdapter().execute(readString(request, "operation"), player, (int) Math.round(readDouble(request, "amount")));
    }

    private ActionResult handleLuckPerms(Map<String, Object> request) {
        OfflinePlayer player = resolvePlayer(request, true);
        if (player == null) {
            return ActionResult.error(404, "Player not found.");
        }
        return plugin.getLuckPermsAdapter().execute(readString(request, "operation"), player, request);
    }

    private ActionResult handleMute(Map<String, Object> request) {
        OfflinePlayer player = resolvePlayer(request, true);
        if (player == null) {
            return ActionResult.error(404, "Player not found.");
        }
        String operation = readString(request, "operation");
        if (operation.isEmpty()) {
            operation = "mute";
        }
        if ("status".equalsIgnoreCase(operation)) {
            return plugin.getMuteService().queryStatus(player);
        }
        if ("unmute".equalsIgnoreCase(operation) || "remove".equalsIgnoreCase(operation)) {
            return plugin.getMuteService().unmutePlayer(player);
        }
        return plugin.getMuteService().mutePlayer(
                player,
                readLong(request, "durationSeconds"),
                readString(request, "reason"),
                readString(request, "operatorName")
        );
    }

    private OfflinePlayer resolvePlayer(Map<String, Object> request, boolean allowOffline) {
        String uuidValue = readString(request, "playerUuid");
        if (!uuidValue.isEmpty()) {
            try {
                return Bukkit.getOfflinePlayer(UUID.fromString(uuidValue));
            } catch (IllegalArgumentException ignored) {
                return null;
            }
        }

        String playerName = readString(request, "player");
        if (playerName.isEmpty()) {
            playerName = readString(request, "playerName");
        }
        if (playerName.isEmpty()) {
            return null;
        }

        Player onlinePlayer = Bukkit.getPlayerExact(playerName);
        if (onlinePlayer != null) {
            return onlinePlayer;
        }
        if (!allowOffline) {
            return null;
        }
        for (OfflinePlayer offlinePlayer : Bukkit.getOfflinePlayers()) {
            if (offlinePlayer.getName() != null && offlinePlayer.getName().equalsIgnoreCase(playerName)) {
                return offlinePlayer;
            }
        }
        return null;
    }

    private String readString(Map<String, Object> request, String key) {
        Object value = request.get(key);
        return value == null ? "" : String.valueOf(value).trim();
    }

    private double readDouble(Map<String, Object> request, String key) {
        Object value = request.get(key);
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        if (value == null) {
            return 0D;
        }
        try {
            return Double.parseDouble(String.valueOf(value).trim());
        } catch (NumberFormatException ignored) {
            return 0D;
        }
    }

    private long readLong(Map<String, Object> request, String key) {
        Object value = request.get(key);
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        if (value == null) {
            return 0L;
        }
        try {
            return Long.parseLong(String.valueOf(value).trim());
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    Map<String, Object> buildHealthPayload() {
        LinkedHashMap<String, Object> payload = new LinkedHashMap<String, Object>();
        payload.put("ok", Boolean.TRUE);
        payload.put("pluginVersion", plugin.getDescription().getVersion());
        payload.put("serverVersion", Bukkit.getVersion());
        payload.put("mutedPlayers", Integer.valueOf(plugin.getMuteService().getActiveMuteCount()));
        payload.put("supports", plugin.createSupportFlags());
        payload.put("localControl", plugin.createLocalControlMetadata());
        return payload;
    }
}
