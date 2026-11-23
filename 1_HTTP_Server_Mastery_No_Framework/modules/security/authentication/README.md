# 08 - Auth System

## Goal

Understand authentication from raw HTTP pieces: cookies, sessions, password hashing, login, logout, and protected routes.

This module uses only Node core modules. It stores users and sessions in memory so the mechanics stay visible.

## Run

```sh
npm run module:08
```

Try the challenge client:

```sh
npm run module:08:challenge
```

Or use curl:

```sh
curl -i -X POST http://127.0.0.1:3108/auth/register -H 'Content-Type: application/json' --data '{"email":"demo@example.com","password":"password123"}'
curl -i -X POST http://127.0.0.1:3108/auth/login -H 'Content-Type: application/json' --data '{"email":"demo@example.com","password":"password123"}'
```

## Routes

- `GET /`: route list.
- `GET /health`: health check.
- `POST /auth/register`: creates a user with a salted password hash.
- `POST /auth/login`: verifies password and sets a signed `HttpOnly` session cookie.
- `POST /auth/logout`: destroys the session and clears the cookie.
- `GET /auth/me`: protected current-user route.
- `GET /files`: protected example file route.

## Hard Example

Implement `register`, `login`, `logout`, and `me` with signed session cookies and protected file routes.

The implementation supports:

- PBKDF2 password hashing with random salts.
- constant-time password hash comparison.
- signed session cookies using HMAC.
- `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Max-Age`.
- in-memory sessions.
- protected route guard.
- consistent `401`, `409`, `415`, and `405` responses.

## Mastery Checks

- Can you explain why passwords need salts?
- Can you set `HttpOnly`, `SameSite`, and `Path` cookie attributes?
- Can you reject unauthenticated users consistently?
- Can you explain why signed cookies prevent tampering but not visibility?
- Can you explain why this in-memory session store disappears on restart?
