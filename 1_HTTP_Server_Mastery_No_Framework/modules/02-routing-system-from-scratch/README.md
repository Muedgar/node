# 02 - Routing System From Scratch

## Goal

Understand how routing works without Express: method matching, path segment matching, dynamic URL params, and fallback handlers.

This module uses only Node core modules plus a local `router.js` built from arrays, objects, and path segments.

## Run

```sh
npm run module:02
```

Open another terminal and try:

```sh
curl -i http://127.0.0.1:3102/
curl -i http://127.0.0.1:3102/users/42
curl -i 'http://127.0.0.1:3102/users/42/files/report%202026.pdf?download=true&tag=node&tag=http'
curl -i -X POST http://127.0.0.1:3102/users/42/files
curl -i -X PATCH http://127.0.0.1:3102/users/42/files/report.pdf
npm run module:02:challenge
```

## Routes

- `GET /`: route list and examples.
- `GET /health`: health check.
- `GET /users/:userId`: dynamic URL param example.
- `GET /users/:userId/files/:fileId`: hard example route.
- `POST /users/:userId/files`: same path family with a different method.
- `DELETE /users/:userId/files/:fileId`: method matching example.

## Hard Example

Build an Express-like router that matches `GET /users/:id/files/:fileId` and exposes `req.params`.

The implemented router supports:

- Static segments like `/health`.
- Dynamic segments like `:userId` and `:fileId`.
- URL decoding for params.
- Repeated query params as arrays.
- Route priority by static-segment score.
- `404 Route not found`.
- `405 Method not allowed` with an `Allow` header.

## Mastery Checks

- Can you explain route order and why it matters?
- Can your router distinguish `404 Not Found` from `405 Method Not Allowed`?
- Can you safely decode URL params?
- Can you explain why static route segments should win over dynamic segments?
- Can you add `PUT /users/:userId/files/:fileId` without changing the matching algorithm?
