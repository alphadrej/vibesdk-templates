# Template Selection

Default persistence template for general multi-entity applications on Cloudflare Workers. It uses one Durable Object (DO) as the storage backend, wrapped so multiple entities (users, chats, orgs, etc.) can persist data via simple APIs.

Use when:
- Backend-heavy apps with multiple entities and server-side persistence
- Chats, ecommerce, dashboards
- Cost-effective persistence without KV
- General purpose storage for any multi-entity data
- The app needs persistence and does not require direct DO-specific capabilities

Avoid when:
- Static/SPAs with no backend
- SEO/SSR landing pages
- You need SSR or DO features like alarms/direct DO access

Note: No direct DO access. DO is storage-only; no alarms or extra DO features.

Built with:
- React Router, ShadCN UI, Tailwind, Lucide Icons, ESLint, Vite
- Cloudflare Workers + a single DO for persistence

