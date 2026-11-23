# 03 - JSON Body Parser

## Goal

Understand how JSON request bodies are assembled from raw stream chunks and converted into useful data.

This module uses only Node core modules. The parser lives in `jsonBodyParser.js` so the stream-reading mechanics are easy to inspect.

## Run

```sh
npm run module:03
```

Open another terminal and try:

```sh
curl -i -X POST http://127.0.0.1:3103/echo-json -H 'Content-Type: application/json' --data '{"hello":"node"}'
curl -i -X POST http://127.0.0.1:3103/echo-json -H 'Content-Type: text/plain' --data 'hello'
curl -i -X POST http://127.0.0.1:3103/echo-json -H 'Content-Type: application/json' --data '{bad'
npm run module:03:challenge
```

## Routes

- `GET /`: route list and example commands.
- `GET /health`: health check.
- `POST /echo-json`: parses JSON, allows an empty body, and echoes parser metadata.
- `POST /required-json`: parses JSON and rejects an empty body.

## Hard Example

Create a JSON parser that rejects oversized, malformed, and wrong-content-type requests.

The implemented parser supports:

- `application/json`.
- `application/*+json`.
- Request body byte limits.
- Empty body behavior controlled by option.
- `415` for wrong content type.
- `400` for malformed JSON.
- `413` for oversized JSON.
- Body byte count and safe parser error details.

## Mastery Checks

- Can you explain why body parsing is asynchronous?
- Can you stop reading after a request exceeds the limit?
- Can you return safe errors for invalid JSON?
- Can you explain why request chunks must be buffered before `JSON.parse`?
- Can you explain why this parser should run only once per request?
