package com.mcsmanager.monitor;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.HandlerList;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerChatEvent;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

final class ChatReporter implements Listener {
    private final MinecraftMonitorPlugin plugin;
    private final AgentHttpClient httpClient;
    private final ConcurrentHashMap<String, Long> recentMessages = new ConcurrentHashMap<String, Long>();
    private PlayerChatBridge playerChatBridge;

    ChatReporter(MinecraftMonitorPlugin plugin, AgentHttpClient httpClient) {
        this.plugin = plugin;
        this.httpClient = httpClient;
    }

    void start() {
        if (!plugin.getConfig().getBoolean("chatReporting.enabled", true)) {
            return;
        }

        Bukkit.getPluginManager().registerEvents(this, plugin);
        playerChatBridge = new PlayerChatBridge(plugin, new PlayerChatBridge.ChatCallback() {
            @Override
            public void onMessage(Player player,
                                  String message,
                                  String source,
                                  String channel,
                                  String tellPlayerName,
                                  List<String> mentionedPlayers,
                                  boolean cancelled,
                                  Runnable cancelAction) {
                handleIncomingChat(
                        player,
                        message,
                        source,
                        channel,
                        tellPlayerName,
                        mentionedPlayers,
                        cancelled,
                        cancelAction
                );
            }
        });
        playerChatBridge.start();
    }

    void stop() {
        HandlerList.unregisterAll(this);
        if (playerChatBridge != null) {
            playerChatBridge.stop();
            playerChatBridge = null;
        }
        recentMessages.clear();
    }

    boolean isPlayerChatBridgeActive() {
        return playerChatBridge != null && playerChatBridge.isActive();
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = false)
    public void onChatMute(AsyncPlayerChatEvent event) {
        if (plugin.getMuteService().applyMuteIfNeeded(event.getPlayer())) {
            event.setCancelled(true);
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = false)
    public void onChatReport(AsyncPlayerChatEvent event) {
        if (isPlayerChatBridgeActive()) {
            return;
        }
        handleIncomingChat(
                event.getPlayer(),
                event.getMessage(),
                "native",
                null,
                null,
                Collections.<String>emptyList(),
                event.isCancelled(),
                null
        );
    }

    private void handleIncomingChat(Player player,
                                    String message,
                                    String source,
                                    String channel,
                                    String tellPlayerName,
                                    List<String> mentionedPlayers,
                                    boolean cancelled,
                                    Runnable cancelAction) {
        if (player == null || message == null || message.trim().isEmpty()) {
            return;
        }

        if (plugin.getMuteService().getActiveMute(player.getUniqueId()) != null) {
            if (cancelAction != null) {
                cancelAction.run();
            }
            plugin.getMuteService().applyMuteIfNeeded(player);
            return;
        }

        if (cancelled && !plugin.getConfig().getBoolean("chatReporting.reportCancelled", false)) {
            return;
        }

        if (isDuplicate(player, message, source, channel, tellPlayerName)) {
            return;
        }

        final Map<String, Object> payload = buildPayload(
                player,
                message,
                source,
                channel,
                tellPlayerName,
                mentionedPlayers,
                cancelled
        );

        Bukkit.getScheduler().runTaskAsynchronously(plugin, new Runnable() {
            @Override
            public void run() {
                httpClient.postJson(
                        plugin.getEndpointPath("endpoints.chatMessagePath", "/v1/plugin/chat_message"),
                        payload,
                        plugin.isUploadFailureLogEnabled(),
                        "chat message");
            }
        });
    }

    private Map<String, Object> buildPayload(Player player,
                                             String message,
                                             String source,
                                             String channel,
                                             String tellPlayerName,
                                             List<String> mentionedPlayers,
                                             boolean cancelled) {
        LinkedHashMap<String, Object> payload = plugin.createBasePayload();
        payload.put("playerUuid", player.getUniqueId().toString());
        payload.put("playerName", player.getName());
        payload.put("displayName", player.getDisplayName());
        payload.put("world", player.getWorld().getName());
        payload.put("message", message);
        payload.put("source", source);
        payload.put("cancelled", Boolean.valueOf(cancelled));

        if (channel != null && !channel.trim().isEmpty()) {
            payload.put("channel", channel.trim());
        }
        if (tellPlayerName != null && !tellPlayerName.trim().isEmpty()) {
            payload.put("tellPlayerName", tellPlayerName.trim());
        }
        if (mentionedPlayers != null && !mentionedPlayers.isEmpty()) {
            payload.put("mentionedPlayers", mentionedPlayers);
        }
        return payload;
    }

    private boolean isDuplicate(Player player, String message, String source, String channel, String tellPlayerName) {
        long now = System.currentTimeMillis();
        cleanupRecent(now);

        StringBuilder keyBuilder = new StringBuilder();
        keyBuilder.append(player.getUniqueId()).append("|").append(message.trim());
        if (source != null) {
            keyBuilder.append("|").append(source.trim());
        }
        if (channel != null) {
            keyBuilder.append("|").append(channel.trim());
        }
        if (tellPlayerName != null) {
            keyBuilder.append("|").append(tellPlayerName.trim());
        }

        String key = keyBuilder.toString();
        Long previous = recentMessages.put(key, Long.valueOf(now));
        return previous != null && now - previous.longValue() < 1500L;
    }

    private void cleanupRecent(long now) {
        for (Map.Entry<String, Long> entry : recentMessages.entrySet()) {
            if (now - entry.getValue().longValue() > 3000L) {
                recentMessages.remove(entry.getKey());
            }
        }
    }
}
