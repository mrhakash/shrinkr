export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export const Errors = {
  unauthorized: (msg = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', msg),
  forbidden: (msg = 'Not allowed') => new AppError(403, 'FORBIDDEN', msg),
  gone: (msg = 'Gone') => new AppError(410, 'GONE', msg),
  notFound: (msg = 'Not found') => new AppError(404, 'NOT_FOUND', msg),
  badRequest: (msg = 'Invalid request') => new AppError(400, 'BAD_REQUEST', msg),
  conflict: (msg = 'Already exists') => new AppError(409, 'CONFLICT', msg),
  quotaExceeded: (msg = 'Plan quota exceeded') => new AppError(402, 'QUOTA_EXCEEDED', msg),
  tooMany: (msg = 'Too many requests') => new AppError(429, 'RATE_LIMITED', msg),
};
