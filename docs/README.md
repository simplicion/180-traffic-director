# Traffic Director Technical Documentation & Specifications

Welcome to the engineering and architectural documentation for **180 Traffic Director** — the sub-5ms edge bot mitigation, ad review cloaking, smart dynamic routing, and traffic intelligence engine.

---

## Technical Specifications (`docs/specifications/`)

1. **[180 Traffic Director Overview](specifications/01-overview.md)**: System topology, core edge routing mechanics, and multi-tenant security architecture.
2. **[Edge Evaluator Proxy & Routing Engine](specifications/02-edge-evaluator-proxy.md)**: Cloudflare Worker sub-5ms routing, reverse-proxy streaming, and instant header evaluation.
3. **[Threat Intelligence & Bot Defense](specifications/03-threat-intelligence-and-bot-defense.md)**: Automated ad reviewer detection (Meta, Google, TikTok), heuristic IP scoring, behavioral honeypots, and fingerprint analysis.
4. **[Ads Attribution & Dynamic Macro Interpolation](specifications/04-ads-attribution-and-macros.md)**: Dynamic macro injection, URL parameter persistence, and closed-loop conversion tracking.

---

## Architectural Blueprints & Research
- [Traffic Director Architecture Blueprint](traffic-director-architecture.md)
- [Edge Evaluator Proxy Architecture](edge-evaluator-proxy-architecture.md)
- [Threat Intelligence Deep Specification](threat-intelligence-specification.md)
- [Cloaking Superiority Matrix](cloaking-superiority-matrix.md)
- [Web Cloaking Research](web-cloaking-research.md)
- [Standalone Architecture Plan](traffic_director_standalone_plan.md)
- [Universal Pixel & Dedicated Domain Plan](traffic_director_pixel_and_dedicated_domain_plan.md)

---

## Future Implementations (`docs/future-implementations/`)
- Dynamic Macro Interpolation
- Cloudflare Edge Worker Gateway
- Rule Click Caps & Spillover
- Client-Side Behavioral Honeypot
- Universal Meta Pixel & Dedicated Domains

