# 14 - Logs, Errors, Rate Limits, Security

## Goal

Understand the production basics around a raw Node HTTP server: observability, error safety, abuse limits, and security headers.

This module wraps a small API with the kind of defensive plumbing every server eventually needs.

## Run

```sh
npm run module:14
```

Run the challenge client:

```sh
npm run module:14:challenge
```

## Routes

- `GET /`: module info.
- `GET /health`: health check.
- `POST /echo`: JSON body echo with a small body limit.
- `GET /boom`: intentional internal error that returns a safe message.
- `GET /logs`: recent structured access logs.

## Hard Example

Build a production-ish API shell with access logs, safe errors, IP rate limits, and audit events.

The implementation supports:

- request IDs via `X-Request-ID`.
- structured JSON access logs.
- safe centralized error responses.
- `429 Too Many Requests` with `Retry-After`.
- per-IP in-memory rate limiting.
- JSON body size limits.
- security headers like `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, and `Referrer-Policy`.
- `clientError` handling for malformed HTTP requests.

## Mastery Checks

- Can you attach a request ID to every log line?
- Can you avoid leaking stack traces to clients?
- Can you rate-limit by IP without external packages?
- Can you explain which error messages are safe to expose?
- Can you explain why in-memory rate limits reset when the process restarts?
