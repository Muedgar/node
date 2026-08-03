# 11 - WebSocket Basics

## Goal

Understand WebSocket basics without a helper library: HTTP upgrade, accept key hashing, sockets, frames, and broadcasts.

This module implements just enough RFC 6455 to understand the moving parts. It does not use the `ws` package.

## Run

```sh
npm run module:11
```

Open the browser demo:

```sh
http://127.0.0.1:3111/
```

Or run the raw TCP challenge client:

```sh
npm run module:11:challenge
```

## Routes

- `GET /`: browser chat demo using native `WebSocket`.
- `GET /health`: health check.
- `GET /stats`: connected socket list.
- `WS /ws`: WebSocket upgrade endpoint.

## Hard Example

Create a tiny realtime chat or file activity feed without the `ws` package.

The implementation supports:

- HTTP `upgrade` handling.
- `Sec-WebSocket-Accept` hashing.
- server-to-client text frames.
- masked client-to-server text frames.
- close frames.
- ping to pong handling.
- echoing messages to the sender.
- broadcasting messages to other clients.

## Mastery Checks

- Can you compute `Sec-WebSocket-Accept`?
- Can you explain masked client frames?
- Can you broadcast to multiple connected sockets?
- Can you explain why browser-to-server frames are masked?
- Can you explain the difference between the HTTP server and the upgraded socket?
