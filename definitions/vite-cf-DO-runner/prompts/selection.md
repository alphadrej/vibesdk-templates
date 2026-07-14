# Template Selection

Specialized single Durable Object (DO) app on Cloudflare Workers. Use this when the application needs direct DO capabilities; prefer the DO v2 runner for general multi-entity persistence.

Use when:
- You need server-side state with one global DO
- You need direct DO features such as alarms, WebSockets, or per-object coordination
- Real-time/stateful services and counters centered on one DO

Avoid when:
- Static/SPAs with no backend
- SEO/SSR landing pages
- You only need database-like storage across many entities (see DO v2 runner)
- General dashboards and multi-entity apps that only need persistence (use DO v2)

Built with:
- React Router, ShadCN UI, Tailwind, Lucide Icons, ESLint, Vite
- Cloudflare Workers + single DO for persistence

