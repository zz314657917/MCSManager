package com.mcsmanager.monitor;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

final class ActionResult {
    private final boolean ok;
    private final int statusCode;
    private final String message;
    private final Map<String, Object> data;

    private ActionResult(boolean ok, int statusCode, String message, Map<String, Object> data) {
        this.ok = ok;
        this.statusCode = statusCode;
        this.message = message;
        this.data = data == null ? Collections.<String, Object>emptyMap() : data;
    }

    static ActionResult success(String message) {
        return success(message, Collections.<String, Object>emptyMap());
    }

    static ActionResult success(String message, Map<String, Object> data) {
        return new ActionResult(true, 200, message, data);
    }

    static ActionResult error(int statusCode, String message) {
        return error(statusCode, message, Collections.<String, Object>emptyMap());
    }

    static ActionResult error(int statusCode, String message, Map<String, Object> data) {
        return new ActionResult(false, statusCode, message, data);
    }

    boolean isOk() {
        return ok;
    }

    int getStatusCode() {
        return statusCode;
    }

    Map<String, Object> toResponseBody() {
        LinkedHashMap<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("ok", Boolean.valueOf(ok));
        body.put("message", message);
        if (!data.isEmpty()) {
            body.put("data", data);
        }
        return body;
    }
}
