# 05 - File Upload Parser

## Goal

Understand multipart uploads at the byte level: boundaries, part headers, text fields, file fields, and safety limits.

This module parses `multipart/form-data` manually with Node streams and Buffers. It does not use Multer, Busboy, Formidable, Express, or any framework.

## Run

```sh
npm run module:05
```

Open the browser form:

```sh
http://127.0.0.1:3105/
```

Or run the challenge client:

```sh
npm run module:05:challenge
```

## Routes

- `GET /`: upload form using `multipart/form-data`.
- `GET /health`: health check.
- `POST /upload`: parses fields and files, saves files under `modules/05-file-upload-parser/uploads`.

## Hard Example

Upload multiple files plus metadata without Multer, Busboy, or any framework.

The implemented parser supports:

- Extracting the boundary from `Content-Type`.
- Splitting multipart parts by boundary.
- Parsing part headers.
- Reading `Content-Disposition` field names and filenames.
- Grouping repeated text fields into arrays.
- Saving multiple uploaded files.
- Sanitizing unsafe filenames.
- Enforcing max body and max file sizes.
- Returning `415`, `400`, and `413` errors for common upload failures.

## Mastery Checks

- Can you extract the multipart boundary from `Content-Type`?
- Can you separate fields from files?
- Can you prevent unsafe filenames and oversized uploads?
- Can you explain why uploaded file bytes should be handled as Buffers?
- Can you explain why buffering the entire body is educational but not ideal for very large production uploads?
