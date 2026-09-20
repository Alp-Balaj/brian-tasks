// The MCP endpoint: how Claude Code, Cowork and claude.ai reach Brian. Streamable
// HTTP, stateless (a fresh McpServer per request, plain JSON replies), guarded by
// one long random token. The token is accepted as a Bearer header or, for
// connector UIs that cannot set headers, as the last path segment.
import { timingSafeEqual } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPTransport } from '@hono/mcp'
import { loginAllowed, noteFailure } from './auth.ts'
import type { Records } from './records.ts'
import { INSTRUCTIONS, registerTools } from './tools.ts'

export function mcpApp(records: Records): Hono {
  const app = new Hono()

  const handle = async (c: Context, given: string | undefined): Promise<Response> => {
    const expected = process.env.MCP_TOKEN
    if (!expected) return c.text('MCP_TOKEN is not set on the server', 503)
    const address = c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'local'
    if (!loginAllowed(address)) return c.text('Too many attempts, try again in a minute', 429)
    if (!given || !same(given, expected)) {
      noteFailure(address)
      return c.text('Unauthorized', 401, { 'www-authenticate': 'Bearer' })
    }

    const server = new McpServer({ name: 'brian-tasks', version: '1.0.0' }, { instructions: INSTRUCTIONS })
    registerTools(server, records)
    const transport = new StreamableHTTPTransport({ enableJsonResponse: true })
    await server.connect(transport)
    try {
      return (await transport.handleRequest(c)) ?? c.body(null, 204)
    } finally {
      await server.close().catch(() => {})
    }
  }

  app.all('/', (c) => handle(c, bearer(c)))
  app.all('/:token', (c) => handle(c, bearer(c) ?? c.req.param('token')))
  return app
}

const bearer = (c: Context): string | undefined => c.req.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]

const same = (a: string, b: string): boolean => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
