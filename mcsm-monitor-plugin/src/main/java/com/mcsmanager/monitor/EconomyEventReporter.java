package com.mcsmanager.monitor;

import org.bukkit.Bukkit;
import org.bukkit.event.Event;
import org.bukkit.event.EventException;
import org.bukkit.event.EventPriority;
import org.bukkit.event.HandlerList;
import org.bukkit.event.Listener;
import org.bukkit.plugin.EventExecutor;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitTask;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayDeque;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

final class EconomyEventReporter implements Listener {
    private static final String EVENT_CLASS_NAME = "cn.handyplus.currency.event.PlayerCurrencyChangeSuccessEvent";

    private final MinecraftMonitorPlugin plugin;
    private final AgentHttpClient httpClient;
    private final Object queueLock = new Object();
    private final ArrayDeque<PendingEvent> queue = new ArrayDeque<PendingEvent>();
    private boolean registered;
    private BukkitTask workerTask;
    private long lastQueueWarningAt;

    EconomyEventReporter(MinecraftMonitorPlugin plugin, AgentHttpClient httpClient) {
        this.plugin = plugin;
        this.httpClient = httpClient;
    }

    void start() {
        if (!plugin.isEconomyReportingEnabled() || registered) {
            return;
        }
        Class<? extends Event> eventClass = resolveEventClass();
        if (eventClass == null) {
            plugin.getLogger().info("PlayerCurrency event API is unavailable; economy event reporter is idle.");
            return;
        }
        Bukkit.getPluginManager().registerEvent(
                eventClass,
                this,
                EventPriority.MONITOR,
                new EventExecutor() {
                    @Override
                    public void execute(Listener listener, Event event) throws EventException {
                        handleEvent(event);
                    }
                },
                plugin,
                true);
        registered = true;
        workerTask = Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, new Runnable() {
            @Override
            public void run() {
                drainQueue();
            }
        }, 1L, 10L);
    }

    void stop() {
        HandlerList.unregisterAll(this);
        registered = false;
        if (workerTask != null) {
            workerTask.cancel();
            workerTask = null;
        }
        synchronized (queueLock) {
            queue.clear();
        }
    }

    private Class<? extends Event> resolveEventClass() {
        Plugin playerCurrency = Bukkit.getPluginManager().getPlugin("PlayerCurrency");
        if (playerCurrency == null || !playerCurrency.isEnabled()) {
            return null;
        }
        try {
            Class<?> type = Class.forName(EVENT_CLASS_NAME, true, playerCurrency.getClass().getClassLoader());
            if (Event.class.isAssignableFrom(type)) {
                @SuppressWarnings("unchecked")
                Class<? extends Event> eventType = (Class<? extends Event>) type;
                return eventType;
            }
        } catch (ClassNotFoundException ignored) {
        }
        return null;
    }

    private void handleEvent(Event event) {
        try {
            Map<String, Object> payload = buildPayload(event);
            enqueue(new PendingEvent(payload));
        } catch (Exception exception) {
            if (plugin.isUploadFailureLogEnabled()) {
                plugin.getLogger().warning("Economy event error: " + exception.getMessage());
            }
        }
    }

    private Map<String, Object> buildPayload(Object event) throws Exception {
        LinkedHashMap<String, Object> payload = plugin.createBasePayload();
        UUID playerUuid = (UUID) invoke(event, "getPlayerUuid");
        String currencyType = safeTrim((String) invoke(event, "getType"));
        Long change = (Long) invoke(event, "getChange");
        Long balance = (Long) invoke(event, "getBalance");
        String operatorName = safeTrim((String) invoke(event, "getOperatorName"));
        String operatorReason = safeTrim((String) invoke(event, "getOperatorReason"));

        if (currencyType.isEmpty()) {
            currencyType = plugin.getDefaultEconomyCurrencyType();
        }

        payload.put("playerUuid", playerUuid == null ? "" : playerUuid.toString());
        payload.put("currencyType", currencyType);
        payload.put("currencyName", plugin.getPlayerCurrencyAdapter().getCurrencyName(currencyType, plugin.getDefaultEconomyCurrencyName()));
        payload.put("delta", change == null ? Long.valueOf(0L) : change);
        payload.put("balanceAfter", balance == null ? Long.valueOf(0L) : balance);
        payload.put("operatorName", operatorName);
        payload.put("operatorReason", operatorReason);
        payload.put("category", resolveCategory(operatorReason, change == null ? 0L : change.longValue()));
        payload.put("referenceId", buildReferenceId(event, payload, playerUuid, currencyType, change, balance,
                operatorName, operatorReason));
        return payload;
    }

    private void enqueue(PendingEvent pendingEvent) {
        synchronized (queueLock) {
            if (queue.size() >= queueCapacity()) {
                long now = System.currentTimeMillis();
                if (now - lastQueueWarningAt >= 60000L) {
                    lastQueueWarningAt = now;
                    plugin.getLogger().warning("Economy event queue is full; dropping new events.");
                }
                return;
            }
            queue.addLast(pendingEvent);
        }
    }

    private void drainQueue() {
        for (int index = 0; index < 16; index++) {
            PendingEvent pending = pollReady();
            if (pending == null) {
                return;
            }
            AgentHttpClient.HttpResult result = httpClient.postJson(
                    plugin.getEndpointPath("endpoints.economyEventPath", "/v1/plugin/economy_event"),
                    pending.payload,
                    plugin.isUploadFailureLogEnabled(),
                    "economy event");
            if (result.isSuccess()) {
                continue;
            }
            if (pending.attempts >= maxRetries()) {
                continue;
            }
            pending.attempts++;
            pending.nextAttemptAt = System.currentTimeMillis() + retryDelay(pending.attempts);
            synchronized (queueLock) {
                if (queue.size() < queueCapacity()) {
                    queue.addLast(pending);
                }
            }
        }
    }

    private PendingEvent pollReady() {
        synchronized (queueLock) {
            int size = queue.size();
            long now = System.currentTimeMillis();
            for (int index = 0; index < size; index++) {
                PendingEvent pending = queue.removeFirst();
                if (pending.nextAttemptAt <= now) {
                    return pending;
                }
                queue.addLast(pending);
            }
            return null;
        }
    }

    private int queueCapacity() {
        return Math.max(16, plugin.getConfig().getInt("economy.eventQueueCapacity", 256));
    }

    private int maxRetries() {
        return Math.max(0, plugin.getConfig().getInt("economy.eventMaxRetries", 3));
    }

    private long retryDelay(int attempt) {
        long delay = 1000L << Math.min(4, Math.max(0, attempt - 1));
        return Math.min(30000L, delay);
    }

    private String buildReferenceId(Object event, Map<String, Object> payload, UUID playerUuid,
            String currencyType, Long change, Long balance, String operatorName, String operatorReason) {
        String explicit = firstNonEmpty(
                optionalString(event, "getReferenceId"),
                optionalString(event, "getTransactionId"),
                optionalString(event, "getTransactionUuid"),
                optionalString(event, "getUniqueId"),
                optionalString(event, "getId"));
        if (!explicit.isEmpty()) {
            return explicit;
        }
        String eventTime = firstNonEmpty(
                optionalString(event, "getTimestamp"),
                optionalString(event, "getOccurredAt"),
                optionalString(event, "getTime"));
        String basis = String.valueOf(payload.get("serverId")) + "|"
                + String.valueOf(playerUuid) + "|"
                + currencyType + "|"
                + String.valueOf(change) + "|"
                + String.valueOf(balance) + "|"
                + operatorName + "|"
                + operatorReason + "|"
                + eventTime + "|"
                + String.valueOf(payload.get("timestamp"));
        return "playercurrency:" + sha256(basis);
    }

    private String optionalString(Object target, String methodName) {
        try {
            Object value = target.getClass().getMethod(methodName).invoke(target);
            return value == null ? "" : String.valueOf(value).trim();
        } catch (Exception ignored) {
            return "";
        }
    }

    private String firstNonEmpty(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return "";
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(digest.length * 2);
            for (byte item : digest) {
                result.append(String.format("%02x", Byte.valueOf(item)));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException exception) {
            return Integer.toHexString(value.hashCode());
        }
    }

    private Object invoke(Object target, String methodName) throws Exception {
        Method method = target.getClass().getMethod(methodName);
        return method.invoke(target);
    }

    private String resolveCategory(String reason, long delta) {
        if (reason != null && reason.startsWith("ECO|")) {
            String[] parts = reason.split("\\|");
            for (String part : parts) {
                if (part.startsWith("category=")) {
                    return part.substring("category=".length());
                }
            }
        }
        if (delta > 0L) return "SYSTEM_IN";
        if (delta < 0L) return "SYSTEM_OUT";
        return "UNKNOWN";
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }

    private static final class PendingEvent {
        private final Map<String, Object> payload;
        private int attempts;
        private long nextAttemptAt;

        private PendingEvent(Map<String, Object> payload) {
            this.payload = payload;
        }
    }
}
