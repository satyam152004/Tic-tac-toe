import { z } from 'zod';

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class Paged<T> {
  constructor(
    public readonly items: T[],
    public readonly meta: PageMeta,
  ) {}
}

export function paged<T>(items: T[], total: number, q: { page: number; limit: number }): Paged<T> {
  return new Paged(items, { page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) });
}

export const skipOf = (q: { page: number; limit: number }): number => (q.page - 1) * q.limit;
