import type { NextFunction, Request, Response } from 'express';

/** Нулевой байт PostgreSQL не принимает: вместо ошибки 500 на любом вводе — понятный ответ 400. */
export function rejectNulBytes(req: Request, res: Response, next: NextFunction): void {
  const inBody = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body) && JSON.stringify(req.body).includes('\\u0000');
  if (req.originalUrl.includes('%00') || inBody) {
    res.status(400).json({ code: 'VALIDATION', message: 'Input contains a null byte' });
    return;
  }
  next();
}
