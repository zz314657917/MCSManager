package com.mcsmanager.monitor;

import org.bukkit.configuration.file.FileConfiguration;

import java.io.IOException;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;

final class AgentHttpClient {
    private final MinecraftMonitorPlugin plugin;
    private volatile boolean invalidConfigWarned = false;

    AgentHttpClient(MinecraftMonitorPlugin plugin) {
        this.plugin = plugin;
    }

    HttpResult postJson(String endpointPath, Map<String, Object> payload, boolean logFailures, String label) {
        FileConfiguration configuration = plugin.getConfig();
        String agentUrl = trimTrailingSlash(configuration.getString("agentUrl", ""));
        String serverId = safeTrim(configuration.getString("serverId", ""));
        String instanceToken = safeTrim(configuration.getString("instanceToken", ""));
        if (agentUrl.isEmpty() || serverId.isEmpty() || instanceToken.isEmpty()) {
            if (logFailures && !invalidConfigWarned) {
                invalidConfigWarned = true;
                plugin.getLogger().warning("Missing agentUrl/serverId/instanceToken, " + label + " reporter is idle.");
            }
            return HttpResult.skipped();
        }
        invalidConfigWarned = false;

        HttpURLConnection connection = null;
        try {
            URL url = new URL(agentUrl + normalizePath(endpointPath));
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setConnectTimeout(configuration.getInt("connectTimeoutMs", 3000));
            connection.setReadTimeout(configuration.getInt("readTimeoutMs", 3000));
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");

            byte[] body = JsonUtil.toJson(payload).getBytes(StandardCharsets.UTF_8);
            OutputStream outputStream = connection.getOutputStream();
            outputStream.write(body);
            outputStream.flush();
            outputStream.close();

            int statusCode = connection.getResponseCode();
            String responseBody = readResponse(connection);
            if (statusCode < 200 || statusCode >= 300) {
                if (logFailures) {
                    plugin.getLogger().warning(capitalize(label) + " failed, HTTP " + statusCode + ": " + responseBody);
                }
                return new HttpResult(false, statusCode, responseBody);
            }
            return new HttpResult(true, statusCode, responseBody);
        } catch (Exception exception) {
            if (logFailures) {
                plugin.getLogger().warning(capitalize(label) + " error: " + exception.getMessage());
            }
            return new HttpResult(false, 0, exception.getMessage());
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private String readResponse(HttpURLConnection connection) {
        try {
            if (connection.getErrorStream() != null) {
                return JsonUtil.readUtf8(connection.getErrorStream());
            }
            if (connection.getInputStream() != null) {
                return JsonUtil.readUtf8(connection.getInputStream());
            }
        } catch (IOException ignored) {
        }
        return "";
    }

    private String trimTrailingSlash(String value) {
        String normalized = safeTrim(value);
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }

    private String normalizePath(String value) {
        if (value == null || value.trim().isEmpty()) {
            return "/";
        }
        String normalized = value.trim();
        return normalized.startsWith("/") ? normalized : "/" + normalized;
    }

    private String capitalize(String value) {
        if (value == null || value.isEmpty()) {
            return "Request";
        }
        return Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }

    static final class HttpResult {
        private final boolean success;
        private final int statusCode;
        private final String body;

        private HttpResult(boolean success, int statusCode, String body) {
            this.success = success;
            this.statusCode = statusCode;
            this.body = body == null ? "" : body;
        }

        static HttpResult skipped() {
            return new HttpResult(false, 0, "");
        }

        boolean isSuccess() {
            return success;
        }

        int getStatusCode() {
            return statusCode;
        }

        String getBody() {
            return body;
        }
    }
}
