/**
 * Temporary bridge type for the paginated list endpoint response shape `{ total, items }`.
 *
 * @deprecated Replace with the native SDK type once `@map-colonies/jobnik-sdk` is updated
 * to reflect the spec introduced in PR #263 (feat: add pagination support to all list endpoints).
 * At that point:
 *  - Remove this file
 *  - Remove all `as unknown as PaginatedResponse<...>` casts in the test files
 *  - Remove all `as any` casts on `query: { page_size, page }` params
 */
export type PaginatedResponse<TData> = { readonly total: number; readonly items: TData };
