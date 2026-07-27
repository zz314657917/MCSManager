package com.mcsmanager.monitor;

import org.bukkit.Bukkit;
import org.bukkit.event.Event;
import org.bukkit.event.EventException;
import org.bukkit.event.EventPriority;
import org.bukkit.event.HandlerList;
import org.bukkit.event.Listener;
import org.bukkit.plugin.EventExecutor;
import org.bukkit.plugin.Plugin;

import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

final class EconomyEventReporter implements Listener {
    private static final String EVENT_CLASS_NAME = "cn.handyplus.currency.event.PlayerCurrencyChangeSuccessEvent";

    private final MinecraftMonitorPlugin plugin;
    private final AgentHttpClient httpClient;
    private boolean registered;

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
    }

    void stop() {
        HandlerList.unregisterAll(this);
        registered = false;
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
            final Map<String, Object> payload = buildPayload(event);
            Bukkit.getScheduler().runTaskAsynchronously(plugin, new Runnable() {
                @Override
                public void run() {
                    httpClient.postJson(
                            plugin.getEndpointPath("endpoints.economyEventPath", "/v1/plugin/economy_event"),
                            payload,
                            plugin.isUploadFailureLogEnabled(),
                            "economy event");
                }
            });
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
        return payload;
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
}
