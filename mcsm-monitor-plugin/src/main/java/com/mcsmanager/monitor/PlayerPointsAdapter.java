package com.mcsmanager.monitor;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.plugin.Plugin;

import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.UUID;

final class PlayerPointsAdapter {
    boolean isAvailable() {
        return resolveApi() != null;
    }

    ActionResult execute(String operation, OfflinePlayer player, int amount) {
        Object api = resolveApi();
        if (api == null) {
            return ActionResult.error(409, "PlayerPoints API is unavailable.");
        }
        String normalized = normalizeOperation(operation);
        try {
            if ("balance".equals(normalized)) {
                int balance = queryBalance(api, player.getUniqueId());
                LinkedHashMap<String, Object> data = new LinkedHashMap<String, Object>();
                data.put("playerUuid", player.getUniqueId().toString());
                data.put("playerName", player.getName());
                data.put("points", Integer.valueOf(balance));
                return ActionResult.success("PlayerPoints balance loaded.", data);
            }

            if (amount < 0) {
                return ActionResult.error(400, "amount must be non-negative.");
            }

            boolean success;
            if ("set".equals(normalized)) {
                success = invokeBoolean(api, new String[]{"set", "setPoints"}, player.getUniqueId(), Integer.valueOf(amount));
            } else if ("take".equals(normalized) || "remove".equals(normalized) || "withdraw".equals(normalized)) {
                success = invokeBoolean(api, new String[]{"take", "takePoints", "remove"}, player.getUniqueId(), Integer.valueOf(amount));
            } else {
                success = invokeBoolean(api, new String[]{"give", "givePoints", "add"}, player.getUniqueId(), Integer.valueOf(amount));
            }

            int balance = queryBalance(api, player.getUniqueId());
            LinkedHashMap<String, Object> data = new LinkedHashMap<String, Object>();
            data.put("playerUuid", player.getUniqueId().toString());
            data.put("playerName", player.getName());
            data.put("points", Integer.valueOf(balance));
            data.put("amount", Integer.valueOf(amount));

            if (!success) {
                return ActionResult.error(409, "PlayerPoints action rejected.", data);
            }
            return ActionResult.success("PlayerPoints action executed.", data);
        } catch (Exception exception) {
            return ActionResult.error(500, "PlayerPoints action failed: " + exception.getMessage());
        }
    }

    private Object resolveApi() {
        Plugin plugin = Bukkit.getPluginManager().getPlugin("PlayerPoints");
        if (plugin == null || !plugin.isEnabled()) {
            return null;
        }
        try {
            Method method = plugin.getClass().getMethod("getAPI");
            return method.invoke(plugin);
        } catch (Exception ignored) {
            return null;
        }
    }

    private int queryBalance(Object api, UUID playerUuid) throws Exception {
        Object value = invokeValue(api, new String[]{"look", "get", "getPoints"}, playerUuid);
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        throw new IllegalStateException("PlayerPoints balance method not found.");
    }

    private boolean invokeBoolean(Object api, String[] methodNames, UUID playerUuid, Integer amount) throws Exception {
        Object result = invokeValue(api, methodNames, playerUuid, amount);
        if (result instanceof Boolean) {
            return ((Boolean) result).booleanValue();
        }
        return result != null;
    }

    private Object invokeValue(Object api, String[] methodNames, Object... arguments) throws Exception {
        Class<?>[] argumentTypes = new Class<?>[arguments.length];
        for (int index = 0; index < arguments.length; index++) {
            Object argument = arguments[index];
            if (argument instanceof Integer) {
                argumentTypes[index] = Integer.TYPE;
            } else {
                argumentTypes[index] = argument.getClass();
            }
        }

        for (String methodName : methodNames) {
            Method method = findMethod(api.getClass(), methodName, argumentTypes);
            if (method != null) {
                return method.invoke(api, arguments);
            }
            if (arguments.length > 0 && argumentTypes[0] == UUID.class) {
                Method stringMethod = findMethod(api.getClass(), methodName, replaceFirst(argumentTypes, String.class));
                if (stringMethod != null) {
                    Object[] converted = arguments.clone();
                    converted[0] = ((UUID) arguments[0]).toString();
                    return stringMethod.invoke(api, converted);
                }
            }
        }
        throw new NoSuchMethodException("PlayerPoints method not found.");
    }

    private Class<?>[] replaceFirst(Class<?>[] original, Class<?> replacement) {
        Class<?>[] copy = new Class<?>[original.length];
        System.arraycopy(original, 0, copy, 0, original.length);
        copy[0] = replacement;
        return copy;
    }

    private Method findMethod(Class<?> type, String name, Class<?>... parameterTypes) {
        try {
            return type.getMethod(name, parameterTypes);
        } catch (NoSuchMethodException ignored) {
            return null;
        }
    }

    private String normalizeOperation(String operation) {
        String normalized = operation == null ? "" : operation.trim().toLowerCase(Locale.ENGLISH);
        return normalized.isEmpty() ? "add" : normalized;
    }
}
