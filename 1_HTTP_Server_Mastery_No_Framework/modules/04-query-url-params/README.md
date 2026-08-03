# 04 - Query Params + URL Params

## Goal

Understand URL parsing with Node and the WHATWG `URL` API, including query values and dynamic route params.

This module focuses on the difference between:

- URL params: values extracted from the path, like `/users/:userId/files/:fileId`.
- Query params: values extracted after `?`, like `?tag=node&page=2`.

## Run

```sh
npm run module:04
```

Open another terminal and try:

```sh
curl -i 'http://127.0.0.1:3104/users/42/files?tag=node&tag=http&page=1&limit=2&sort=size&order=desc'
curl -i 'http://127.0.0.1:3104/users/42/files?q=json&archived=false'
curl -i 'http://127.0.0.1:3104/users/42/files/f-100?download=true'
curl -i 'http://127.0.0.1:3104/users/42/files?page=abc'
npm run module:04:challenge
```

## Routes

- `GET /`: route list and query option guide.
- `GET /health`: health check.
- `GET /users/:userId/files`: file search endpoint.
- `GET /users/:userId/files/:fileId`: single file lookup with route params.

## Hard Example

Build a search endpoint with pagination, filters, sorting, repeated tags, and URL params.

The implemented search endpoint supports:

- `tag`: repeatable, for example `?tag=node&tag=http`.
- `page`: positive integer, default `1`.
- `limit`: positive integer up to `20`, default `5`.
- `sort`: `name`, `size`, or `createdAt`.
- `order`: `asc` or `desc`.
- `archived`: `true` or `false`.
- `q`: case-insensitive filename search.

It returns both `rawQuery` and `parsedQuery` so you can see the transformation from URL text into typed values.

## Mastery Checks

- Can you preserve repeated query params as arrays?
- Can you validate numeric query params?
- Can you combine route params and query params in one handler?
- Can you explain why `URLSearchParams.getAll()` matters?
- Can you return a clear `400` for invalid URL encoding or invalid query values?
