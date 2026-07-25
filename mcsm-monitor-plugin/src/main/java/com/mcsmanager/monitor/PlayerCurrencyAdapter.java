package com.mcsmanager.monitor;

import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class PlayerCurrencyAdapter {
    private static final String PLUGIN_NAME = "PlayerCurrency";
    private static final String API_CLASS_NAME = "cn.handyplus.currency.api.PlayerCurrencyApi";

    boolean isAvailable() {
        return resolveApiClass() != null;
    }

    String getStatusText() {
        Plugin plugin = Bukkit.getPluginManager().getPlugin(PLUGIN_NAME);
        if (plugin == null) {
            return "missing";
        }
        if (!plugin.isEnabled()) {
            return "disabled";
        }
        return resolveApiClass() == null ? "api-unavailable" : "available";
    }

    List<Map<String, Object>> listCurrencies(String defaultCurrency, String defaultCurrencyName) {
        List<Map<String, Object>> items = new ArrayList<Map<String, Object>>();
        Class<?> apiClass = resolveApiClass();
        if (apiClass == null) {
            items.add(buildCurrency(defaultCurrency, defaultCurrencyName));
            return items;
        }

        try {
            Method findAllType = apiClass.getMethod("findAllType");
            Object value = findAllType.invoke(null);
            if (value instanceof Iterable) {
                for (Object item : (Iterable<?>) value) {
                    String type = safeTrim(String.valueOf(item));
                    if (!type.isEmpty()) {
                        String fallbackName = type.equals(defaultCurrency) ? defaultCurrencyName : type;
                        items.add(buildCurrency(type, getDescription(apiClass, type, fallbackName)));
                    }
                }
            }
        } catch (Exception ignored) {
        }

        if (items.isEmpty()) {
            items.add(buildCurrency(defaultCurrency, defaultCurrencyName));
        }
        return items;
    }

    String getCurrencyName(String type, String fallback) {
        Class<?> apiClass = resolveApiClass();
        if (apiClass == null) return fallback;
        return getDescription(apiClass, type, fallback);
    }

    private Class<?> resolveApiClass() {
        Plugin plugin = Bukkit.getPluginManager().getPlugin(PLUGIN_NAME);
        if (plugin == null || !plugin.isEnabled()) {
            return null;
        }
        try {
            return Class.forName(API_CLASS_NAME, true, plugin.getClass().getClassLoader());
        } catch (ClassNotFoundException ignored) {
            return null;
        }
    }

    private Map<String, Object> buildCurrency(String type, String name) {
        LinkedHashMap<String, Object> item = new LinkedHashMap<String, Object>();
        item.put("type", type);
        item.put("name", name == null || name.trim().isEmpty() ? type : name.trim());
        item.put("totalBalance", Long.valueOf(0L));
        item.put("playerCount", Integer.valueOf(0));
        return item;
    }

    private String getDescription(Class<?> apiClass, String type, String fallback) {
        try {
            Method getDesc = apiClass.getMethod("getDesc", String.class);
            Object value = getDesc.invoke(null, type);
            String text = safeTrim(value == null ? "" : String.valueOf(value));
            return text.isEmpty() ? fallback : text;
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }
}
