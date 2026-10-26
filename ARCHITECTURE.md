# 180 Traffic Director - System Architecture Specification

## Overview

**180 Traffic Director** is an ultra-low latency, high-performance edge traffic steering, anti-bot cloaking, and Universal Meta Pixel / Server-Side Conversions API (CAPI) management platform.

```
                              [ Incoming Visitor ]
                                       ¦
                                       ?
                   +----------------------------------------+
                   ¦    180 Traffic Director Edge Engine    ¦
                   ¦           (Node.js / Express)          ¦
                   +----------------------------------------+
                                       ¦
                 +-------------------------------------------+
                 ¦ Multi-Variable Signal Extraction (0ms)    ¦
                 ¦  - Hardware GPU Renderer (SwiftShader)    ¦
                 ¦  - Datacenter ASN Blocklist (AWS/GCP/Meta)¦
                 ¦  - Timezone Delta / VPN Heuristics        ¦
                 ¦  - Tor Exit Node Dynamic Sync             ¦
                 +-------------------------------------------+
                                       ¦
                   +---------------------------------------+
                   ?                                       ?
        [ Bot / Spy / Datacenter ]                [ Clean Target Visitor ]
                   ¦                                       ¦
                   ?                                       ?
           Safe Page / Cloak                     Money Page / Offer URL
                   ¦                                       ¦
                   +---------------------------------------+
                                       ?
                   +---------------------------------------+
                   ¦ Universal Meta Pixel & CAPI Manager   ¦
                   ¦  - Master + Backup Pixel Dispatcher   ¦
                   ¦  - Client Deduplication Hash (SHA256) ¦
                   ¦  - Server-to-Server CAPI Beacon Ingest¦
                   +---------------------------------------+
```

---

## Core Pillars

### 1. Edge Decision Engine (`/evaluate/:slug`)
- Multi-signal extraction evaluates browser fingerprint, hardware concurrency, touch points, WebGL renderer, and ASN provider.
- Sub-millisecond evaluation latency with distributed in-memory cache.
- Stealth Ramp-up algorithm (gradual warmup prevents Meta/Google automated ban cliffs).

### 2. Universal Meta Pixel & Server-Side CAPI (`/pixel/event`)
- Single JavaScript snippet (`/tag/:slug.js`) deployed once across client websites.
- Master Pixel failover: If ad account bans occur, traffic instantly fails over to secondary/backup Pixel IDs with zero website code edits.
- Automatic server-side deduplication via cryptographic `eventId` matching.

### 3. Threat Intelligence & Bot Shield (`/threats`)
- Centralized blacklist of datacenter ASNs (Meta, ByteDance, Google, AWS, DigitalOcean, Hetzner).
- Real-time synchronization with official Tor exit node registries.
- Custom corporate IP, CIDR, and user-agent blocklists.

### 4. Telemetry & Analytics (`/overview`, `/logs`)
- Cursor-paginated event stream with click-level forensic telemetry.
- Country, device, browser, and OS aggregation matrices.
