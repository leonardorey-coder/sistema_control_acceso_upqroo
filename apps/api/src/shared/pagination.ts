import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export type Pagination = z.infer<typeof paginationQuerySchema> & {
  offset: number;
};

export type PaginatedResult<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  summary?: Record<string, unknown>;
};

export function parsePagination(input: Record<string, string | string[] | undefined>): Pagination {
  const pagination = paginationQuerySchema.parse(input);
  return {
    ...pagination,
    offset: (pagination.page - 1) * pagination.pageSize
  };
}

export function paginated<T>(
  rows: T[],
  total: number,
  pagination: Pick<Pagination, "page" | "pageSize">,
  summary?: Record<string, unknown>
): PaginatedResult<T> {
  return {
    rows,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    ...(summary ? { summary } : {})
  };
}
