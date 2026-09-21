import type { ApiEnvelope } from "@shared/types";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

export function jsonOk<T>(data: T, init: ResponseInit = {}): Response {
  const body: ApiEnvelope<T> = { ok: true, data };
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers ?? {}) }
  });
}

export function jsonError(code: string, message: string, status = 400, extraHeaders?: HeadersInit): Response {
  const body: ApiEnvelope<never> = { ok: false, error: { code, message } };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...(extraHeaders ?? {}) }
  });
}

export class ApiHttpError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
