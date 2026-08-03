# Pure Node.js HTTP Server Mastery

This repo is organized as a learning path for mastering Node.js HTTP servers without Express, Fastify, Koa, Multer, Busboy, or WebSocket helper libraries.

## How To Use This Repo

Each module is self-contained and has:

- `README.md` for the concept, learning goal, hard example, and test commands.
- `server.js` as the module entry point.
- `challenge.js` for the harder exercise or client-side stress/demo script.

Run the original combined server:

```sh
npm start
```

Run a specific module:

```sh
npm run module:01
```

Check JavaScript syntax:

```sh
npm run check
```

## Module Path

1. HTTP server from scratch
2. Routing system from scratch
3. JSON body parser
4. Query params + URL params
5. File upload parser
6. File streaming download
7. Static file server
8. Auth system
9. EventEmitter-based internal events
10. Server-Sent Events
11. WebSocket basics
12. Build full File Management API
13. Add live upload/progress notifications
14. Add logs, errors, rate limits, security

## Shared Code

Reusable building blocks live in `shared/`. Modules can use shared code only after the module has taught the underlying idea from first principles.
