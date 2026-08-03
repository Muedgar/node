# 06 - File Streaming Download

## Goal

Understand file streaming, response headers, download behavior, backpressure, and partial content.

This module streams files with `fs.createReadStream`. It does not read the entire file into memory before responding.

## Run

```sh
npm run module:06
```

Try the challenge client:

```sh
npm run module:06:challenge
```

Or use curl:

```sh
curl -i http://127.0.0.1:3106/files
curl -i http://127.0.0.1:3106/download/node-streaming-guide.txt
curl -i -H 'Range: bytes=0-31' http://127.0.0.1:3106/download/node-streaming-guide.txt
curl -i -H 'Range: bytes=-24' http://127.0.0.1:3106/download/node-streaming-guide.txt
```

## Routes

- `GET /`: module info.
- `GET /health`: health check.
- `GET /files`: list downloadable fixture files.
- `GET /download/:file`: stream a file as an attachment.

## Hard Example

Support resumable downloads with HTTP `Range` headers.

The implementation supports:

- `Content-Length`.
- `Content-Type`.
- `Content-Disposition`.
- `Accept-Ranges: bytes`.
- `206 Partial Content`.
- `Content-Range`.
- suffix ranges like `bytes=-24`.
- open-ended ranges like `bytes=32-`.
- `416 Range Not Satisfiable`.
- safe path resolution to block `../../` traversal.

## Mastery Checks

- Can you stream a file without reading it all into memory?
- Can you set `Content-Disposition` correctly?
- Can you return `206 Partial Content` for range requests?
- Can you explain why `Range: bytes=0-31` returns 32 bytes?
- Can you explain what `Content-Range: bytes 0-31/388` means?
