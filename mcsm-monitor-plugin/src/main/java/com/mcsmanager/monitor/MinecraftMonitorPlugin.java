package com.mcsmanager.monitor;

import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

public final class MinecraftMonitorPlugin extends JavaPlugin {
    private volatile long lastMainThreadTickAt = System.currentTimeMillis();
    private final TpsMonitor tpsMonitor = new TpsMonitor();
    private BukkitTask mainThreadProbeTask;
    private AgentHttpClient agentHttpClient;
    private HeartbeatReporter heartbeatReporter;
    private PlayerSnapshotReporter playerSnapshotReporter;
    private ChatReporter chatReporter;
    private LocalControlServer localControlServer;
    private MuteService muteService;
    private VaultEconomyAdapter vaultEconomyAdapter;
    private PlayerPointsAdapter playerPointsAdapter;
    private LuckPermsAdapter luckPermsAdapter;
    private InventorySnapshotAdapter inventorySnapshotAdapter;
    private ControlActionDispatcher controlActionDispatcher;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        muteService = new MuteService(this);
        muteService.load();
        tpsMonitor.reset();
        restartServices();
        getLogger().info("MCSM monitor plugin enabled.");
    }

    @Override
    public void onDisable() {
        stopServices();
        if (muteService != null) {
            muteService.save();
        }
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!command.getName().equalsIgnoreCase("mcsmmonitor")) {
            return false;
        }

        if (args.length == 1 && args[0].equalsIgnoreCase("reload")) {
            if (!sender.hasPermission("mcsmmonitor.reload")) {
                sender.sendMessage("You do not have permission to reload MCSMMonitor.");
                return true;
            }
            reloadConfig();
            if (muteService != null) {
                muteService.load();
            }
            restartServices();
            sender.sendMessage("MCSMMonitor config reloaded.");
            return true;
        }

        sender.sendMessage("Usage: /" + label + " reload");
        return true;
    }

    public boolean isMainThreadBlocked() {
        long threshold = Math.max(500L, getConfig().getLong("mainThreadBlockedThresholdMs", 3000L));
        return System.currentTimeMillis() - lastMainThreadTickAt > threshold;
    }

    public double[] getCalculatedTps() {
        return tpsMonitor.getSnapshot();
    }

    AgentHttpClient getAgentHttpClient() {
        return agentHttpClient;
    }

    MuteService getMuteService() {
        return muteService;
    }

    VaultEconomyAdapter getVaultEconomyAdapter() {
        return vaultEconomyAdapter;
    }

    PlayerPointsAdapter getPlayerPointsAdapter() {
        return playerPointsAdapter;
    }

    LuckPermsAdapter getLuckPermsAdapter() {
        return luckPermsAdapter;
    }

    InventorySnapshotAdapter getInventorySnapshotAdapter() {
        return inventorySnapshotAdapter;
    }

    LocalControlSettings getLocalControlSettings() {
        return LocalControlSettings.fromConfig(getConfig());
    }

    boolean isUploadFailureLogEnabled() {
        return getConfig().getBoolean("logUploadFailures", getConfig().getBoolean("logHeartbeatFailures", true));
    }

    String getEndpointPath(String configPath, String defaultValue) {
        String value = getConfig().getString(configPath, defaultValue);
        if (value == null || value.trim().isEmpty()) {
            return defaultValue;
        }
        return value.trim();
    }

    LinkedHashMap<String, Object> createBasePayload() {
        LinkedHashMap<String, Object> payload = new LinkedHashMap<String, Object>();
        payload.put("serverId", safeTrim(getConfig().getString("serverId", "")));
        payload.put("instanceToken", safeTrim(getConfig().getString("instanceToken", "")));
        payload.put("timestamp", Long.valueOf(System.currentTimeMillis()));
        return payload;
    }

    LinkedHashMap<String, Object> createSupportFlags() {
        LinkedHashMap<String, Object> supports = new LinkedHashMap<String, Object>();
        supports.put("economy", Boolean.valueOf(vaultEconomyAdapter != null && vaultEconomyAdapter.isAvailable()));
        supports.put("points", Boolean.valueOf(playerPointsAdapter != null && playerPointsAdapter.isAvailable()));
        supports.put("luckPerms", Boolean.valueOf(luckPermsAdapter != null && luckPermsAdapter.isAvailable()));
        supports.put("mute", Boolean.TRUE);
        supports.put("chatReporting", Boolean.valueOf(getConfig().getBoolean("chatReporting.enabled", true)));
        supports.put("playerChatReflection", Boolean.valueOf(chatReporter != null && chatReporter.isPlayerChatBridgeActive()));
        return supports;
    }

    LinkedHashMap<String, Object> createLocalControlMetadata() {
        LocalControlSettings settings = getLocalControlSettings();
        LinkedHashMap<String, Object> metadata = new LinkedHashMap<String, Object>();
        metadata.put("enabled", Boolean.valueOf(settings.isEnabled()));
        metadata.put("running", Boolean.valueOf(localControlServer != null && localControlServer.isRunning()));
        metadata.put("host", settings.getHost());
        metadata.put("port", Integer.valueOf(settings.getPort()));
        metadata.put("tokenConfigured", Boolean.valueOf(settings.hasToken()));
        metadata.put("tokenSource", settings.getTokenSource());
        metadata.put("requestTimeoutMs", Long.valueOf(settings.getRequestTimeoutMs()));

        LinkedHashMap<String, Object> paths = new LinkedHashMap<String, Object>();
        paths.put("health", "/health");
        paths.put("actions", "/actions");
        metadata.put("paths", paths);

        LinkedHashMap<String, Object> actions = new LinkedHashMap<String, Object>();
        actions.put("economy", Boolean.valueOf(vaultEconomyAdapter != null && vaultEconomyAdapter.isAvailable()));
        actions.put("points", Boolean.valueOf(playerPointsAdapter != null && playerPointsAdapter.isAvailable()));
        actions.put("luckPerms", Boolean.valueOf(luckPermsAdapter != null && luckPermsAdapter.isAvailable()));
        actions.put("mute", Boolean.TRUE);
        actions.put("inventory", Boolean.TRUE);
        metadata.put("actions", actions);
        return metadata;
    }

    private void restartServices() {
        stopServices();
        agentHttpClient = new AgentHttpClient(this);
        vaultEconomyAdapter = new VaultEconomyAdapter();
        playerPointsAdapter = new PlayerPointsAdapter();
        luckPermsAdapter = new LuckPermsAdapter();
        inventorySnapshotAdapter = new InventorySnapshotAdapter();
        controlActionDispatcher = new ControlActionDispatcher(this);
        startMainThreadProbe();
        startHeartbeatReporter();
        startPlayerSnapshotReporter();
        startChatReporter();
        startLocalControlServer();
    }

    private void stopServices() {
        if (mainThreadProbeTask != null) {
            mainThreadProbeTask.cancel();
            mainThreadProbeTask = null;
        }
        if (heartbeatReporter != null) {
            heartbeatReporter.stop();
            heartbeatReporter = null;
        }
        if (playerSnapshotReporter != null) {
            playerSnapshotReporter.stop();
            playerSnapshotReporter = null;
        }
        if (chatReporter != null) {
            chatReporter.stop();
            chatReporter = null;
        }
        if (localControlServer != null) {
            localControlServer.stop();
            localControlServer = null;
        }
    }

    private void startMainThreadProbe() {
        if (mainThreadProbeTask != null) {
            mainThreadProbeTask.cancel();
        }
        mainThreadProbeTask = Bukkit.getScheduler().runTaskTimer(this, new Runnable() {
            @Override
            public void run() {
                lastMainThreadTickAt = System.currentTimeMillis();
                tpsMonitor.recordTick();
            }
        }, 1L, 1L);
    }

    private void startHeartbeatReporter() {
        heartbeatReporter = new HeartbeatReporter(this, agentHttpClient);
        heartbeatReporter.start();
    }

    private void startPlayerSnapshotReporter() {
        if (getConfig().getLong("playerSnapshotIntervalTicks", 100L) <= 0L) {
            return;
        }
        playerSnapshotReporter = new PlayerSnapshotReporter(this, agentHttpClient);
        playerSnapshotReporter.start();
    }

    private void startChatReporter() {
        if (!getConfig().getBoolean("chatReporting.enabled", true)) {
            return;
        }
        chatReporter = new ChatReporter(this, agentHttpClient);
        chatReporter.start();
    }

    private void startLocalControlServer() {
        localControlServer = new LocalControlServer(this, controlActionDispatcher, getLocalControlSettings());
        localControlServer.start();
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }
}
