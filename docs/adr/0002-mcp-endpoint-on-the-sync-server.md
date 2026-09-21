---
status: accepted
---

# One MCP endpoint on the sync server, guarded by a token

Claude Code, Claude Cowork and claude.ai should be able to read what is on today and create or change Tasks. All three speak MCP over Streamable HTTP to a URL, so the app grows one endpoint, `/api/mcp`, on the server it already has. The tools are written once (`server/tools.ts`) and the `brian` CLI is just another MCP client of the same URL, so a terminal, a chat and an agent can do exactly the same things and nothing more.

Writes do not go through a Device: the server builds the record with the same domain functions the app's store uses (`buildTask`, `applyPatch`) and inserts it into the rows table under the sync rule (newer `updatedAt` wins). To every Device it looks like a change made elsewhere, picked up on the next catch-up. Check-ins and un-checks are rows and tombstones like everywhere else.

Authentication is one long random token in `MCP_TOKEN`, accepted as a Bearer header or as the last path segment. The header form is what Claude Code and the connector UI's "Request headers" use; the path form exists because that UI section is gated (beta, limited organizations) and "No sign-in" with a secret URL is the fallback that works everywhere. Failures are throttled per address like login.

## Considered options

- **A local stdio MCP server that calls a REST API** — works for Claude Code only; chat and Cowork need a URL. Would also mean two surfaces (REST + MCP) to keep in step.
- **The MCP server as a client of `/api/sync`** — no server changes, but it would need the cookie login dance and would re-implement the store's rules to build a Task. Rejected: that is exactly the drift this ADR avoids.
- **OAuth 2.1 with dynamic client registration** — the connector UI's preferred path and the only one that gives per-user identity. Rejected for now: one user, one token; the token can be rotated in one place. Adding OAuth later is a change to `server/mcp.ts` only.
- **Sessions (`mcp-session-id`) and SSE** — the endpoint is stateless with plain JSON replies instead. Every request is independent, nothing to keep alive across Railway's proxy, and nothing to lose on redeploy.

## Consequences

- `src/domain/*` is imported by the server, so relative imports there carry `.ts` extensions and the Docker image ships `src/domain` and `src/lib`. The domain must stay free of UI and storage imports — it already had that rule.
- `TZ` on the server decides what "today" means for the tools; the app itself uses each Device's clock. Set it to where you live.
- The token is a capability: anyone holding it, or a URL containing it, has full read/write access. Treat it like the password. Rotating `MCP_TOKEN` disconnects every client at once.
- The tools can delete exactly what the app can: Tasks and Routines (permanently, as the Archive page does, Q28), Spaces (Tasks move to Personal, Q16) and Blocks. Each delete is a tombstone row, so it reaches every Device like any other change. The tool descriptions steer a client towards archiving unless the user asks to delete; the token grants the full set either way. (Amended 2026-09-21: the first version of this ADR kept deletion in the app only.)
