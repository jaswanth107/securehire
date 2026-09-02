export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

/**
 * The single message used for every resource-level denial.
 *
 * It is intentionally identical whether the resource does not exist or exists
 * but belongs to someone else, so that a caller cannot enumerate IDs by
 * comparing responses.
 */
export const FORBIDDEN_MESSAGE =
  'You do not have permission to access this resource.';

export const forbidden = (message: string = FORBIDDEN_MESSAGE) =>
  new ApiError('FORBIDDEN', message);

export const unauthenticated = (message = 'Authentication required.') =>
  new ApiError('UNAUTHENTICATED', message);

export const notFound = (message = 'Resource not found.') =>
  new ApiError('NOT_FOUND', message);

export const badRequest = (message: string, details?: unknown) =>
  new ApiError('BAD_REQUEST', message, details);

export const conflict = (message: string) => new ApiError('CONFLICT', message);
