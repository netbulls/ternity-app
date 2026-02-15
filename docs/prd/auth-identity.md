# Auth & Identity

## Overview

Authentication and authorization via Logto OSS (self-hosted). Passwordless phone login as primary method, with Google social login and email magic link recovery.

## Provider

**Logto OSS** — `netbulls.ternity.auth`

| | Dev | Prod |
|---|---|---|
| **URL** | dev.auth.ternity.xyz | auth.ternity.xyz |
| **Admin** | admin.dev.auth.ternity.xyz | admin.auth.ternity.xyz |

## Login Methods

- **Primary:** Phone number + SMS OTP (passwordless, via Twilio)
- **Social:** Google OAuth
- **Recovery:** Email magic links (email optional but encouraged)
- **MFA:** TOTP / passkeys (not SMS — SMS is the primary login method)

## Account Creation

Phone number is required for all accounts. Even users who sign up via Google must add and verify a phone number. Email is optional but recommended for recovery.

## Authorization Model

- **Global roles:** `admin` (system-wide)
- **Organization roles (per project):** `manager`, `user`
- Logto Organizations map to Ternity projects
- Each project has its own role assignments (who is manager, who is user)
- Leave approver = user with `manager` role on that project's organization
- Roles and permissions are included in JWT access tokens
- Backend validates scopes on every API request

## Integration

- **Frontend:** `@logto/react` SDK (OIDC PKCE flow)
- **Backend:** Fastify middleware for JWT validation + RBAC scope checks
- **Type sharing:** Zod schemas for permission definitions in `/packages/shared`
