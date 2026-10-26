# 180 Traffic Director - Agentic Workspace Guidelines & Rules

Welcome to the **180 Traffic Director** standalone workspace. Agents operating within this codebase must strictly observe the following domain-driven design, security, and edge-computing architectural tenets:

## 1. Zero-Tolerance Secrets & Credential Security
- Read `.agents/rules/security-and-secrets.md`.
- **NEVER** hardcode database passwords, JWT signing keys, Meta Graph API access tokens, or CAPI verification secrets.
- Always retrieve environment configurations via `process.env` or centralized config services.

## 2. Multi-Tenant Scoping & Company Isolation
- All database queries for Links, Rules, Threat Lists, Pixel Configurations, and Logs **MUST** enforce `companyId` scoping.
- Unauthenticated requests to management APIs must be rejected with `HTTP 401/403`.
- Edge routing redirectors (`/r/:slug`, `/tag/:slug.js`, `/evaluate/:slug`) execute publicly for visitors, but client data ingestion (`/pixel/event`) must securely bind to the link's registered tenant.

## 3. Edge Latency & Non-Blocking Design
- The edge decision engine (`/evaluate/:slug`) must maintain sub-10ms evaluation latency.
- Never place synchronous blocking network calls in the critical redirect path.
- Heavy forensic operations (IP geolocation lookups, Tor exit sync, CAPI server-to-server dispatches) must be cached in Redis or processed asynchronously via event streams.

## 4. UI Architecture & Design System Conventions
- Read `.agents/rules/ui-architecture.md` and `.agents/rules/design-system.md`.
- Build components using Tailwind CSS and the shared `@workspace/ui` Shadcn library.
- Adhere to the curated dark-mode glassmorphic theme with consistent accent colors and micro-interactions.

## 5. Routine Checkups & Verification Battery
- Before committing changes, run the live automated endpoint test battery:
  ```bash
  cd apps/backend
  npx tsx scripts/test_live_backend_all_endpoints.ts
  ```
