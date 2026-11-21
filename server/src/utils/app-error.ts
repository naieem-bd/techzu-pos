/** An expected, client-facing error. The error handler turns it into `{ error: { code, message, details } }`. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    options?: ErrorOptions,
  ) {
    // `cause` keeps the underlying error for logs without exposing it to clients.
    super(message, options);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, details?: unknown): AppError =>
  new AppError(400, code, message, details);

export const notFound = (code: string, message: string, details?: unknown): AppError =>
  new AppError(404, code, message, details);

export const conflict = (code: string, message: string, details?: unknown): AppError =>
  new AppError(409, code, message, details);

export const unprocessable = (code: string, message: string, details?: unknown): AppError =>
  new AppError(422, code, message, details);
