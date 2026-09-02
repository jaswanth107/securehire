import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ApiError } from '../lib/errors.js';

type Source = 'body' | 'params' | 'query';

export function validate(schema: ZodTypeAny, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      if (source === 'body') req.body = parsed;
      else if (source === 'params') Object.assign(req.params, parsed);
      else Object.assign(req.query as Record<string, unknown>, parsed);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new ApiError(
            'VALIDATION_ERROR',
            'The request payload is invalid.',
            error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          ),
        );
        return;
      }
      next(error);
    }
  };
}
