# 180 Traffic Director - Strategic Product Roadmap

## Phase 1: Standalone Spin-Off & Core Decoupling (Completed ?)
- [x] Dedicated edge backend engine (`apps/backend` on port `4005`).
- [x] Dedicated Next.js 15 App Router management frontend (`apps/frontend`).
- [x] Prisma database client isolation with RDS PostgreSQL connection.
- [x] 58/58 Automated live endpoint assertions passed.
- [x] 10/10 Frontend management views verified.

## Phase 2: Universal Meta Pixel & Multi-Pixel CAPI Manager (In Progress ??)
- [x] One-snippet tag injection generator (`/tag/:slug.js`).
- [x] Multi-pixel failover array (`masterPixelId`, `backupPixelIds`).
- [x] Server-side beacon ingestion (`/pixel/event`).
- [x] Client/Server deduplication engine.
- [ ] Automated Meta Graph API token health monitor & expiry alerting.
- [ ] TikTok Events API and Google Ads Enhanced Conversions gateway.

## Phase 3: Cloudflare Edge Workers & Global Anycast Distribution
- [ ] Cloudflare Worker edge proxy gateway for sub-5ms global redirects.
- [ ] Automated DNS CNAME verification for custom vanity domains.
- [ ] Dynamic SSL wildcard certificate provisioning via Let's Encrypt / Cloudflare for SaaS.

## Phase 4: Advanced Machine Learning Bot Sentinel
- [ ] Behavioral mouse velocity and micro-jitter analysis.
- [ ] IP reputation score integration with fraud intelligence feeds.
- [ ] Automated safe-page mirror caching with reverse proxy streaming.
