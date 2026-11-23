# Security

Authentication and protection concerns live separately from routing fundamentals:

- [Authentication](authentication/README.md): `npm run security:auth` (legacy module:08).
- [Logs, errors, rate limits and security](hardening/README.md): `npm run security:hardening` (legacy module:14).
- [Secured file-management API](file-management/README.md): `npm run security:file-management` (legacy module:12).

The secured file API combines sessions and file ownership with uploads/downloads. Its request-body parsers import the Router fundamentals; its authentication logic stays here. Existing example data and uploads were preserved during the move.
