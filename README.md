# 180 Traffic Director - Dedicated Project

Independent, high-performance edge traffic steering, bot shielding, dynamic tracking script CDN tag delivery, and Universal Meta Pixel / Server-Side CAPI Manager.

## Architecture

- **`apps/backend`**: Dedicated Node.js + Express edge engine running on port `4005`.
- **`apps/frontend`**: Dedicated Next.js 15 App Router management portal running on port `3006`.
- **`packages/traffic-director`**: Domain logic (Rule Engine, Geo-IP, Device Classifier, Bot Shield, CAPI Dispatcher).
- **`packages/db`**: Prisma ORM database layer connected to PostgreSQL.
- **`packages/ui`**: Tailored Shadcn UI / Tailwind component library.

## Quick Start

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Generate Prisma Client:
   ```bash
   pnpm --filter @workspace/db exec prisma generate
   ```

3. Run both Backend and Frontend:
   ```bash
   pnpm dev
   ```
   Or run individually:
   - Backend: `pnpm dev:backend` (port 4005)
   - Frontend: `pnpm dev:frontend` (port 3006)
