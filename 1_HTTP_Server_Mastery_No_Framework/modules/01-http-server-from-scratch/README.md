# 01 - HTTP Server From Scratch

## Goal

Understand Node's raw HTTP primitives: `http.createServer`, `IncomingMessage`, `ServerResponse`, headers, status codes, and request streams.

This module intentionally uses only Node core modules. No shared app helper, router, framework, body parser, or middleware abstraction.

## Run

```sh
npm run module:01
```

Open another terminal and try:

```sh
curl -i http://127.0.0.1:3101/
curl -i http://127.0.0.1:3101/health
curl -i -X POST http://127.0.0.1:3101/inspect -H 'Content-Type: text/plain' --data 'hello pure node'
node modules/01-http-server-from-scratch/challenge.js
```

## Routes

- `GET /`: plain text route list.
- `GET /health`: JSON health check.
- `ANY /inspect`: reads the request body stream and returns request details.

## Hard Example

Build an HTTP inspector that returns method, URL, headers, client address, body byte count, and request duration.

The implemented `/inspect` route reports:

- HTTP method, URL, path, query params, and HTTP version.
- Raw headers and parsed headers.
- Client socket address and port.
- Request body byte count and a short UTF-8 preview.
- Request handling duration in milliseconds.

## Mastery Checks

- Can you explain when the request `data` and `end` events fire?
- Can you return different status codes without any framework?
- Can you avoid reading large request bodies forever?
- Can you explain why `req` is readable and `res` is writable?
- Can you explain what `server.on("clientError")` catches?
