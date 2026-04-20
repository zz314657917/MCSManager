package com.mcsmanager.monitor;

import org.bukkit.configuration.file.FileConfiguration;

final class LocalControlSettings {
    private final boolean enabled;
    private final String host;
    private final int port;
    private final String token;
    private final String tokenSource;
    private final int workerThreads;
    private final long requestTimeoutMs;

    private LocalControlSettings(boolean enabled, String host, int port, String token, String tokenSource,
                                 int workerThreads, long requestTimeoutMs) {
        this.enabled = enabled;
        this.host = host;
        this.port = port;
        this.token = token;
        this.tokenSource = tokenSource;
        this.workerThreads = workerThreads;
        this.requestTimeoutMs = requestTimeoutMs;
    }

    static LocalControlSettings fromConfig(FileConfiguration configuration) {
        boolean enabled = configuration.getBoolean("localControl.enabled", true);
        String host = trim(configuration.getString("localControl.host", "127.0.0.1"));
        if (host.isEmpty()) {
            host = "127.0.0.1";
        }
        int port = Math.max(1, Math.min(65535, configuration.getInt("localControl.port", 25681)));
        String configuredToken = trim(configuration.getString("localControl.token", ""));
        String instanceToken = trim(configuration.getString("instanceToken", ""));
        String token;
        String tokenSource;
        if (!configuredToken.isEmpty()) {
            token = configuredToken;
            tokenSource = "localControl.token";
        } else if (!instanceToken.isEmpty()) {
            token = instanceToken;
            tokenSource = "instanceToken";
        } else {
            token = "";
            tokenSource = "unset";
        }
        int workerThreads = Math.max(1, configuration.getInt("localControl.workerThreads", 2));
        long requestTimeoutMs = Math.max(1000L, configuration.getLong("localControl.requestTimeoutMs", 5000L));
        return new LocalControlSettings(enabled, host, port, token, tokenSource, workerThreads, requestTimeoutMs);
    }

    boolean isEnabled() {
        return enabled;
    }

    String getHost() {
        return host;
    }

    int getPort() {
        return port;
    }

    String getToken() {
        return token;
    }

    boolean hasToken() {
        return !token.isEmpty();
    }

    String getTokenSource() {
        return tokenSource;
    }

    int getWorkerThreads() {
        return workerThreads;
    }

    long getRequestTimeoutMs() {
        return requestTimeoutMs;
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
