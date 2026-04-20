package com.mcsmanager.monitor;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.Event;
import org.bukkit.event.EventException;
import org.bukkit.event.EventPriority;
import org.bukkit.event.HandlerList;
import org.bukkit.event.Listener;
import org.bukkit.plugin.EventExecutor;
import org.bukkit.plugin.Plugin;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

final class PlayerChatBridge {
    interface ChatCallback {
        void onMessage(Player player,
                       String message,
                       String source,
                       String channel,
                       String tellPlayerName,
                       List<String> mentionedPlayers,
                       boolean cancelled,
                       Runnable cancelAction);
    }

    private static final String CHAT_EVENT_CLASS = "cn.handyplus.chat.event.PlayerChannelChatEvent";
    private static final String TELL_EVENT_CLASS = "cn.handyplus.chat.event.PlayerChannelTellEvent";

    private final MinecraftMonitorPlugin plugin;
    private final ChatCallback callback;
    private final List<Listener> listeners = new ArrayList<Listener>();
    private boolean active;

    PlayerChatBridge(MinecraftMonitorPlugin plugin, ChatCallback callback) {
        this.plugin = plugin;
        this.callback = callback;
    }

    boolean start() {
        if (!plugin.getConfig().getBoolean("chatReporting.playerChatReflectionEnabled", true)) {
            return false;
        }

        Plugin targetPlugin = Bukkit.getPluginManager().getPlugin("PlayerChat");
        if (targetPlugin == null || !targetPlugin.isEnabled()) {
            return false;
        }

        boolean registered = false;
        registered |= registerReflectedEvent(targetPlugin, CHAT_EVENT_CLASS);
        registered |= registerReflectedEvent(targetPlugin, TELL_EVENT_CLASS);
        active = registered;

        if (registered) {
            plugin.getLogger().info("PlayerChat bridge enabled.");
        } else {
            plugin.getLogger().info("PlayerChat detected, but no compatible reflected event was found.");
        }
        return registered;
    }

    void stop() {
        for (Listener listener : listeners) {
            HandlerList.unregisterAll(listener);
        }
        listeners.clear();
        active = false;
    }

    boolean isActive() {
        return active;
    }

    private boolean registerReflectedEvent(Plugin targetPlugin, String className) {
        try {
            Class<?> rawClass = Class.forName(className, false, targetPlugin.getClass().getClassLoader());
            if (!Event.class.isAssignableFrom(rawClass)) {
                return false;
            }

            @SuppressWarnings("unchecked")
            Class<? extends Event> eventClass = (Class<? extends Event>) rawClass;
            Listener listener = new Listener() {
            };

            Bukkit.getPluginManager().registerEvent(eventClass, listener, EventPriority.MONITOR, new EventExecutor() {
                @Override
                public void execute(Listener ignored, Event event) throws EventException {
                    handleEvent(event);
                }
            }, plugin, true);

            listeners.add(listener);
            return true;
        } catch (ClassNotFoundException ignored) {
            return false;
        } catch (Exception exception) {
            plugin.getLogger().warning("PlayerChat bridge setup failed: " + exception.getMessage());
            return false;
        }
    }

    private void handleEvent(Event event) {
        Player player = extractPlayer(event);
        if (player == null) {
            return;
        }

        Map<String, Object> chatParam = parseChatParam(event);
        String message = firstNonBlank(
                extractString(event, new String[]{"getOriginalMessage", "getMessage", "getPlainMessage"}),
                readString(chatParam, "message")
        );
        if (message == null || message.trim().isEmpty()) {
            return;
        }

        final Method cancellableMethod = findMethod(event.getClass(), "setCancelled", Boolean.TYPE);
        callback.onMessage(
                player,
                message,
                firstNonBlank(extractString(event, new String[]{"getSource"}), readString(chatParam, "source"), "PlayerChat"),
                firstNonBlank(extractString(event, new String[]{"getChannel"}), readString(chatParam, "channel")),
                firstNonBlank(extractString(event, new String[]{"getTellPlayerName"}), readString(chatParam, "tellPlayerName")),
                readStringList(chatParam.get("mentionedPlayers")),
                extractCancelled(event),
                cancellableMethod == null ? null : new Runnable() {
                    @Override
                    public void run() {
                        try {
                            cancellableMethod.invoke(event, Boolean.TRUE);
                        } catch (Exception ignored) {
                        }
                    }
                }
        );
    }

    private Player extractPlayer(Event event) {
        Object value = invokeFirst(event, new String[]{"getPlayer", "getSender", "getBukkitPlayer"});
        if (value instanceof Player) {
            return (Player) value;
        }
        return null;
    }

    private Map<String, Object> parseChatParam(Event event) {
        Object bcMessageParam = invokeFirst(event, new String[]{"getBcMessageParam"});
        if (bcMessageParam == null) {
            return Collections.emptyMap();
        }

        Object messageJson = invokeFirst(bcMessageParam, new String[]{"getMessage"});
        if (messageJson == null) {
            return Collections.emptyMap();
        }

        try {
            return JsonUtil.parseObject(String.valueOf(messageJson));
        } catch (Exception ignored) {
            return Collections.emptyMap();
        }
    }

    private String extractString(Event event, String[] candidates) {
        Object value = invokeFirst(event, candidates);
        return value == null ? null : String.valueOf(value);
    }

    private boolean extractCancelled(Event event) {
        Object value = invokeFirst(event, new String[]{"isCancelled"});
        return value instanceof Boolean && ((Boolean) value).booleanValue();
    }

    private Object invokeFirst(Object target, String[] candidates) {
        if (target == null) {
            return null;
        }
        for (String candidate : candidates) {
            Method method = findMethod(target.getClass(), candidate);
            if (method == null) {
                continue;
            }
            try {
                return method.invoke(target);
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private Method findMethod(Class<?> type, String name, Class<?>... parameterTypes) {
        try {
            return type.getMethod(name, parameterTypes);
        } catch (NoSuchMethodException ignored) {
            return null;
        }
    }

    private String readString(Map<String, Object> source, String key) {
        Object value = source == null ? null : source.get(key);
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private List<String> readStringList(Object value) {
        if (!(value instanceof List)) {
            return Collections.emptyList();
        }
        List<String> result = new ArrayList<String>();
        for (Object item : (List<?>) value) {
            if (item == null) {
                continue;
            }
            String text = String.valueOf(item).trim();
            if (!text.isEmpty()) {
                result.add(text);
            }
        }
        return result;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value == null) {
                continue;
            }
            String text = value.trim();
            if (!text.isEmpty()) {
                return text;
            }
        }
        return null;
    }
}
