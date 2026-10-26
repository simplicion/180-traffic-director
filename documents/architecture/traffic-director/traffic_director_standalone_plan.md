# Architectural Master Plan: Standalone 180 Traffic Director Spin-Off

**Document Version:** 1.0.0  
**Target System:** 180 Traffic Director (`apps/traffic-director-backend`, `apps/traffic-director-web`, `packages/domains/traffic-director`)  
**Architecture Style:** Domain-Driven Design (DDD) & Clean Microservice Decoupling  
**Primary Goal:** Decouple Traffic Director from the monolithic `180workspace` into a dedicated, high-performance, standalone product.

---

## 1. Executive Summary & Strategy

Currently, 180 Traffic Director operates as a subsystem inside the `180workspace` monorepo:
* The frontend is housed in `apps/traffic-director-web`.
* The domain business logic resides in `packages/domains/traffic-director`.
* The backend API and edge routing are hosted inside `apps/backend` (a monolithic server containing unrelated CRM, HR, Calendar, and Finance endpoints).

### Phased Decoupling Strategy
To ensure **zero risk, zero downtime, and complete stability**, we follow a strict two-stage process:

1. **Stage 1 (In-Place Dedicated Backend):**
   * Build a dedicated, ultra-lean backend (`apps/traffic-director-backend`) inside the current workspace.
   * Mount all Traffic Director endpoints, edge redirectors, CAPI beacons, and threat sync workers on a dedicated port (`http://localhost:4005`).
   * Connect `apps/traffic-director-web` to port 4005 and verify 100% of features (Smart Links, Universal Pixels, CAPI, Domains, Threat Feeds, Subscriptions) against it.
   * Run the complete 27-suite automated regression test.

2. **Stage 2 (Project Extraction & Migration):**
   * Once certified in Stage 1, cleanly export the dedicated frontend, backend, and domain packages into the standalone `Traffic Director` project repository.

---

## 2. Target Standalone Architecture

```mermaid
graph TD
    subgraph Client Layer
        Web["traffic-director-web (Next.js / Port 3006)"]
        PublicVisitors["Ad Clicks & Visitors (/r/:slug)"]
        CMS["Shopify / WordPress / Webflow Tag"]
    end

    subgraph Dedicated Traffic Director Backend [Port 4005]
        Gateway["Express Edge Gateway (Helmet, CORS, RateLimiter)"]
        
        subgraph Auth & Context
            AuthMiddleware["180 Sovereign Identity JWT Guard"]
            CompanyContext["Tenant Isolation (companyId)"]
        end

        subgraph Public Edge Handlers
            EdgeEval["/evaluate/:slug (Sub-5ms Link Decision)"]
            TagServer["/tag/:slug.js (Dynamic Multi-Pixel Tag)"]
            CapiIngest["/pixel/event (Server-Side Beacon)"]
            ProxyServer["/stream-proxy (Safe Page Cloaking)"]
        end

        subgraph Management API (/api/v1/traffic-director)
            LinksAPI["Links CRUD & Reordering"]
            PixelAPI["Meta Pixel & CAPI Vault (AES-256)"]
            DomainAPI["Dedicated CNAME & DNS Manager"]
            ThreatAPI["Threat Feeds & Tor Exit Sync"]
            AnalyticsAPI["Real-Time Logs & Aggregations"]
            BillingAPI["180 Pay Billing & Subscriptions"]
        end
    end

    subgraph Domain Engine (@traffic-director/core)
        DecisionEngine["DecisionEngine & Rule Evaluator"]
        PixelManager["PixelManagerService & Token Encryption"]
        CapiService["Meta Graph API v19.0 Client"]
        ThreatIntel["ThreatIntelligenceService & CIDR Matcher"]
    end

    subgraph Storage & Upstream
        Postgres[("PostgreSQL (Prisma ORM)")]
        Redis[("Redis / In-Memory Edge Cache")]
        MetaAPI["Meta Graph API (facebook.com)"]
        IdentityCluster["180 Sovereign Identity (profile.180core.cloud)"]
    end

    Web --> AuthMiddleware
    AuthMiddleware --> ManagementAPI
    PublicVisitors --> EdgeEval
    CMS --> TagServer
    CMS --> CapiIngest
    PublicVisitors --> ProxyServer

    ManagementAPI --> DomainEngine
    EdgeEval --> DomainEngine
    TagServer --> DomainEngine
    CapiIngest --> DomainEngine

    DomainEngine --> Postgres
    DomainEngine --> MetaAPI
```

---

## 3. Detailed Step-by-Step Implementation Plan

### Step 1: Create Dedicated Backend Package (`apps/traffic-director-backend`)
* Initialize `apps/traffic-director-backend/package.json` with lean dependencies:
  - `express`, `cors`, `helmet`, `dotenv`, `jsonwebtoken`, `axios`
  - `@workspace/db` (shared Prisma client)
  - `traffic-director` (from `packages/domains/traffic-director`)
  - `tsx` / `typescript` for development
* Set dedicated port: `PORT=4005`.

### Step 2: Implement Clean Server Architecture
* **`src/server.ts`**: Entrypoint with graceful shutdown and health checks (`/health`).
* **`src/middleware/auth.ts`**: Pure Sovereign Identity JWT verification extracting user and `companyId`.
* **`src/routes/api.routes.ts`**:
  - `GET/POST/PUT/DELETE /api/v1/traffic-director/links`
  - `GET/POST/DELETE /api/v1/traffic-director/links/:id/pixel`
  - `GET /api/v1/traffic-director/links/:id/pixel/logs`
  - `GET/POST /api/v1/traffic-director/threats`
  - `GET/POST /api/v1/traffic-director/simulate`
  - `GET /api/v1/traffic-director/logs`
  - `GET /api/v1/traffic-director/overview`
  - `GET/POST /api/v1/traffic-director/billing/*`
* **`src/routes/public.routes.ts`**:
  - `GET /r/:slug` (high-throughput dynamic edge redirect)
  - `POST /evaluate/:slug` (JSON evaluation endpoint)
  - `GET /tag/:slug.js` (universal dynamic pixel tag compiler)
  - `POST /pixel/event` (server-side CAPI ingestion beacon)
  - `GET /stream-proxy` & `/asset-proxy` (stealth safe page proxying)
* **`src/cron/tor-sync.ts`**: Standalone cron running periodic Tor Exit Node directory synchronization.

### Step 3: Switch Frontend Target Port
* Update `apps/traffic-director-web/.env.local`:
  ```bash
  NEXT_PUBLIC_API_URL=http://localhost:4005
  NEXT_PUBLIC_API_BASE=http://localhost:4005
  NEXT_PUBLIC_180_AUTH_URL=https://profile.180core.cloud
  ```
* Verify in-memory SWR cache and fetch calls connect to port `4005`.

### Step 4: End-to-End Simulation & Verification
* Run user-side simulations in `apps/traffic-director-web`:
  1. Create Smart Link with Cloaking & Ramp-Up
  2. Configure Master Pixel + Backup Pixel + Encrypted CAPI Token
  3. Dispatch Test Conversion Beacon to verify CAPI delivery
  4. Connect Dedicated CNAME Domain
  5. Test Edge Simulator with Bot / Tor / Carrier IPs
* Run automated regression suites:
  - `npx tsx scripts/tests/run_all_tests.ts` (all 27 suites).

### Step 5: Standalone Project Export
* Create folder: `c:\Users\saavi\Desktop\180 Project\traffic-director`.
* Copy over:
  - Frontend: `apps/traffic-director-web` -> `apps/web`
  - Backend: `apps/traffic-director-backend` -> `apps/api`
  - Domain Engine: `packages/domains/traffic-director` -> `packages/core`
* Initialize clean root `pnpm-workspace.yaml`, `package.json`, and `turbo.json`.

---

## 4. Verification Checkpoints & Sign-Off Criteria

| Checkpoint | Validation Method | Pass Criteria |
| :--- | :--- | :--- |
| **Backend Isolation** | Start `traffic-director-backend` on `:4005` with monolithic `:4002` stopped | All `/api/v1/traffic-director/*` endpoints respond with HTTP 200 |
| **Edge Redirection** | `GET http://localhost:4005/r/foodandme` | Returns 302 or safe page cloaked HTML |
| **Dynamic Script CDN** | `GET http://localhost:4005/tag/foodandme.js` | Returns valid JavaScript initializing Meta Pixels |
| **Server-Side CAPI** | `POST http://localhost:4005/pixel/event` | Dispatches conversion to Meta Graph API and stores log |
| **Frontend Integration** | Load `http://localhost:3006` with API on `:4005` | Zero console errors, all link tabs and metrics populate |
| **Automated Tests** | `run_all_tests.ts` | 27 of 27 test suites pass |
