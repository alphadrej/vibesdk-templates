# Usage Instructions

You can start customizing the template frontend by modifying `src/pages/HomePage.tsx`. The page auto-updates as you edit the file.

The chat API is powered by Cloudflare Agents (Which is a wrapper on Durable Objects) and accessible through the worker at `/api/chat/:sessionId/*` routes defined in `worker/userRoutes.ts`. **Use it!**

The agent system uses Durable Objects for persistent state management and conversation history. `/api/chat/:sessionId/*` should be used without modifications for any conversation support. There is also a control plane durable object for session management name AppController.

AI credentials are bring-your-own-key (BYOK). When building an AI feature, request the user's own provider key through Lumaveno's secret/request-secrets mechanism with the exact secret name `OPENAI_API_KEY`; the worker receives it as `env.OPENAI_API_KEY`. Never use Lumaveno credits or expect a platform-provided AI key. The template defaults to OpenAI, and `OPENAI_BASE_URL` can optionally select an OpenAI-compatible provider.

Every AI request is billed to the app-builder's own provider key. Before exposing AI publicly, add authentication and production-appropriate rate limiting. As safe defaults, this template accepts only the models in `shared/models.ts`, caps each OpenAI completion at 2,048 output tokens, and allows 10 chat requests per 60 seconds per session using the existing `CHAT_AGENT` Durable Object state. Extend or tighten these application-level controls without adding bindings or editing `wrangler.jsonc`/`wrangler.toml`.

The app must remain usable before the secret is added. Keep or build a clear no-key banner/empty state, disable only the AI-dependent controls, and render the worker error `AI not configured - add your OPENAI_API_KEY secret` instead of crashing or returning a generic failure.

- Built with:
  * **React + Vite** for fast frontend development with hot module replacement
  * **Cloudflare Agents SDK** for stateful agent management with persistent Durable Objects
  * **Model Context Protocol (MCP)** client for real server integration
  * **OpenAI SDK** for AI model integration with the user's own provider credentials
  * **Production MCP Servers** including Cloudflare Bindings and Observability
  * **Tailwind CSS** for utility-first styling with semantic theme tokens
  * **Framer Motion** for smooth chat animations and loading states
  * **Lucide Icons** (React) for modern, consistent iconography
  * **Shadcn/UI** (v2.3.0) for accessible chat components built on Radix UI primitives
  * **TypeScript** for type safety and extensible architecture
  * **Durable Objects** for control plane for database or session management

- Agent Features:
  * **Real MCP Integration**: Connects to actual MCP servers, not simulated implementations
  * **Cloudflare MCP Servers**: Direct integration with Cloudflare Bindings and Observability servers
  * **Intelligent Tool Usage**: AI automatically detects when to use tools (D1, R2, Workers, Web browsing)
  * **Multi-Model Support**: Switch between various models
  * **Production Tools**: Query D1 databases, manage R2 buckets, get Worker analytics
  * **Web Browsing**: Browse and extract content from web pages through MCP server
  * **Persistent Conversations**: Maintains chat history using Durable Objects state in Cloudflare Agents.
  * **Tool Visualization**: Shows which tools were used with results in the chat interface

- Adding New MCP Servers:
  * **Step 1**: Add server configuration to `initializeCloudflareServers()` in `worker/mcp-client.ts`
  * **Step 2**: Tools are automatically discovered and registered from MCP server definitions
  * **Step 3**: The system automatically routes tool calls to appropriate MCP servers
  * **Real Protocol**: Uses actual MCP protocol for server communication, not simulation

- Environment Variables:
  * **OPENAI_API_KEY**: User-provided secret required to enable AI features; request it through Lumaveno's secret/request-secrets mechanism and read it only as `env.OPENAI_API_KEY` in the worker
  * **OPENAI_BASE_URL**: Optional OpenAI-compatible provider base URL; defaults to `https://api.openai.com/v1` when unset
  * **CHAT_AGENT**: Durable Object binding name for agent persistence

- Restrictions:
  * **BYOK only**: AI features must use the user's own `OPENAI_API_KEY`; never use a Lumaveno-provided key or Lumaveno credits
  * **Graceful no-key state**: Keep non-AI features working and show clear setup guidance until `OPENAI_API_KEY` is added
  * **API keys**: Never expose API keys to client-side - they're server-side only in worker
  * **Tool Safety**: Tool functions should validate inputs and handle errors gracefully
  * **Use Agents SDK patterns**: Extend Agent class, use setState for persistence

- Styling:
  * Must generate **fully responsive** and beautiful UI with agent-focused design
  * Use Shadcn preinstalled components rather than writing custom ones when possible
  * Use **Tailwind's spacing, layout, and typography utilities** for all components
  * Include tool interaction indicators and loading states for better UX

- Components:
  * All Shadcn components are available and can be imported from `@/components/ui/...`
  * Current chat uses: `Button`, `Input`, `Card`, `Select`, `Badge` for the interface
  * Tool results are displayed with badges and icons from the UI library
  * Do not write custom components if shadcn components are available
  * Icons from Lucide should be imported directly from `lucide-react`

- Animation:
  * Use `framer-motion`'s `motion` components for chat message animations
  * Animate tool usage indicators, model selection, and loading states
  * You can integrate variants and transitions using Tailwind utility classes alongside motion props

- Worker Architecture (Backend, APIs):
  * **`worker/agent.ts`**: Main agent class 
  * **`worker/userRoutes.ts`**: HTTP routing for agent API and session managementå
  * **`worker/chat.ts`**: OpenAI integration and conversation logic  
  * **`worker/mcp-client.ts`**: MCP client for real server integration
  * **`worker/tools.ts`**: Tool routing and MCP server coordination
  * **`worker/config.ts`**: Centralized configuration
  * **`worker/types.ts`**: TypeScript interfaces and type definitions
  * **`worker/app-controller.ts`**: Control plane durable object for session management

---

# Important Notes
- Conversations and persistence are already handled by the template. Utilize existing utilities and apis to build something greater.
- For example, to build a chatgpt clone - You just need to build the frontend and use existing APIs without modifying them.

# Available bindings:
**Only The following bindings are to be used in the project! Do not use any other bindings or remove/replace any of the bindings**
- `CHAT_AGENT`: A durable object binding for the chat agent, but can be extended and used for other agentic purposes
- `APP_CONTROLLER`: A durable object binding for the app controller, but can be extended and used for other agentic purposes
**IMPORTANT: You are NOT ALLOWED to edit/add/remove ANY worker bindings OR touch wrangler.jsonc/wrangler.toml. Build your application around what is already provided.**

---

## Routing (CRITICAL)

Uses `createBrowserRouter` - do NOT switch to `BrowserRouter`/`HashRouter`.

If you switch routers, `RouteErrorBoundary`/`useRouteError()` will not work (you'll get a router configuration error screen instead of proper route error handling).

**Add routes in `src/main.tsx`:**
```tsx
const router = createBrowserRouter([
  { path: "/", element: <HomePage />, errorElement: <RouteErrorBoundary /> },
  { path: "/new", element: <NewPage />, errorElement: <RouteErrorBoundary /> },
]);
```

**Navigation:** `import { Link } from 'react-router-dom'` then `<Link to="/new">New</Link>`

**Don't:**
- Use `BrowserRouter`, `HashRouter`, `MemoryRouter`
- Remove `errorElement` from routes
- Use `useRouteError()` in your components

## UI Components
All ShadCN components are in `./src/components/ui/*`. Import and use them directly:
```tsx
import { Button } from "@/components/ui/button";
```
**Do not rewrite these components.**
