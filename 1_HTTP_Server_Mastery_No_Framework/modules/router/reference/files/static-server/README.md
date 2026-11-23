# 07 - Static File Server

## Goal

Understand how static servers map URLs to disk paths and stream public assets safely.

This module serves files from a `public/` directory using only Node core modules.

## Run

```sh
npm run module:07
```

Open:

```sh
http://127.0.0.1:3107/static/
```

Or run:

```sh
npm run module:07:challenge
```

## Routes

- `GET /`: redirects to `/static/`.
- `GET /health`: health check.
- `GET /static/*`: streams static files from this module's `public/` folder.
- `HEAD /static/*`: returns static headers without a body.

## Hard Example

Serve a mini frontend with cache headers and path traversal protection.

The implementation supports:

- directory index resolution with `index.html`.
- nested static files.
- MIME type detection.
- `Content-Length`.
- `Cache-Control`.
- `ETag`.
- `Last-Modified`.
- `If-None-Match` conditional `304`.
- `HEAD`.
- `405 Method Not Allowed`.
- safe path resolution to prevent `../../` traversal.

## Mastery Checks

- Can you prevent `../../` attacks?
- Can you infer MIME types?
- Can you choose sensible cache headers for HTML versus assets?
- Can you explain why HTML usually gets `no-cache`?
- Can you explain how an `ETag` lets the browser avoid downloading unchanged files?
