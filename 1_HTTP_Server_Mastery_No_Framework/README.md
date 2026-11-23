# Pure Node.js HTTP Server Mastery

Three broad modules, built without Express or other web frameworks:

| Module                                 | Focus                                                                    | Start                       |
| -------------------------------------- | ------------------------------------------------------------------------ | --------------------------- |
| [Router](modules/router/README.md)     | Ten request/routing fundamentals reused in five file-backed MVC projects | `npm run router:todo`       |
| [Sockets](modules/sockets/README.md)   | Internal events, server-sent events and WebSocket                        | `npm run sockets:websocket` |
| [Security](modules/security/README.md) | Authentication, request hardening and a secured file API                 | `npm run security:auth`     |

## Router learning path

Read [routes-fundamentals](modules/router/routes-fundamentals/README.md) once, then practice Todo, Notes, Reading List, Room Booking and Food Store. JSON bodies, query strings, HTML forms and multipart uploads are request fundamentals rather than separate top-level modules.

```sh
npm run router:todo
npm run router:todo:test
npm run router:test
npm run check
```

Projects use only Node core modules (Node.js 20+). State is saved to local JSON files; tests isolate their data in temporary folders. File stores serialize updates within one process, so run one process per project data file.

## Existing examples

The original combined demo remains available with `npm start`. Original lessons are grouped under Router/reference, Sockets and Security. Existing module:01 through module:14 aliases still run the moved examples. Their numeric IDs are historical lesson names, not fourteen top-level modules.

shared/ contains compatibility helpers for the original combined demo; the five new router projects import routes-fundamentals directly.
