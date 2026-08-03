# 13 - Live Upload/Progress Notifications

## Goal

Understand how request stream byte counts can drive live progress notifications.

This module combines raw upload streaming with Server-Sent Events. The upload endpoint writes chunks to disk and publishes progress snapshots as bytes arrive.

## Run

```sh
npm run module:13
```

Open the browser demo:

```sh
http://127.0.0.1:3113/
```

Or run:

```sh
npm run module:13:challenge
```

## Routes

- `GET /`: browser upload page.
- `GET /events?uploadId=...`: SSE progress stream.
- `POST /upload?uploadId=...&filename=...`: raw file upload body.
- `GET /stats`: SSE client and history stats.

## Hard Example

Show browser upload percentage, speed, and completion status in real time.

The implementation supports:

- byte counting from `req.on("data")`.
- percent calculation from `Content-Length`.
- upload speed in bytes per second.
- `done` event when the file is fully written.
- SSE filtering by `uploadId`.
- browser progress bar using `EventSource`.
- a challenge client that uploads in chunks to make progress visible.

## Mastery Checks

- Can you calculate progress from `Content-Length`?
- Can you handle unknown upload size?
- Can you publish progress without blocking the upload stream?
- Can you explain why progress updates should be throttled?
- Can you explain why `Content-Length` may be missing for some clients?
