# 12 - Full File Management API

## Goal

Combine the earlier modules into a complete authenticated file-management API.

This module is the capstone for modules 1-8: raw HTTP routing, JSON bodies, multipart upload, streaming download, cookies, sessions, and metadata persistence.

## Run

```sh
npm run module:12
```

Run the end-to-end challenge:

```sh
npm run module:12:challenge
```

## Routes

- `POST /auth/register`: create a user.
- `POST /auth/login`: create a signed-cookie session.
- `POST /files`: authenticated multipart upload.
- `GET /files`: list your files.
- `GET /files/:id`: read one file metadata record.
- `GET /files/:id/download`: stream file bytes.
- `PATCH /files/:id`: update display name or tags.
- `DELETE /files/:id`: delete metadata and stored file.

## Hard Example

Build an authenticated file manager API with JSON metadata stored under `data/`.

The implementation stores metadata in `modules/12-file-management-api/data/files.json` and uploaded bytes in `modules/12-file-management-api/uploads/`.

## Mastery Checks

- Can you compose middleware and routes cleanly?
- Can you store metadata separately from file bytes?
- Can you protect every file operation with auth?
- Can you explain why downloads verify ownership before streaming?
- Can you explain why metadata and file bytes are stored separately?
