package com.mcsmanager.monitor;

import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.OfflinePlayer;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Method;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

final class MuteService {
    private static final String PLAYER_CHAT_API_CLASS = "cn.handyplus.chat.api.PlayerChatApi";
    private static final String PLAYER_CHAT_MUTE_SERVICE_CLASS = "cn.handyplus.chat.service.ChatPlayerMuteService";

    private final MinecraftMonitorPlugin plugin;
    private final ConcurrentHashMap<UUID, MuteRecord> mutedPlayers = new ConcurrentHashMap<UUID, MuteRecord>();

    MuteService(MinecraftMonitorPlugin plugin) {
        this.plugin = plugin;
    }

    synchronized void load() {
        mutedPlayers.clear();
        if (!plugin.getConfig().getBoolean("mute.persistToDisk", true)) {
            return;
        }

        File file = getStorageFile();
        if (!file.isFile()) {
            return;
        }

        YamlConfiguration configuration = YamlConfiguration.loadConfiguration(file);
        ConfigurationSection section = configuration.getConfigurationSection("mutes");
        if (section == null) {
            return;
        }

        for (String key : section.getKeys(false)) {
            try {
                UUID uuid = UUID.fromString(key);
                String basePath = "mutes." + key + ".";
                String playerName = configuration.getString(basePath + "playerName", "");
                long expiresAt = configuration.getLong(basePath + "expiresAt", 0L);
                String reason = configuration.getString(basePath + "reason", defaultReason());
                String operatorName = configuration.getString(basePath + "operatorName", plugin.getName());
                long updatedAt = configuration.getLong(basePath + "updatedAt", System.currentTimeMillis());
                MuteRecord record = new MuteRecord(uuid, playerName, expiresAt, reason, operatorName, updatedAt);
                if (!record.isExpired()) {
                    mutedPlayers.put(uuid, record);
                }
            } catch (IllegalArgumentException ignored) {
            }
        }
    }

    synchronized void save() {
        if (!plugin.getConfig().getBoolean("mute.persistToDisk", true)) {
            return;
        }

        cleanupExpiredLocal();
        File file = getStorageFile();
        if (file.getParentFile() != null && !file.getParentFile().isDirectory()) {
            file.getParentFile().mkdirs();
        }

        YamlConfiguration configuration = new YamlConfiguration();
        for (MuteRecord record : mutedPlayers.values()) {
            String basePath = "mutes." + record.uuid.toString() + ".";
            configuration.set(basePath + "playerName", record.playerName);
            configuration.set(basePath + "expiresAt", Long.valueOf(record.expiresAt));
            configuration.set(basePath + "reason", record.reason);
            configuration.set(basePath + "operatorName", record.operatorName);
            configuration.set(basePath + "updatedAt", Long.valueOf(record.updatedAt));
        }

        try {
            configuration.save(file);
        } catch (IOException exception) {
            plugin.getLogger().warning("Failed to save mute data: " + exception.getMessage());
        }
    }

    synchronized ActionResult mutePlayer(OfflinePlayer player, long durationSeconds, String reason) {
        return mutePlayer(player, durationSeconds, reason, null);
    }

    synchronized ActionResult mutePlayer(OfflinePlayer player, long durationSeconds, String reason, String operatorName) {
        if (player == null || player.getUniqueId() == null) {
            return ActionResult.error(404, "Player not found.");
        }

        if (durationSeconds <= 0L) {
            return ActionResult.error(400, "durationSeconds must be greater than 0.");
        }

        String finalReason = safeReason(reason);
        String finalOperatorName = safeOperatorName(operatorName);
        long expiresAt = System.currentTimeMillis() + durationSeconds * 1000L;

        if (isPlayerChatAvailable()) {
            boolean success = invokePlayerChatMute(player, durationSeconds, finalReason, finalOperatorName);
            if (!success) {
                return ActionResult.error(409, "PlayerChat mute action was rejected.");
            }

            mutedPlayers.remove(player.getUniqueId());
            save();

            MuteRecord record = queryPlayerChatMute(player.getUniqueId());
            if (record == null) {
                record = new MuteRecord(
                        player.getUniqueId(),
                        safePlayerName(player),
                        expiresAt,
                        finalReason,
                        finalOperatorName,
                        System.currentTimeMillis()
                );
            }

            notifyPlayer(player.getPlayer(), ChatColor.RED + "You have been muted: " + finalReason);
            return ActionResult.success("Player muted.", record.toMap());
        }

        MuteRecord record = new MuteRecord(
                player.getUniqueId(),
                safePlayerName(player),
                expiresAt,
                finalReason,
                finalOperatorName,
                System.currentTimeMillis()
        );
        mutedPlayers.put(record.uuid, record);
        save();
        notifyPlayer(player.getPlayer(), ChatColor.RED + "You have been muted: " + finalReason);
        return ActionResult.success("Player muted.", record.toMap());
    }

    synchronized ActionResult unmutePlayer(OfflinePlayer player) {
        if (player == null || player.getUniqueId() == null) {
            return ActionResult.error(404, "Player not found.");
        }

        MuteRecord activeRecord = queryPlayerChatMute(player.getUniqueId());
        if (activeRecord == null) {
            activeRecord = getLocalMute(player.getUniqueId());
        }
        if (activeRecord == null) {
            return ActionResult.error(404, "Player is not muted.");
        }

        if (isPlayerChatAvailable()) {
            boolean success = invokePlayerChatUnmute(player);
            if (!success && queryPlayerChatMute(player.getUniqueId()) != null) {
                return ActionResult.error(409, "PlayerChat unmute action was rejected.");
            }
        }

        mutedPlayers.remove(player.getUniqueId());
        save();
        notifyPlayer(player.getPlayer(), ChatColor.YELLOW + "Your mute has been removed.");
        return ActionResult.success("Player unmuted.", activeRecord.toMap());
    }

    synchronized ActionResult queryStatus(OfflinePlayer player) {
        if (player == null || player.getUniqueId() == null) {
            return ActionResult.error(404, "Player not found.");
        }

        MuteRecord record = getActiveMute(player.getUniqueId());
        if (record == null) {
            return ActionResult.success("Player is not muted.");
        }
        return ActionResult.success("Player is muted.", record.toMap());
    }

    synchronized MuteRecord getActiveMute(UUID playerUuid) {
        if (playerUuid == null) {
            return null;
        }

        MuteRecord record = queryPlayerChatMute(playerUuid);
        if (record != null) {
            return record;
        }
        return getLocalMute(playerUuid);
    }

    synchronized int getActiveMuteCount() {
        int playerChatCount = countPlayerChatMutes();
        if (playerChatCount >= 0) {
            return playerChatCount;
        }
        cleanupExpiredLocal();
        return mutedPlayers.size();
    }

    boolean applyMuteIfNeeded(Player player) {
        MuteRecord record = getActiveMute(player.getUniqueId());
        if (record == null) {
            return false;
        }
        notifyPlayer(player, ChatColor.RED + "You are muted: " + record.reason);
        return true;
    }

    private MuteRecord getLocalMute(UUID playerUuid) {
        MuteRecord record = mutedPlayers.get(playerUuid);
        if (record == null) {
            return null;
        }
        if (record.isExpired()) {
            mutedPlayers.remove(playerUuid);
            save();
            return null;
        }
        return record;
    }

    private void cleanupExpiredLocal() {
        for (Map.Entry<UUID, MuteRecord> entry : mutedPlayers.entrySet()) {
            if (entry.getValue().isExpired()) {
                mutedPlayers.remove(entry.getKey());
            }
        }
    }

    private int countPlayerChatMutes() {
        Object service = resolveSingleton(PLAYER_CHAT_MUTE_SERVICE_CLASS);
        if (service == null) {
            return -1;
        }

        try {
            Method findAll = service.getClass().getMethod("findAll");
            Object result = findAll.invoke(service);
            if (!(result instanceof List)) {
                return -1;
            }

            int count = 0;
            for (Object item : (List<?>) result) {
                Date expireTime = readDate(item, "getExpireTime");
                if (expireTime == null || expireTime.after(new Date())) {
                    count++;
                }
            }
            return count;
        } catch (Exception ignored) {
            return -1;
        }
    }

    private MuteRecord queryPlayerChatMute(UUID playerUuid) {
        Object service = resolveSingleton(PLAYER_CHAT_MUTE_SERVICE_CLASS);
        if (service == null || playerUuid == null) {
            return null;
        }

        try {
            Method findActiveMute = service.getClass().getMethod("findActiveMute", UUID.class);
            Object optional = findActiveMute.invoke(service, playerUuid);
            Object record = unwrapOptional(optional);
            if (record == null) {
                return null;
            }

            Date expireTime = readDate(record, "getExpireTime");
            long expiresAt = expireTime == null ? 0L : expireTime.getTime();
            MuteRecord muteRecord = new MuteRecord(
                    playerUuid,
                    readString(record, "getPlayerName", playerUuid.toString()),
                    expiresAt,
                    readString(record, "getReason", defaultReason()),
                    readString(record, "getOperatorName", plugin.getName()),
                    System.currentTimeMillis()
            );
            return muteRecord.isExpired() ? null : muteRecord;
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean invokePlayerChatMute(OfflinePlayer player, long durationSeconds, String reason, String operatorName) {
        Object api = resolveSingleton(PLAYER_CHAT_API_CLASS);
        if (api == null) {
            return false;
        }

        try {
            Method method = api.getClass().getMethod(
                    "mutePlayer",
                    OfflinePlayer.class,
                    Integer.TYPE,
                    String.class,
                    String.class
            );
            Object result = method.invoke(
                    api,
                    player,
                    Integer.valueOf((int) Math.min(Integer.MAX_VALUE, durationSeconds)),
                    reason,
                    operatorName
            );
            return result instanceof Boolean && ((Boolean) result).booleanValue();
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean invokePlayerChatUnmute(OfflinePlayer player) {
        Object api = resolveSingleton(PLAYER_CHAT_API_CLASS);
        if (api == null) {
            return false;
        }

        try {
            Method method = api.getClass().getMethod("unmutePlayer", OfflinePlayer.class);
            Object result = method.invoke(api, player);
            return result instanceof Boolean && ((Boolean) result).booleanValue();
        } catch (Exception ignored) {
            return false;
        }
    }

    private Object resolveSingleton(String className) {
        Plugin targetPlugin = Bukkit.getPluginManager().getPlugin("PlayerChat");
        if (targetPlugin == null || !targetPlugin.isEnabled()) {
            return null;
        }

        try {
            Class<?> type = Class.forName(className, true, targetPlugin.getClass().getClassLoader());
            Method getInstance = type.getMethod("getInstance");
            return getInstance.invoke(null);
        } catch (Exception ignored) {
            return null;
        }
    }

    private Object unwrapOptional(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof java.util.Optional) {
            java.util.Optional<?> optional = (java.util.Optional<?>) value;
            return optional.isPresent() ? optional.get() : null;
        }
        return value;
    }

    private Date readDate(Object target, String methodName) {
        try {
            Method method = target.getClass().getMethod(methodName);
            Object value = method.invoke(target);
            return value instanceof Date ? (Date) value : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private String readString(Object target, String methodName, String defaultValue) {
        try {
            Method method = target.getClass().getMethod(methodName);
            Object value = method.invoke(target);
            if (value == null) {
                return defaultValue;
            }
            String text = String.valueOf(value).trim();
            return text.isEmpty() ? defaultValue : text;
        } catch (Exception ignored) {
            return defaultValue;
        }
    }

    private boolean isPlayerChatAvailable() {
        Plugin targetPlugin = Bukkit.getPluginManager().getPlugin("PlayerChat");
        return targetPlugin != null && targetPlugin.isEnabled() && resolveSingleton(PLAYER_CHAT_API_CLASS) != null;
    }

    private File getStorageFile() {
        String configuredName = plugin.getConfig().getString("mute.storageFile", "mutes.yml");
        String fileName = configuredName == null || configuredName.trim().isEmpty() ? "mutes.yml" : configuredName.trim();
        return new File(plugin.getDataFolder(), fileName);
    }

    private void notifyPlayer(final Player player, final String message) {
        if (player == null || !plugin.getConfig().getBoolean("mute.notifyPlayer", true)) {
            return;
        }
        if (Bukkit.isPrimaryThread()) {
            player.sendMessage(message);
            return;
        }
        Bukkit.getScheduler().runTask(plugin, new Runnable() {
            @Override
            public void run() {
                player.sendMessage(message);
            }
        });
    }

    private String safeReason(String reason) {
        String trimmed = reason == null ? "" : reason.trim();
        return trimmed.isEmpty() ? defaultReason() : trimmed;
    }

    private String safeOperatorName(String operatorName) {
        String trimmed = operatorName == null ? "" : operatorName.trim();
        return trimmed.isEmpty() ? plugin.getName() : trimmed;
    }

    private String defaultReason() {
        return plugin.getConfig().getString("mute.defaultReason", "Muted by GM");
    }

    private String safePlayerName(OfflinePlayer player) {
        if (player.getName() != null && !player.getName().trim().isEmpty()) {
            return player.getName();
        }
        return player.getUniqueId().toString();
    }

    static final class MuteRecord {
        private final UUID uuid;
        private final String playerName;
        private final long expiresAt;
        private final String reason;
        private final String operatorName;
        private final long updatedAt;

        private MuteRecord(UUID uuid, String playerName, long expiresAt, String reason, String operatorName, long updatedAt) {
            this.uuid = uuid;
            this.playerName = playerName == null ? "" : playerName;
            this.expiresAt = expiresAt;
            this.reason = reason == null ? "" : reason;
            this.operatorName = operatorName == null ? "" : operatorName;
            this.updatedAt = updatedAt;
        }

        boolean isExpired() {
            return expiresAt > 0L && System.currentTimeMillis() > expiresAt;
        }

        Map<String, Object> toMap() {
            LinkedHashMap<String, Object> data = new LinkedHashMap<String, Object>();
            data.put("playerUuid", uuid.toString());
            data.put("playerName", playerName);
            data.put("reason", reason);
            data.put("operatorName", operatorName);
            data.put("expiresAt", Long.valueOf(expiresAt));
            return data;
        }
    }
}
