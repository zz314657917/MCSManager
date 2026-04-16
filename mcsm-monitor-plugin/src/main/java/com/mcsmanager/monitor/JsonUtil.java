package com.mcsmanager.monitor;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class JsonUtil {
    private JsonUtil() {
    }

    static String toJson(Object value) {
        StringBuilder builder = new StringBuilder();
        appendJson(builder, value);
        return builder.toString();
    }

    static Map<String, Object> parseObject(String json) {
        Object value = new Parser(json).parse();
        if (!(value instanceof Map)) {
            throw new IllegalArgumentException("JSON root must be an object.");
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) value;
        return result;
    }

    static String readUtf8(InputStream inputStream) throws IOException {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        byte[] buffer = new byte[1024];
        int length;
        while ((length = inputStream.read(buffer)) != -1) {
            outputStream.write(buffer, 0, length);
        }
        return new String(outputStream.toByteArray(), StandardCharsets.UTF_8);
    }

    private static void appendJson(StringBuilder builder, Object value) {
        if (value == null) {
            builder.append("null");
            return;
        }
        if (value instanceof String) {
            builder.append("\"").append(escape((String) value)).append("\"");
            return;
        }
        if (value instanceof Number) {
            builder.append(formatNumber((Number) value));
            return;
        }
        if (value instanceof Boolean) {
            builder.append(((Boolean) value).booleanValue() ? "true" : "false");
            return;
        }
        if (value instanceof Map) {
            appendMap(builder, (Map<?, ?>) value);
            return;
        }
        if (value instanceof Collection) {
            appendCollection(builder, (Collection<?>) value);
            return;
        }
        if (value.getClass().isArray()) {
            builder.append("[");
            int length = java.lang.reflect.Array.getLength(value);
            for (int index = 0; index < length; index++) {
                if (index > 0) {
                    builder.append(",");
                }
                appendJson(builder, java.lang.reflect.Array.get(value, index));
            }
            builder.append("]");
            return;
        }
        builder.append("\"").append(escape(String.valueOf(value))).append("\"");
    }

    private static void appendMap(StringBuilder builder, Map<?, ?> map) {
        builder.append("{");
        boolean first = true;
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            if (!(entry.getKey() instanceof String)) {
                continue;
            }
            if (!first) {
                builder.append(",");
            }
            first = false;
            builder.append("\"").append(escape((String) entry.getKey())).append("\":");
            appendJson(builder, entry.getValue());
        }
        builder.append("}");
    }

    private static void appendCollection(StringBuilder builder, Collection<?> collection) {
        builder.append("[");
        boolean first = true;
        for (Object value : collection) {
            if (!first) {
                builder.append(",");
            }
            first = false;
            appendJson(builder, value);
        }
        builder.append("]");
    }

    private static String formatNumber(Number number) {
        if (number instanceof Float || number instanceof Double) {
            double value = number.doubleValue();
            if (Double.isNaN(value) || Double.isInfinite(value)) {
                return "0";
            }
            return String.format(Locale.US, "%.4f", value).replaceAll("0+$", "").replaceAll("\\.$", "");
        }
        return String.valueOf(number);
    }

    static String escape(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder builder = new StringBuilder(value.length() + 16);
        for (int index = 0; index < value.length(); index++) {
            char current = value.charAt(index);
            switch (current) {
                case '\\':
                    builder.append("\\\\");
                    break;
                case '"':
                    builder.append("\\\"");
                    break;
                case '\r':
                    builder.append("\\r");
                    break;
                case '\n':
                    builder.append("\\n");
                    break;
                case '\t':
                    builder.append("\\t");
                    break;
                case '\b':
                    builder.append("\\b");
                    break;
                case '\f':
                    builder.append("\\f");
                    break;
                default:
                    if (current < 0x20) {
                        builder.append(String.format(Locale.US, "\\u%04x", (int) current));
                    } else {
                        builder.append(current);
                    }
                    break;
            }
        }
        return builder.toString();
    }

    private static final class Parser {
        private final String source;
        private int index = 0;

        private Parser(String source) {
            this.source = source == null ? "" : source.trim();
        }

        private Object parse() {
            skipWhitespace();
            Object value = parseValue();
            skipWhitespace();
            if (index != source.length()) {
                throw new IllegalArgumentException("Unexpected trailing data at position " + index);
            }
            return value;
        }

        private Object parseValue() {
            skipWhitespace();
            if (index >= source.length()) {
                throw new IllegalArgumentException("Unexpected end of JSON.");
            }
            char current = source.charAt(index);
            switch (current) {
                case '{':
                    return parseObject();
                case '[':
                    return parseArray();
                case '"':
                    return parseString();
                case 't':
                    consumeLiteral("true");
                    return Boolean.TRUE;
                case 'f':
                    consumeLiteral("false");
                    return Boolean.FALSE;
                case 'n':
                    consumeLiteral("null");
                    return null;
                default:
                    if (current == '-' || Character.isDigit(current)) {
                        return parseNumber();
                    }
                    throw new IllegalArgumentException("Unexpected token at position " + index);
            }
        }

        private Map<String, Object> parseObject() {
            LinkedHashMap<String, Object> map = new LinkedHashMap<String, Object>();
            expect('{');
            skipWhitespace();
            if (peek('}')) {
                expect('}');
                return map;
            }
            while (true) {
                skipWhitespace();
                String key = parseString();
                skipWhitespace();
                expect(':');
                skipWhitespace();
                map.put(key, parseValue());
                skipWhitespace();
                if (peek('}')) {
                    expect('}');
                    return map;
                }
                expect(',');
            }
        }

        private List<Object> parseArray() {
            List<Object> list = new ArrayList<Object>();
            expect('[');
            skipWhitespace();
            if (peek(']')) {
                expect(']');
                return list;
            }
            while (true) {
                skipWhitespace();
                list.add(parseValue());
                skipWhitespace();
                if (peek(']')) {
                    expect(']');
                    return list;
                }
                expect(',');
            }
        }

        private String parseString() {
            expect('"');
            StringBuilder builder = new StringBuilder();
            while (index < source.length()) {
                char current = source.charAt(index++);
                if (current == '"') {
                    return builder.toString();
                }
                if (current == '\\') {
                    if (index >= source.length()) {
                        throw new IllegalArgumentException("Unexpected end of escaped string.");
                    }
                    char escaped = source.charAt(index++);
                    switch (escaped) {
                        case '"':
                        case '\\':
                        case '/':
                            builder.append(escaped);
                            break;
                        case 'b':
                            builder.append('\b');
                            break;
                        case 'f':
                            builder.append('\f');
                            break;
                        case 'n':
                            builder.append('\n');
                            break;
                        case 'r':
                            builder.append('\r');
                            break;
                        case 't':
                            builder.append('\t');
                            break;
                        case 'u':
                            builder.append(parseUnicode());
                            break;
                        default:
                            throw new IllegalArgumentException("Unsupported escape sequence: \\" + escaped);
                    }
                } else {
                    builder.append(current);
                }
            }
            throw new IllegalArgumentException("Unterminated string literal.");
        }

        private char parseUnicode() {
            if (index + 4 > source.length()) {
                throw new IllegalArgumentException("Invalid unicode escape at position " + index);
            }
            String codePoint = source.substring(index, index + 4);
            index += 4;
            return (char) Integer.parseInt(codePoint, 16);
        }

        private Number parseNumber() {
            int start = index;
            if (peek('-')) {
                index++;
            }
            while (index < source.length() && Character.isDigit(source.charAt(index))) {
                index++;
            }
            if (peek('.')) {
                index++;
                while (index < source.length() && Character.isDigit(source.charAt(index))) {
                    index++;
                }
            }
            if (peek('e') || peek('E')) {
                index++;
                if (peek('+') || peek('-')) {
                    index++;
                }
                while (index < source.length() && Character.isDigit(source.charAt(index))) {
                    index++;
                }
            }
            String number = source.substring(start, index);
            if (number.contains(".") || number.contains("e") || number.contains("E")) {
                return Double.valueOf(number);
            }
            long value = Long.parseLong(number);
            if (value >= Integer.MIN_VALUE && value <= Integer.MAX_VALUE) {
                return Integer.valueOf((int) value);
            }
            return Long.valueOf(value);
        }

        private void consumeLiteral(String literal) {
            if (!source.regionMatches(index, literal, 0, literal.length())) {
                throw new IllegalArgumentException("Expected " + literal + " at position " + index);
            }
            index += literal.length();
        }

        private void expect(char expected) {
            if (index >= source.length() || source.charAt(index) != expected) {
                throw new IllegalArgumentException("Expected '" + expected + "' at position " + index);
            }
            index++;
        }

        private boolean peek(char expected) {
            return index < source.length() && source.charAt(index) == expected;
        }

        private void skipWhitespace() {
            while (index < source.length()) {
                char current = source.charAt(index);
                if (current == ' ' || current == '\n' || current == '\r' || current == '\t') {
                    index++;
                    continue;
                }
                break;
            }
        }
    }
}
