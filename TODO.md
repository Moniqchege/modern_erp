# TODO - Signin + Auth Flow Implementation

## Plan Steps
- [ ] 1) Inspect existing backend/DB state and confirm there are no auth tables or endpoints yet.
- [ ] 2) Add Prisma models/tables for: password reset tokens, OTP codes, and refresh/session tokens (or minimal JWT).
- [ ] 3) Implement backend auth controller/service:
  - seed default admin user (with force-reset flag)
  - login: generate OTP, verify OTP, issue access token/session
  - force password reset for newly created/first-login users
- [ ] 4) Wire backend routes under `/api/auth/*`.
- [ ] 5) Implement frontend Signin + OTP verification + Force reset pages.
- [ ] 6) Implement protected landing page layout that shows module cards and redirects to module routes.
- [ ] 7) Add auth-aware routing and token storage.
- [ ] 8) Run prisma migrate and backend/frontend smoke tests.

