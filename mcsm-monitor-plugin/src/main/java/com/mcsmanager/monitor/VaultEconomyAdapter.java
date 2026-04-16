package com.mcsmanager.monitor;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.RegisteredServiceProvider;
import org.bukkit.plugin.ServicesManager;

import java.lang.reflect.Method;
import java.util.LinkedHashMap;

final class VaultEconomyAdapter {
    boolean isAvailable() {
        return resolveProvider() != null;
    }

    ActionResult execute(String operation, OfflinePlayer player, double amount) {
        Object provider = resolveProvider();
        if (provider == null) {
            return ActionResult.error(409, "Vault economy provider is unavailable.");
        }
        String normalized = normalizeOperation(operation);
        try {
            if ("balance".equals(normalized)) {
                double balance = getBalance(provider, player);
                LinkedHashMap<String, Object> data = new LinkedHashMap<String, Object>();
                data.put("playerUuid", player.getUniqueId().toString());
                data.put("playerName", player.getName());
                data.put("balance", Double.valueOf(balance));
                return ActionResult.success("Economy balance loaded.", data);
            }

            if (amount < 0D) {
                return ActionResult.error(400, "amount must be non-negative.");
            }

            if ("set".equals(normalized)) {
                double balance = getBalance(provider, player);
                double delta = amount - balance;
                if (delta >= 0D) {
                    return applyTransaction(provider, "deposit", player, delta);
                }
                return applyTransaction(provider, "withdraw", player, Math.abs(delta));
            }

            return applyTransaction(provider, normalized, player, amount);
        } catch (Exception exception) {
            return ActionResult.error(500, "Vault economy action failed: " + exception.getMessage());
        }
    }

    private ActionResult applyTransaction(Object provider, String operation, OfflinePlayer player, double amount) throws Exception {
        Object response;
        if ("add".equals(operation) || "deposit".equals(operation) || "give".equals(operation)) {
            response = invokeTransaction(provider, new String[]{"depositPlayer"}, player, amount);
        } else if ("take".equals(operation) || "remove".equals(operation) || "withdraw".equals(operation)) {
            response = invokeTransaction(provider, new String[]{"withdrawPlayer"}, player, amount);
        } else {
            return ActionResult.error(400, "Unsupported economy operation: " + operation);
        }

        boolean success = readBoolean(response, "transactionSuccess", true);
        double balance = readDouble(response, "balance", getBalance(provider, player));
        String errorMessage = readString(response, "errorMessage", "");

        LinkedHashMap<String, Object> data = new LinkedHashMap<String, Object>();
        data.put("playerUuid", player.getUniqueId().toString());
        data.put("playerName", player.getName());
        data.put("balance", Double.valueOf(balance));
        data.put("amount", Double.valueOf(amount));

        if (!success) {
            return ActionResult.error(409, errorMessage.isEmpty() ? "Economy action rejected." : errorMessage, data);
        }
        return ActionResult.success("Economy action executed.", data);
    }

    private Object resolveProvider() {
        Plugin vault = Bukkit.getPluginManager().getPlugin("Vault");
        if (vault == null || !vault.isEnabled()) {
            return null;
        }
        try {
            Class<?> economyClass = Class.forName("net.milkbowl.vault.economy.Economy", true, vault.getClass().getClassLoader());
            ServicesManager servicesManager = Bukkit.getServicesManager();
            RegisteredServiceProvider<?> registration = servicesManager.getRegistration(economyClass);
            if (registration == null) {
                return null;
            }
            return registration.getProvider();
        } catch (ClassNotFoundException ignored) {
            return null;
        }
    }

    private Object invokeTransaction(Object provider, String[] methodNames, OfflinePlayer player, double amount) throws Exception {
        Method method = findMethod(provider.getClass(), methodNames, OfflinePlayer.class, Double.TYPE);
        if (method != null) {
            return method.invoke(provider, player, Double.valueOf(amount));
        }
        method = findMethod(provider.getClass(), methodNames, String.class, Double.TYPE);
        if (method != null) {
            return method.invoke(provider, player.getName(), Double.valueOf(amount));
        }
        throw new NoSuchMethodException("No matching Vault economy transaction method found.");
    }

    private double getBalance(Object provider, OfflinePlayer player) throws Exception {
        Method method = findMethod(provider.getClass(), new String[]{"getBalance"}, OfflinePlayer.class);
        if (method != null) {
            Object result = method.invoke(provider, player);
            return ((Number) result).doubleValue();
        }
        method = findMethod(provider.getClass(), new String[]{"getBalance"}, String.class);
        if (method != null) {
            Object result = method.invoke(provider, player.getName());
            return ((Number) result).doubleValue();
        }
        throw new NoSuchMethodException("No matching Vault getBalance method found.");
    }

    private Method findMethod(Class<?> type, String[] names, Class<?>... parameterTypes) {
        for (String name : names) {
            try {
                return type.getMethod(name, parameterTypes);
            } catch (NoSuchMethodException ignored) {
            }
        }
        return null;
    }

    private boolean readBoolean(Object target, String methodName, boolean defaultValue) {
        try {
            Method method = target.getClass().getMethod(methodName);
            Object value = method.invoke(target);
            return value instanceof Boolean ? ((Boolean) value).booleanValue() : defaultValue;
        } catch (Exception ignored) {
            return defaultValue;
        }
    }

    private double readDouble(Object target, String methodName, double defaultValue) {
        try {
            Method method = target.getClass().getMethod(methodName);
            Object value = method.invoke(target);
            return value instanceof Number ? ((Number) value).doubleValue() : defaultValue;
        } catch (Exception ignored) {
            return defaultValue;
        }
    }

    private String readString(Object target, String methodName, String defaultValue) {
        try {
            Method method = target.getClass().getMethod(methodName);
            Object value = method.invoke(target);
            return value == null ? defaultValue : String.valueOf(value);
        } catch (Exception ignored) {
            return defaultValue;
        }
    }

    private String normalizeOperation(String operation) {
        String normalized = operation == null ? "" : operation.trim().toLowerCase(java.util.Locale.ENGLISH);
        return normalized.isEmpty() ? "add" : normalized;
    }
}
