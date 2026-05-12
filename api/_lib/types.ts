// Minimal shape of the Vercel Node serverless request/response. We don't
// import @vercel/node because it would add a dependency for what is, in
// practice, an extended IncomingMessage / ServerResponse. The runtime
// provides the real objects with these fields populated.

import type { IncomingMessage, ServerResponse } from 'node:http';

export interface VercelRequest extends IncomingMessage {
  query: Partial<Record<string, string | string[]>>;
  body?: unknown;
}

export interface VercelResponse extends ServerResponse {
  status(code: number): VercelResponse;
  send(body: string | Buffer | object): VercelResponse;
  json(body: unknown): VercelResponse;
}
