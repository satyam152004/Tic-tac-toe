/**
 * Generates docs/API.md from the same route table that drives Express and the OpenAPI document.
 * Run: npm run docs:api
 */
process.env.NODE_ENV ??= 'development';
process.env.JWT_ACCESS_SECRET ??= 'docs-generation-secret-docs-generation-secret';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RouteDef } from '../src/routes/registry.js';

// Dynamic imports: env must be set before config/env.ts is evaluated (static imports are hoisted).
const { EXAMPLES } = await import('../src/docs/examples.js');
const { toJsonSchema } = await import('../src/docs/openapi.js');
const { allRoutes } = await import('../src/routes/index.js');

type Js = Record<string, any>;

const NAME_HINTS: Record<string, unknown> = {
  email: 'player@example.com',
  password: 'Passw0rdOK',
  newPassword: 'N3wPassw0rd',
  currentPassword: 'Passw0rdOK',
  username: 'player_one',
  displayName: 'Player One',
  refreshToken: '<refreshToken>',
  idToken: '<google-id-token>',
  identityToken: '<apple-identity-token>',
  token: '<token-from-email>',
  code: 'K7M3QX',
  q: 'play',
  clientMoveId: '3f2b9c1e-6a4d-4c77-9a53-0e1d8f2b7c11',
  clientMatchId: 'local-9d1f2c3a-0001',
};

function sample(schema: Js | undefined, name = ''): unknown {
  if (!schema) return {};
  if ('const' in schema) return schema.const;
  if (schema.enum) return schema.enum[0];
  if (schema.default !== undefined && name !== 'boardSize') return schema.default;
  if (name in NAME_HINTS) return NAME_HINTS[name];
  const alt = schema.anyOf ?? schema.oneOf;
  if (alt) return sample(alt[0], name);
  if (schema.allOf) return Object.assign({}, ...schema.allOf.map((s: Js) => sample(s, name)));
  switch (schema.type) {
    case 'string':
      if (schema.pattern?.includes('0-9a-fA-F]{24')) return '665f1c2e8b3a4c0012345678';
      if (schema.format === 'email') return 'player@example.com';
      if (name === 'platform') return 'android';
      return `<${name || 'string'}>`;
    case 'integer':
    case 'number':
      if (name === 'boardSize') return 3;
      if (name === 'position') return 4;
      return schema.minimum ?? 1;
    case 'boolean':
      return true;
    case 'array':
      return [sample(schema.items, name)];
    case 'object': {
      const out: Record<string, unknown> = {};
      const req: string[] = schema.required ?? [];
      for (const [k, v] of Object.entries<Js>(schema.properties ?? {})) if (req.includes(k)) out[k] = sample(v, k);
      return out;
    }
    default:
      return {};
  }
}

function typeOf(p: Js): string {
  if (p.const !== undefined) return JSON.stringify(p.const);
  if (p.enum) return p.enum.map((e: unknown) => JSON.stringify(e)).join(' \\| ');
  const alt = p.anyOf ?? p.oneOf;
  if (alt) return alt.map(typeOf).join(' \\| ');
  if (p.type === 'array') return `${typeOf(p.items ?? {})}[]`;
  return p.type ?? 'any';
}

function constraints(p: Js): string {
  const c: string[] = [];
  if (p.minLength !== undefined) c.push(`min length ${p.minLength}`);
  if (p.maxLength !== undefined) c.push(`max length ${p.maxLength}`);
  if (p.minimum !== undefined) c.push(`min ${p.minimum}`);
  if (p.maximum !== undefined) c.push(`max ${p.maximum}`);
  if (p.minItems !== undefined) c.push(`min items ${p.minItems}`);
  if (p.maxItems !== undefined) c.push(`max items ${p.maxItems}`);
  if (p.pattern) c.push(`pattern \`${String(p.pattern).replace(/\|/g, '\\|')}\``);
  if (p.format) c.push(`format ${p.format}`);
  if (p.default !== undefined) c.push(`default \`${JSON.stringify(p.default)}\``);
  if (p.description) c.push(p.description);
  return c.join('; ') || '-';
}

function table(schema: Js | undefined, title: string): string {
  const flat = (schema?.oneOf ?? schema?.anyOf) as Js[] | undefined;
  if (flat) {
    return `**${title}** (one of):\n\n` + flat.map((s, i) => `_Variant ${i + 1}_\n\n${table(s, title)}`).join('\n');
  }
  if (!schema?.properties) return '';
  const req: string[] = schema.required ?? [];
  const rows = Object.entries<Js>(schema.properties).map(([k, v]) => `| \`${k}\` | ${typeOf(v)} | ${req.includes(k) ? 'yes' : 'no'} | ${constraints(v)} |`);
  return `**${title}**\n\n| Field | Type | Required | Validation |\n|---|---|---|---|\n${rows.join('\n')}\n`;
}

function curl(d: RouteDef, body: unknown, query: Js | undefined): string {
  const q = query?.properties
    ? '?' +
      Object.entries<Js>(query.properties)
        .filter(([k]) => (query.required ?? []).includes(k))
        .map(([k, v]) => `${k}=${encodeURIComponent(String(sample(v, k)))}`)
        .join('&')
    : '';
  const path = d.path.replace(/:([A-Za-z]+)/g, '<$1>');
  const parts = [`curl -X ${d.method.toUpperCase()} "$API_URL/api/v1${path}${q === '?' ? '' : q}"`];
  if (d.auth !== 'none') parts.push('-H "Authorization: Bearer $ACCESS_TOKEN"');
  if (body !== undefined) parts.push('-H "Content-Type: application/json"', `-d '${JSON.stringify(body)}'`);
  return parts.join(' \\\n  ');
}

const STATUS_FOR_AUTH = (d: RouteDef) => (d.auth === 'none' ? [] : ['401 UNAUTHORIZED | TOKEN_EXPIRED | INVALID_TOKEN']);

let md = `# REST API reference

> Generated by \`npm run docs:api\` from the route table in \`src/routes\` (the same table that drives the Express
> routes and the Swagger UI at \`/api/docs\`). Do not edit by hand.

**Base URL:** \`$API_URL/api/v1\` &nbsp; **Content type:** \`application/json\` &nbsp; **Auth:** \`Authorization: Bearer <accessToken>\`

## Conventions

Success: \`{ "success": true, "data": <payload>, "meta": { ... } }\` (\`meta\` only for paginated lists: \`page, limit, total, totalPages\` plus endpoint extras).

Error: \`{ "success": false, "error": { "code": "CELL_OCCUPIED", "message": "...", "details": [...]? }, "requestId": "..." }\`

| HTTP | Meaning | Typical codes |
|---|---|---|
| 400 | Validation / malformed input | \`VALIDATION_ERROR\` (details: \`[{in, path, message}]\`), \`INVALID_JSON\`, \`INVALID_BOARD_CONFIG\`, \`CELL_OUT_OF_RANGE\` |
| 401 | Missing/invalid/expired credentials | \`UNAUTHORIZED\`, \`INVALID_TOKEN\`, \`TOKEN_EXPIRED\`, \`INVALID_CREDENTIALS\`, \`INVALID_REFRESH_TOKEN\`, \`REFRESH_TOKEN_EXPIRED\`, \`REFRESH_TOKEN_REUSED\` |
| 403 | Authenticated but not allowed | \`FORBIDDEN\`, \`NOT_A_PLAYER\`, \`NOT_IN_ROOM\`, \`NOT_HOST\`, \`NOT_FRIENDS\`, \`BLOCKED\`, \`REGISTERED_ACCOUNT_REQUIRED\` |
| 404 | Not found | \`NOT_FOUND\`, \`ROUTE_NOT_FOUND\`, \`GAME_NOT_FOUND\`, \`ROOM_NOT_FOUND\`, \`USER_NOT_FOUND\` |
| 409 | State conflict | \`NOT_YOUR_TURN\`, \`CELL_OCCUPIED\`, \`MOVE_CONFLICT\`, \`GAME_NOT_ACTIVE\`, \`ALREADY_IN_GAME\`, \`ROOM_FULL\`, \`EMAIL_TAKEN\`, \`USERNAME_TAKEN\`, \`DUPLICATE\` |
| 410 | Gone | \`ROOM_EXPIRED\` |
| 429 | Rate limited | \`RATE_LIMITED\` |
| 503 | Dependency down / feature not configured | \`UNHEALTHY\`, \`PROVIDER_NOT_CONFIGURED\` |

Pagination query (all list endpoints): \`?page=1&limit=20\` (limit max 100).

Auth levels: **public** (no token), **user** (any valid access token, guests included), **registered** (non-guest only).

## Index

| Method | Path | Auth | Summary |
|---|---|---|---|
${allRoutes.map((d) => `| ${d.method.toUpperCase()} | \`/api/v1${d.path}\` | ${d.auth === 'none' ? 'public' : d.auth} | ${d.summary} |`).join('\n')}

`;

for (const tag of [...new Set(allRoutes.map((r) => r.tag))]) {
  md += `\n---\n\n## ${tag}\n`;
  for (const d of allRoutes.filter((r) => r.tag === tag)) {
    const body = toJsonSchema(d.body);
    const query = toJsonSchema(d.query);
    const params = toJsonSchema(d.params);
    const key = `${d.method.toUpperCase()} ${d.path}`;
    const reqBody = body ? sample(body) : undefined;
    const example = EXAMPLES[key];
    md += `\n### ${d.method.toUpperCase()} \`/api/v1${d.path}\`\n\n${d.summary}\n\n- **HTTP method:** ${d.method.toUpperCase()}\n- **Authentication:** ${d.auth === 'none' ? 'none (public)' : d.auth === 'registered' ? 'Bearer access token, registered accounts only' : 'Bearer access token'}\n- **Success status:** ${d.status}\n${d.strictLimit ? '- **Rate limit:** strict (credential endpoint limiter)\n' : ''}\n`;
    const t = [table(params, 'Path parameters'), table(query, 'Query parameters'), table(body, 'Request body')].filter(Boolean);
    md += t.length ? t.join('\n') + '\n' : '_No parameters or body._\n\n';
    md += `**Response** \`${d.status}\`: ${d.response}\n\n`;
    md += `**Errors:** ${[...(d.body || d.query || d.params ? ['400 VALIDATION_ERROR'] : []), ...STATUS_FOR_AUTH(d), ...d.errors.map((e) => `domain \`${e}\``), '429 RATE_LIMITED'].join(', ')}\n\n`;
    md += `**Example request**\n\n\`\`\`bash\n${curl(d, reqBody, query)}\n\`\`\`\n\n`;
    const envelope = example !== undefined && Array.isArray(example) ? { success: true, data: example, meta: { page: 1, limit: 20, total: example.length, totalPages: 1 } } : { success: true, data: example ?? `<${d.response}>` };
    // Keep arrays of primitives (boards, lines) on one line so the examples stay readable.
    const prim = '(?:"[^"\\n]*"|-?\\d+(?:\\.\\d+)?|null|true|false)';
    const inlineArrays = new RegExp(`\\[\\s*(${prim}(?:,\\s*${prim})*)\\s*\\]`, 'g');
    const pretty = JSON.stringify(envelope, null, 2).replace(inlineArrays, (_m, inner: string) => `[${inner.replace(/,\s+/g, ', ')}]`);
    md += `**Example response** \`${d.status}\`\n\n\`\`\`json\n${pretty}\n\`\`\`\n`;
  }
}

mkdirSync(dirname('docs/API.md'), { recursive: true });
writeFileSync('docs/API.md', md);
console.log(`docs/API.md written (${allRoutes.length} endpoints)`);
process.exit(0);
