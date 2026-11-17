import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';
import { Errors } from '../utils/errors.js';

export interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/** Validates + coerces req.body / req.query / req.params. Unknown keys are stripped by the schemas. */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const issues: Array<{ in: string; path: string; message: string }> = [];
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        for (const i of result.error.issues) {
          issues.push({ in: part, path: i.path.join('.'), message: i.message });
        }
      } else {
        (req as unknown as Record<string, unknown>)[part] = result.data;
      }
    }
    if (issues.length) return next(Errors.validation(issues));
    next();
  };
}
