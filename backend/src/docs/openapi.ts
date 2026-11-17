import { z } from 'zod';
import { COMMON_ERROR_CODES } from '../utils/errors.js';
import { allRoutes } from '../routes/index.js';
import type { RouteDef } from '../routes/registry.js';

type Json = Record<string, any>;

export function toJsonSchema(schema: z.ZodType | undefined): Json | undefined {
  if (!schema) return undefined;
  try {
    const js = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any', target: 'draft-7' }) as Json;
    delete js.$schema;
    return js;
  } catch {
    return { type: 'object' };
  }
}

const openApiPath = (p: string) => p.replace(/:([A-Za-z]+)/g, '{$1}');

function parameters(def: RouteDef): Json[] {
  const out: Json[] = [];
  for (const [where, schema] of [
    ['path', def.params],
    ['query', def.query],
  ] as const) {
    const js = toJsonSchema(schema);
    if (!js?.properties) continue;
    for (const [name, prop] of Object.entries<Json>(js.properties)) {
      out.push({ name, in: where, required: where === 'path' || (js.required ?? []).includes(name), schema: prop });
    }
  }
  return out;
}

export function buildOpenApi(serverUrl = '/api/v1'): Json {
  const paths: Json = {};
  for (const def of allRoutes) {
    const op: Json = {
      tags: [def.tag],
      summary: def.summary,
      description: `**Success data:** ${def.response}\n\n**Domain error codes:** ${def.errors.length ? def.errors.join(', ') : 'none'}`,
      operationId: `${def.method}_${def.path.replace(/[/:]+/g, '_')}`,
      security: def.auth === 'none' ? [] : [{ bearerAuth: [] }],
      parameters: parameters(def),
      responses: {
        [String(def.status)]: { description: def.response, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
        400: { description: 'VALIDATION_ERROR', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        ...(def.auth !== 'none' ? { 401: { description: 'UNAUTHORIZED / TOKEN_EXPIRED / INVALID_TOKEN', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } : {}),
        ...(def.errors.length ? { '409': { description: def.errors.join(', '), content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } } : {}),
        429: { description: 'RATE_LIMITED', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    };
    const body = toJsonSchema(def.body);
    if (body) op.requestBody = { required: true, content: { 'application/json': { schema: body } } };
    if (!op.parameters.length) delete op.parameters;
    const p = openApiPath(def.path);
    (paths[p] ??= {})[def.method] = op;
  }
  return {
    openapi: '3.0.3',
    info: {
      title: 'Tic Tac Toe API',
      version: '1.0.0',
      description:
        'Server-authoritative Tic Tac Toe backend. All responses use the envelope `{ success, data, meta? }` or `{ success: false, error: { code, message, details? } }`.\n\nReal-time events: see docs/SOCKET_EVENTS.md.\n\nCommon error codes: ' +
        COMMON_ERROR_CODES.join(', '),
    },
    servers: [{ url: serverUrl }],
    tags: [...new Set(allRoutes.map((r) => r.tag))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Success: { type: 'object', properties: { success: { type: 'boolean', example: true }, data: {}, meta: { type: 'object' } } },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} } },
            requestId: { type: 'string' },
          },
        },
      },
    },
  };
}
