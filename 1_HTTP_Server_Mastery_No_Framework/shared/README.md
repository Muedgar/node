# Shared Pure Node.js Building Blocks

Reusable code extracted from the original `app/` folder.

## Folders

- `http/`: app composition and middleware chaining.
- `router/`: route registration and URL parameter matching.
- `body/`: body parsers.
- `files/`: static file, download, and multipart helpers.
- `auth/`: cookie and session helpers.
- `events/`: event bus utilities.
- `security/`: hardening utilities.

Keep shared code small and explicit. The goal is to learn Node internals, not hide them.
