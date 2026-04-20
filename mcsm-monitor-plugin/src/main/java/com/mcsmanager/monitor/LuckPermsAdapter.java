package com.mcsmanager.monitor;

import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.plugin.Plugin;

import java.lang.reflect.Method;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

final class LuckPermsAdapter {
    boolean isAvailable() {
        return resolveApi() != null;
    }

    ActionResult execute(String operation, OfflinePlayer player, Map<String, Object> request) {
        Object api = resolveApi();
        if (api == null) {
            return ActionResult.error(409, "LuckPerms is unavailable.");
        }
        if (player == null || player.getUniqueId() == null) {
            return ActionResult.error(404, "Player not found.");
        }

        try {
            Object user = loadUser(api, player.getUniqueId());
            if (user == null) {
                return ActionResult.error(404, "LuckPerms user not found.");
            }

            String normalized = normalizeOperation(operation);
            if ("snapshot".equals(normalized)) {
                return ActionResult.success("LuckPerms snapshot loaded.", buildSnapshotData(api, user, player));
            }
            if ("group_add".equals(normalized)) {
                return addGroup(api, user, player, readString(request, "group"), null, false);
            }
            if ("group_switch".equals(normalized)) {
                return switchGroup(api, user, player, readString(request, "group"));
            }
            if ("group_remove".equals(normalized) || "removegroup".equals(normalized) || "ungroup".equals(normalized)) {
                return removeGroup(api, user, player, readString(request, "group"));
            }
            if ("temp_group_add".equals(normalized)) {
                return addGroup(api, user, player, readString(request, "group"), readString(request, "duration"), true);
            }
            if ("temp_group_remove".equals(normalized)) {
                return removeGroup(api, user, player, readString(request, "group"));
            }
            if ("permission_set".equals(normalized)) {
                return addPermission(api, user, player, readString(request, "node"), null, false);
            }
            if ("permission_unset".equals(normalized) || "permission_remove".equals(normalized)) {
                return removePermission(api, user, player, readString(request, "node"));
            }
            if ("temp_permission_set".equals(normalized)) {
                return addPermission(api, user, player, readString(request, "node"), readString(request, "duration"), true);
            }
            if ("temp_permission_unset".equals(normalized)) {
                return removePermission(api, user, player, readString(request, "node"));
            }
            return ActionResult.error(400, "Unsupported LuckPerms operation: " + operation);
        } catch (Exception exception) {
            return ActionResult.error(500, "LuckPerms action failed: " + exception.getMessage());
        }
    }

    private ActionResult addGroup(Object api, Object user, OfflinePlayer player, String group, String duration, boolean temporary) throws Exception {
        String normalizedGroup = group == null ? "" : group.trim();
        if (normalizedGroup.isEmpty()) {
            return ActionResult.error(400, "group is required.");
        }
        Object node = buildInheritanceNode(normalizedGroup, duration);
        invokeDataMutation(user, "add", node);
        saveUser(api, user);
        return ActionResult.success(
                temporary ? "LuckPerms temporary group added." : "LuckPerms group added.",
                buildSnapshotData(api, user, player)
        );
    }

    private ActionResult switchGroup(Object api, Object user, OfflinePlayer player, String group) throws Exception {
        String normalizedGroup = group == null ? "" : group.trim();
        if (normalizedGroup.isEmpty()) {
            return ActionResult.error(400, "group is required.");
        }

        String primaryGroup = readString(user, "getPrimaryGroup");
        if (!primaryGroup.isEmpty() && normalizedGroup.equalsIgnoreCase(primaryGroup)) {
            return ActionResult.success("LuckPerms primary group unchanged.", buildSnapshotData(api, user, player));
        }

        if (!hasPersistentGroup(user, normalizedGroup)) {
            Object targetGroupNode = buildInheritanceNode(normalizedGroup, null);
            invokeDataMutation(user, "add", targetGroupNode);
        }

        if (!primaryGroup.isEmpty()) {
            removeMatchingNodes(user, new NodeMatcher() {
                @Override
                public boolean matches(String key, Object node) {
                    if (hasExpiry(node)) {
                        return false;
                    }
                    return key.equalsIgnoreCase("group." + primaryGroup) || key.equalsIgnoreCase(primaryGroup);
                }
            });
        }

        saveUser(api, user);
        return ActionResult.success("LuckPerms primary group switched.", buildSnapshotData(api, user, player));
    }

    private ActionResult removeGroup(Object api, Object user, OfflinePlayer player, String group) throws Exception {
        String normalizedGroup = group == null ? "" : group.trim();
        if (normalizedGroup.isEmpty()) {
            return ActionResult.error(400, "group is required.");
        }
        int removed = removeMatchingNodes(user, new NodeMatcher() {
            @Override
            public boolean matches(String key, Object node) {
                return key.equalsIgnoreCase("group." + normalizedGroup) || key.equalsIgnoreCase(normalizedGroup);
            }
        });
        if (removed <= 0) {
            return ActionResult.error(404, "LuckPerms group grant not found.");
        }
        saveUser(api, user);
        return ActionResult.success("LuckPerms group removed.", buildSnapshotData(api, user, player));
    }

    private ActionResult addPermission(Object api, Object user, OfflinePlayer player, String node, String duration, boolean temporary) throws Exception {
        String normalizedNode = node == null ? "" : node.trim();
        if (normalizedNode.isEmpty()) {
            return ActionResult.error(400, "node is required.");
        }
        Object permissionNode = buildPermissionNode(normalizedNode, duration);
        invokeDataMutation(user, "add", permissionNode);
        saveUser(api, user);
        return ActionResult.success(
                temporary ? "LuckPerms temporary permission added." : "LuckPerms permission added.",
                buildSnapshotData(api, user, player)
        );
    }

    private ActionResult removePermission(Object api, Object user, OfflinePlayer player, String node) throws Exception {
        String normalizedNode = node == null ? "" : node.trim();
        if (normalizedNode.isEmpty()) {
            return ActionResult.error(400, "node is required.");
        }
        int removed = removeMatchingNodes(user, new NodeMatcher() {
            @Override
            public boolean matches(String key, Object currentNode) {
                return key.equalsIgnoreCase(normalizedNode);
            }
        });
        if (removed <= 0) {
            return ActionResult.error(404, "LuckPerms permission grant not found.");
        }
        saveUser(api, user);
        return ActionResult.success("LuckPerms permission removed.", buildSnapshotData(api, user, player));
    }

    private Map<String, Object> buildSnapshotData(Object api, Object user, OfflinePlayer player) throws Exception {
        LinkedHashMap<String, Object> data = new LinkedHashMap<String, Object>();
        String primaryGroup = readString(user, "getPrimaryGroup");
        data.put("playerUuid", player.getUniqueId().toString());
        data.put("playerName", player.getName());
        data.put("primaryGroup", primaryGroup);

        List<Map<String, Object>> groups = new ArrayList<Map<String, Object>>();
        List<Map<String, Object>> permissions = new ArrayList<Map<String, Object>>();
        for (Object node : getNodes(user)) {
            String key = readNodeKey(node);
            if (key.isEmpty()) {
                continue;
            }
            boolean temporary = hasExpiry(node);
            String expiresAt = readExpiry(node);
            if (isGroupNode(node, key)) {
                String name = key.startsWith("group.") ? key.substring("group.".length()) : key;
                LinkedHashMap<String, Object> item = new LinkedHashMap<String, Object>();
                item.put("name", name);
                item.put("temporary", Boolean.valueOf(temporary));
                if (!expiresAt.isEmpty()) {
                    item.put("expiresAt", expiresAt);
                }
                groups.add(item);
            } else {
                LinkedHashMap<String, Object> item = new LinkedHashMap<String, Object>();
                item.put("node", key);
                item.put("value", Boolean.valueOf(readNodeValue(node)));
                item.put("temporary", Boolean.valueOf(temporary));
                if (!expiresAt.isEmpty()) {
                    item.put("expiresAt", expiresAt);
                }
                permissions.add(item);
            }
        }

        Collections.sort(groups, new Comparator<Map<String, Object>>() {
            @Override
            public int compare(Map<String, Object> left, Map<String, Object> right) {
                return String.valueOf(left.get("name")).compareToIgnoreCase(String.valueOf(right.get("name")));
            }
        });
        Collections.sort(permissions, new Comparator<Map<String, Object>>() {
            @Override
            public int compare(Map<String, Object> left, Map<String, Object> right) {
                return String.valueOf(left.get("node")).compareToIgnoreCase(String.valueOf(right.get("node")));
            }
        });

        data.put("availableGroups", readAvailableGroups(api, primaryGroup, groups));
        data.put("groups", groups);
        data.put("permissions", permissions);
        return data;
    }

    private List<String> readAvailableGroups(Object api, String primaryGroup, List<Map<String, Object>> groups) {
        LinkedHashSet<String> names = new LinkedHashSet<String>();
        collectGroupNames(names, invokeQuietly(api, "getGroupManager"));

        if (primaryGroup != null && !primaryGroup.trim().isEmpty()) {
            names.add(primaryGroup.trim());
        }
        for (Map<String, Object> group : groups) {
            Object value = group.get("name");
            if (value != null && !String.valueOf(value).trim().isEmpty()) {
                names.add(String.valueOf(value).trim());
            }
        }

        List<String> values = new ArrayList<String>(names);
        Collections.sort(values, String.CASE_INSENSITIVE_ORDER);
        return values;
    }

    private void collectGroupNames(LinkedHashSet<String> target, Object groupManager) {
        if (groupManager == null) {
            return;
        }

        collectGroupNamesFromSource(target, invokeQuietly(groupManager, "getLoadedGroups"));
        collectGroupNamesFromSource(target, invokeQuietly(groupManager, "getGroups"));
        collectGroupNamesFromSource(target, invokeQuietly(groupManager, "getAllGroups"));
    }

    private void collectGroupNamesFromSource(LinkedHashSet<String> target, Object source) {
        if (source == null) {
            return;
        }
        if (source instanceof Map) {
            collectGroupNamesFromSource(target, ((Map<?, ?>) source).values());
            return;
        }
        if (source instanceof Collection) {
            for (Object item : (Collection<?>) source) {
                String name = readString(item, "getName");
                if (!name.isEmpty()) {
                    target.add(name);
                }
            }
        }
    }

    private boolean hasPersistentGroup(Object user, String group) throws Exception {
        for (Object node : getNodes(user)) {
            String key = readNodeKey(node);
            if (key.isEmpty() || hasExpiry(node)) {
                continue;
            }
            if (key.equalsIgnoreCase("group." + group) || key.equalsIgnoreCase(group)) {
                return true;
            }
        }
        return false;
    }

    private Object resolveApi() {
        Plugin plugin = Bukkit.getPluginManager().getPlugin("LuckPerms");
        if (plugin == null || !plugin.isEnabled()) {
            return null;
        }
        try {
            Class<?> providerClass = Class.forName("net.luckperms.api.LuckPermsProvider", true, plugin.getClass().getClassLoader());
            Method method = providerClass.getMethod("get");
            return method.invoke(null);
        } catch (Exception ignored) {
            return null;
        }
    }

    private Object loadUser(Object api, UUID playerUuid) throws Exception {
        Object userManager = api.getClass().getMethod("getUserManager").invoke(api);
        Method getUserMethod = findMethod(userManager.getClass(), "getUser", UUID.class);
        if (getUserMethod != null) {
            Object cached = getUserMethod.invoke(userManager, playerUuid);
            if (cached != null) {
                return cached;
            }
        }

        Method loadUserMethod = findMethod(userManager.getClass(), "loadUser", UUID.class);
        if (loadUserMethod == null) {
            return null;
        }
        Object future = loadUserMethod.invoke(userManager, playerUuid);
        if (future instanceof CompletableFuture) {
            return ((CompletableFuture<?>) future).get(5L, TimeUnit.SECONDS);
        }
        return future;
    }

    private void saveUser(Object api, Object user) throws Exception {
        Object userManager = api.getClass().getMethod("getUserManager").invoke(api);
        Method saveUserMethod = findMethod(userManager.getClass(), "saveUser", user.getClass().getInterfaces().length > 0 ? user.getClass().getInterfaces()[0] : user.getClass());
        if (saveUserMethod == null) {
            for (Method method : userManager.getClass().getMethods()) {
                if (method.getName().equals("saveUser") && method.getParameterTypes().length == 1) {
                    saveUserMethod = method;
                    break;
                }
            }
        }
        if (saveUserMethod != null) {
            Object future = saveUserMethod.invoke(userManager, user);
            if (future instanceof CompletableFuture) {
                ((CompletableFuture<?>) future).get(5L, TimeUnit.SECONDS);
            }
        }
    }

    private Object buildInheritanceNode(String group, String durationText) throws Exception {
        Class<?> nodeClass = Class.forName("net.luckperms.api.node.types.InheritanceNode");
        Object builder = nodeClass.getMethod("builder", String.class).invoke(null, group);
        applyDuration(builder, durationText);
        return invokeBuild(builder);
    }

    private Object buildPermissionNode(String node, String durationText) throws Exception {
        Class<?> nodeClass = Class.forName("net.luckperms.api.node.types.PermissionNode");
        Object builder = nodeClass.getMethod("builder", String.class).invoke(null, node);
        invokeOptional(builder, "value", Boolean.TYPE, Boolean.TRUE);
        invokeOptional(builder, "value", Boolean.class, Boolean.TRUE);
        applyDuration(builder, durationText);
        return invokeBuild(builder);
    }

    private void applyDuration(Object builder, String durationText) throws Exception {
        Duration duration = parseDuration(durationText);
        if (duration == null || duration.isZero() || duration.isNegative()) {
            return;
        }
        Method expiryDurationMethod = findMethod(builder.getClass(), "expiry", Duration.class);
        if (expiryDurationMethod != null) {
            expiryDurationMethod.invoke(builder, duration);
            return;
        }
        Method expirySecondsMethod = findMethod(builder.getClass(), "expiry", Long.TYPE, TimeUnit.class);
        if (expirySecondsMethod != null) {
            expirySecondsMethod.invoke(builder, Long.valueOf(duration.getSeconds()), TimeUnit.SECONDS);
        }
    }

    private Object invokeBuild(Object builder) throws Exception {
        Method buildMethod = findMethod(builder.getClass(), "build");
        if (buildMethod == null) {
            throw new NoSuchMethodException("LuckPerms node builder build() not found.");
        }
        return buildMethod.invoke(builder);
    }

    private void invokeDataMutation(Object user, String methodName, Object node) throws Exception {
        Object data = user.getClass().getMethod("data").invoke(user);
        Method method = findMethod(data.getClass(), methodName, node.getClass());
        if (method == null) {
            for (Method candidate : data.getClass().getMethods()) {
                if (candidate.getName().equals(methodName) && candidate.getParameterTypes().length == 1) {
                    method = candidate;
                    break;
                }
            }
        }
        if (method == null) {
            throw new NoSuchMethodException("LuckPerms data." + methodName + "() not found.");
        }
        method.invoke(data, node);
    }

    private int removeMatchingNodes(Object user, NodeMatcher matcher) throws Exception {
        int removed = 0;
        for (Object node : new ArrayList<Object>(getNodes(user))) {
            String key = readNodeKey(node);
            if (key.isEmpty()) {
                continue;
            }
            if (matcher.matches(key, node)) {
                invokeDataMutation(user, "remove", node);
                removed++;
            }
        }
        return removed;
    }

    private Collection<?> getNodes(Object user) throws Exception {
        Object nodes = invokeFirst(user, new String[]{"getNodes", "getDistinctNodes", "getOwnNodes"});
        if (nodes instanceof Collection) {
            return (Collection<?>) nodes;
        }
        return Collections.emptyList();
    }

    private boolean isGroupNode(Object node, String key) {
        if (key.startsWith("group.")) {
            return true;
        }
        try {
            Class<?> inheritanceNode = Class.forName("net.luckperms.api.node.types.InheritanceNode");
            return inheritanceNode.isInstance(node);
        } catch (Exception ignored) {
            return false;
        }
    }

    private String readNodeKey(Object node) {
        Object value = invokeQuietly(node, "getKey");
        if (value == null) {
            value = invokeQuietly(node, "getPermission");
        }
        return value == null ? "" : String.valueOf(value).trim();
    }

    private boolean readNodeValue(Object node) {
        Object value = invokeQuietly(node, "getValue");
        return !(value instanceof Boolean) || ((Boolean) value).booleanValue();
    }

    private boolean hasExpiry(Object node) {
        Object direct = invokeQuietly(node, "hasExpiry");
        if (direct instanceof Boolean) {
            return ((Boolean) direct).booleanValue();
        }
        return !readExpiry(node).isEmpty();
    }

    private String readExpiry(Object node) {
        Object expiry = invokeQuietly(node, "getExpiry");
        if (expiry == null) {
            expiry = invokeQuietly(node, "getExpiryTime");
        }
        if (expiry instanceof Optional) {
            Optional<?> optional = (Optional<?>) expiry;
            expiry = optional.isPresent() ? optional.get() : null;
        }
        if (expiry instanceof Instant) {
            return ((Instant) expiry).toString();
        }
        if (expiry instanceof Number) {
            long numeric = ((Number) expiry).longValue();
            if (numeric <= 0L) {
                return "";
            }
            if (numeric < 100000000000L) {
                numeric = numeric * 1000L;
            }
            return Instant.ofEpochMilli(numeric).toString();
        }
        return expiry == null ? "" : String.valueOf(expiry);
    }

    private Object invokeFirst(Object target, String[] methodNames, Object... arguments) throws Exception {
        Class<?>[] argumentTypes = buildArgumentTypes(arguments);
        for (String methodName : methodNames) {
            Method method = findCompatibleMethod(target.getClass(), methodName, argumentTypes);
            if (method != null) {
                return method.invoke(target, arguments);
            }
        }
        throw new NoSuchMethodException("LuckPerms method not found.");
    }

    private Object invokeQuietly(Object target, String methodName, Object... arguments) {
        try {
            Method method = findCompatibleMethod(target.getClass(), methodName, buildArgumentTypes(arguments));
            if (method == null) {
                return null;
            }
            return method.invoke(target, arguments);
        } catch (Exception ignored) {
            return null;
        }
    }

    private void invokeOptional(Object target, String methodName, Class<?> argumentType, Object argument) {
        try {
            Method method = findMethod(target.getClass(), methodName, argumentType);
            if (method != null) {
                method.invoke(target, argument);
            }
        } catch (Exception ignored) {
        }
    }

    private String readString(Object target, String methodName) {
        Object value = invokeQuietly(target, methodName);
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String readString(Map<String, Object> source, String key) {
        Object value = source == null ? null : source.get(key);
        return value == null ? "" : String.valueOf(value).trim();
    }

    private Method findMethod(Class<?> type, String name, Class<?>... parameterTypes) {
        try {
            return type.getMethod(name, parameterTypes);
        } catch (NoSuchMethodException ignored) {
            return null;
        }
    }

    private Method findCompatibleMethod(Class<?> type, String name, Class<?>... parameterTypes) {
        Method direct = findMethod(type, name, parameterTypes);
        if (direct != null) {
            return direct;
        }
        for (Method method : type.getMethods()) {
            if (!method.getName().equals(name) || method.getParameterTypes().length != parameterTypes.length) {
                continue;
            }
            boolean matched = true;
            Class<?>[] candidateTypes = method.getParameterTypes();
            for (int index = 0; index < candidateTypes.length; index++) {
                if (!wrap(candidateTypes[index]).isAssignableFrom(wrap(parameterTypes[index]))) {
                    matched = false;
                    break;
                }
            }
            if (matched) {
                return method;
            }
        }
        return null;
    }

    private Class<?>[] buildArgumentTypes(Object[] arguments) {
        Class<?>[] types = new Class<?>[arguments.length];
        for (int index = 0; index < arguments.length; index++) {
            Object argument = arguments[index];
            types[index] = argument == null ? Object.class : wrap(argument.getClass());
        }
        return types;
    }

    private Class<?> wrap(Class<?> type) {
        if (type == Boolean.TYPE) {
            return Boolean.class;
        }
        if (type == Integer.TYPE) {
            return Integer.class;
        }
        if (type == Long.TYPE) {
            return Long.class;
        }
        if (type == Double.TYPE) {
            return Double.class;
        }
        if (type == Float.TYPE) {
            return Float.class;
        }
        return type;
    }

    private Duration parseDuration(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ENGLISH);
        if (normalized.isEmpty()) {
            return null;
        }
        long multiplier = 1L;
        if (normalized.endsWith("ms")) {
            multiplier = 0L;
        } else if (normalized.endsWith("s")) {
            multiplier = 1L;
            normalized = normalized.substring(0, normalized.length() - 1);
        } else if (normalized.endsWith("m")) {
            multiplier = 60L;
            normalized = normalized.substring(0, normalized.length() - 1);
        } else if (normalized.endsWith("h")) {
            multiplier = 60L * 60L;
            normalized = normalized.substring(0, normalized.length() - 1);
        } else if (normalized.endsWith("d")) {
            multiplier = 24L * 60L * 60L;
            normalized = normalized.substring(0, normalized.length() - 1);
        } else if (normalized.endsWith("w")) {
            multiplier = 7L * 24L * 60L * 60L;
            normalized = normalized.substring(0, normalized.length() - 1);
        }

        try {
            long numeric = Long.parseLong(normalized);
            if (multiplier == 0L) {
                return Duration.ofMillis(numeric);
            }
            return Duration.ofSeconds(numeric * multiplier);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String normalizeOperation(String operation) {
        String normalized = operation == null ? "" : operation.trim().toLowerCase(Locale.ENGLISH);
        return normalized.isEmpty() ? "snapshot" : normalized;
    }

    private interface NodeMatcher {
        boolean matches(String key, Object node);
    }
}
