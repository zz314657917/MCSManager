package com.mcsmanager.monitor;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import org.bukkit.Bukkit;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class LocalControlServer {
    private final MinecraftMonitorPlugin plugin;
    private final ControlActionDispatcher dispatcher;
    private final LocalControlSettings settings;
    private HttpServer server;
    private ExecutorService executorService;

    LocalControlServer(MinecraftMonitorPlugin plugin, ControlActionDispatcher dispatcher, LocalControlSettings settings) {
        this.plugin = plugin;
        this.dispatcher = dispatcher;
        this.settings = settings;
    }

    void start() {
        if (!settings.isEnabled()) {
            return;
        }
        if (!settings.hasToken()) {
            plugin.getLogger().warning("Local control is enabled but no token is available. Set localControl.token or instanceToken.");
            return;
        }
        try {
            server = HttpServer.create(new InetSocketAddress(settings.getHost(), settings.getPort()), 0);
            executorService = Executors.newFixedThreadPool(settings.getWorkerThreads());
            server.setExecutor(executorService);
            server.createContext("/health", new HttpHandler() {
                @Override
                public void handle(HttpExchange exchange) throws IOException {
                    handleHealth(exchange);
                }
            });
            server.createContext("/actions", new HttpHandler() {
                @Override
                public void handle(HttpExchange exchange) throws IOException {
                    handleAction(exchange);
                }
            });
            server.start();
            plugin.getLogger().info("Local control server listening on " + settings.getHost() + ":" + settings.getPort() + ".");
        } catch (IOException exception) {
            plugin.getLogger().warning("Failed to start local control server: " + exception.getMessage());
            stop();
        }
    }

    void stop() {
        if (server != null) {
            server.stop(0);
            server = null;
        }
        if (executorService != null) {
            executorService.shutdownNow();
            executorService = null;
        }
    }

    boolean isRunning() {
        return server != null;
    }

    private void handleHealth(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            writeJson(exchange, 405, Collections.<String, Object>singletonMap("message", "Method not allowed."));
            return;
        }
        if (!isAuthorized(exchange)) {
            writeJson(exchange, 401, ActionResult.error(401, "Unauthorized.").toResponseBody());
            return;
        }
        writeJson(exchange, 200, dispatcher.buildHealthPayload());
    }

    private void handleAction(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            writeJson(exchange, 405, Collections.<String, Object>singletonMap("message", "Method not allowed."));
            return;
        }
        if (!isAuthorized(exchange)) {
            writeJson(exchange, 401, ActionResult.error(401, "Unauthorized.").toResponseBody());
            return;
        }
        String body = JsonUtil.readUtf8(exchange.getRequestBody());
        Map<String, Object> request;
        try {
            request = body.trim().isEmpty() ? new LinkedHashMap<String, Object>() : JsonUtil.parseObject(body);
        } catch (Exception exception) {
            writeJson(exchange, 400, ActionResult.error(400, "Invalid JSON: " + exception.getMessage()).toResponseBody());
            return;
        }
        ActionResult result = dispatcher.dispatch(request);
        writeJson(exchange, result.getStatusCode(), result.toResponseBody());
    }

    private boolean isAuthorized(HttpExchange exchange) {
        Headers headers = exchange.getRequestHeaders();
        String providedToken = firstHeader(headers, "X-MCSM-Token");
        if (providedToken.isEmpty()) {
            String authorization = firstHeader(headers, "Authorization");
            if (authorization.startsWith("Bearer ")) {
                providedToken = authorization.substring("Bearer ".length()).trim();
            }
        }
        if (providedToken.isEmpty()) {
            providedToken = readQueryToken(exchange.getRequestURI());
        }
        return settings.getToken().equals(providedToken);
    }

    private String readQueryToken(URI uri) {
        if (uri == null || uri.getRawQuery() == null) {
            return "";
        }
        String[] parts = uri.getRawQuery().split("&");
        for (String part : parts) {
            int separator = part.indexOf('=');
            if (separator <= 0) {
                continue;
            }
            String key = part.substring(0, separator);
            if ("token".equals(key)) {
                return decode(part.substring(separator + 1));
            }
        }
        return "";
    }

    private String decode(String value) {
        try {
            return java.net.URLDecoder.decode(value, "UTF-8");
        } catch (Exception ignored) {
            return value;
        }
    }

    private String firstHeader(Headers headers, String key) {
        String value = headers.getFirst(key);
        return value == null ? "" : value.trim();
    }

    private void writeJson(HttpExchange exchange, int statusCode, Map<String, Object> body) throws IOException {
        byte[] bytes = JsonUtil.toJson(body).getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        OutputStream outputStream = exchange.getResponseBody();
        outputStream.write(bytes);
        outputStream.flush();
        outputStream.close();
        exchange.close();
    }
}
