# 10 - Server-Sent Events

## Goal

Understand Server-Sent Events as long-lived HTTP responses that stream events from server to browser.

SSE is one-way realtime communication over normal HTTP: the browser connects once, and the server keeps writing event frames.

## Run

```sh
npm run module:10
```

Open the dashboard:

```sh
http://127.0.0.1:3110/
```

Or run:

```sh
npm run module:10:challenge
```

## Routes

- `GET /`: browser dashboard using `EventSource`.
- `GET /health`: health check.
- `GET /events`: SSE stream.
- `POST /broadcast`: emits an `activity` event.
- `POST /fake-upload`: emits several `upload.progress` events.
- `GET /stats`: connected clients and replay-buffer stats.

## Hard Example

Build a live server dashboard with connected clients, heartbeat comments, and event replay IDs.

The implementation supports:

- `Content-Type: text/event-stream`.
- `Cache-Control: no-cache, no-transform`.
- long-lived responses.
- client tracking.
- disconnect cleanup with `req.on("close")`.
- heartbeat comments.
- event IDs.
- named events.
- replay from `Last-Event-ID`.
- browser `EventSource` dashboard.

## Mastery Checks

- Can you set the correct SSE headers?
- Can you detect when a browser disconnects?
- Can you keep the connection alive behind proxies?
- Can you explain the difference between SSE comments and SSE events?
- Can you explain why SSE is simpler than WebSocket for server-to-client notifications?
