# FPN Attendance Management System — Backend

Federal Polytechnic Nekede QR + Device-Fingerprint Attendance Management System.
Node.js / Express / Prisma / PostgreSQL.

## Setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env — set DATABASE_URL, JWT secrets, WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN

npx prisma migrate dev --name init
npm run seed        # creates SUPER_ADMIN + departments + active session
npm run dev          # http://localhost:4000
```

Default admin (change immediately — `mustChangePassword` is set on seed):
- Email: `admin@fpn.edu.ng`
- Password: `Admin@123456`

## WebAuthn / Device Fingerprint Notes

`WEBAUTHN_RP_ID` must match the domain the frontend is served from (no scheme,
no port) — `localhost` for local dev, your real domain in production (e.g.
`attendance.fpn.edu.ng`). `WEBAUTHN_ORIGIN` must be the exact scheme+host+port
the browser sends, e.g. `https://attendance.fpn.edu.ng`. Fingerprint/Face ID
attendance requires HTTPS in production — browsers refuse WebAuthn over plain
HTTP except on localhost.

No biometric image is ever stored: only the WebAuthn credential ID and public
key (`fingerprint_credentials` table).

## Architecture

```
src/
  config/       env, prisma client singleton, logger
  controllers/  HTTP layer — thin, calls services
  services/     business logic — auth, attendance, webauthn, qr, reports, ...
  middleware/   authenticate, authorize (RBAC), validate (zod), rate limiting, error handler
  validators/   zod schemas per module
  routes/       express routers, mounted under /api in app.js
  utils/        AppError, catchAsync, password/jwt helpers
prisma/
  schema.prisma
  seed.js
```

## Auth Model

- Access token: short-lived JWT (15m default), sent as `Authorization: Bearer <token>`.
- Refresh token: opaque random string, stored client-side in an httpOnly cookie
  (scoped to `/api/auth`), hashed (SHA-256) server-side before storage, rotated
  on every refresh.
- Three login endpoints (`/api/auth/admin/login`, `/lecturer/login`,
  `/student/login`) — student logs in with Application Number, not email.

## Attendance Verification Flow

- `QR_CODE` — student scans QR → `POST /api/attendance/scan-qr` → recorded immediately.
- `DEVICE_FINGERPRINT` — client requests a WebAuthn challenge
  (`GET /api/webauthn/authenticate/options`), performs
  `navigator.credentials.get()` on-device, then sends the resulting assertion
  to `POST /api/attendance/sign-fingerprint`. The assertion is verified
  **server-side, inside the same request** that writes the attendance record —
  the API never trusts a bare "fingerprint passed" flag from the client.
- `QR_AND_FINGERPRINT` (recommended, anti-proxy) — `scan-qr` returns
  `requiresFingerprint: true` + a `sessionToken`; client completes the WebAuthn
  ceremony, then calls `POST /api/attendance/complete-combined` with both the
  `sessionToken` and the assertion, verified atomically before the record is written.

## Known Limitations / Next Steps

- WebAuthn challenge store is in-memory (`Map`) — fine for a single Node
  process; move to Redis before scaling horizontally.
- `npm install` could not be verified in this sandbox (no network egress) —
  all files pass `node --check` syntax validation and local `require()` paths
  resolve correctly, but run `npm install && npx prisma generate` yourself
  before first use to catch anything a static check can't (e.g. actual Prisma
  client type generation from the schema).
- No automated test suite included yet.
