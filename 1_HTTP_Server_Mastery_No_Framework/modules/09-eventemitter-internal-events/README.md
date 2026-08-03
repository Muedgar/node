# 09 - EventEmitter-Based Internal Events

## Goal

Understand how internal application events decouple request handlers from side effects.

This module uses Node's built-in `events` module. Request handlers emit domain events; listeners turn those events into an audit log.

## Run

```sh
npm run module:09
```

Try the challenge client:

```sh
npm run module:09:challenge
```

## Routes

- `GET /`: route list.
- `GET /health`: health check.
- `POST /auth/login`: emits `auth.login`.
- `POST /files`: emits `file.uploaded`.
- `DELETE /files/:id`: emits `file.deleted`.
- `POST /explode`: emits `server.error`.
- `GET /audit-log`: shows listener-generated audit entries.

## Hard Example

Emit upload, login, file-delete, and error events into an internal audit log.

The implementation demonstrates:

- an `EventEmitter`-backed internal event bus.
- request handlers emitting events after core work succeeds.
- audit listeners that subscribe to event names.
- listener error isolation so one bad listener does not crash the request.
- an in-memory audit log capped to the latest 100 entries.

## Mastery Checks

- Can you explain when events are synchronous?
- Can you keep event listeners from crashing requests?
- Can you use events without hiding core control flow?
- Can you explain why events are useful for audit logs and notifications?
- Can you decide what data belongs in an event payload?
