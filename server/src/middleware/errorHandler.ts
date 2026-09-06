import type { NextFunction, Request, Response } from 'express'

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express requires the 4-arg signature to detect error middleware
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = (err as { status?: number })?.status ?? 500
  const message = err instanceof Error ? err.message : 'Internal server error'
  console.error(err)
  res.status(status).json({ error: message })
}
