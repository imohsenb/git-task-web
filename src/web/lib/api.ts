import type { CliError, CliErrorKind, CliWarning } from "../../shared/contract";

export interface ApiSuccess<T> {
  data: T;
  warnings: CliWarning[];
}

interface ApiErrorBody {
  ok: false;
  error: CliError;
}

export class ApiError extends Error {
  readonly status: number;
  readonly kind: CliErrorKind | "unknown";
  readonly causes: string[];
  readonly context?: Record<string, string | string[]>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = "ApiError";
    this.status = status;
    this.kind = body.error.kind;
    this.causes = body.error.causes ?? [];
    this.context = body.error.context;
  }
}

export type QueryParams = Record<string, string | boolean | undefined>;

/** Mirrors the server's LsFilters (src/server/gitTask/commands.ts) — the query-param
 * shape both `/api/repos/:name/tasks` and `/api/tasks` accept. */
export interface LsFilters {
  status?: string;
  assignee?: string;
  label?: string;
  kind?: string;
  parent?: string;
  mine?: boolean;
  deleted?: boolean;
  withHistory?: boolean;
  [key: string]: string | boolean | undefined;
}

function buildQuery(params?: QueryParams): string {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    usp.set(key, typeof value === "boolean" ? String(value) : value);
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

async function parseBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiGet<T>(path: string, params?: QueryParams): Promise<ApiSuccess<T>> {
  const res = await fetch(`/api${path}${buildQuery(params)}`, {
    headers: { Accept: "application/json" },
  });
  const body = await parseBody(res);

  if (!res.ok) {
    if (body && typeof body === "object" && "error" in body) {
      throw new ApiError(res.status, body as ApiErrorBody);
    }
    throw new ApiError(res.status, {
      ok: false,
      error: { kind: "internal", message: `request failed with status ${res.status}`, causes: [] },
    });
  }

  return body as ApiSuccess<T>;
}

/** Shared by every write helper below. A 204 (e.g. `edit`/`epic rm` with nothing to
 * change — §3.5) resolves to `null`, distinct from a real ApiSuccess<T>. */
async function apiWrite<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  params?: QueryParams,
): Promise<ApiSuccess<T> | null> {
  const res = await fetch(`/api${path}${buildQuery(params)}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  const parsedBody = await parseBody(res);

  if (!res.ok) {
    if (parsedBody && typeof parsedBody === "object" && "error" in parsedBody) {
      throw new ApiError(res.status, parsedBody as ApiErrorBody);
    }
    throw new ApiError(res.status, {
      ok: false,
      error: { kind: "internal", message: `request failed with status ${res.status}`, causes: [] },
    });
  }

  return parsedBody as ApiSuccess<T>;
}

export const apiPost = <T>(path: string, body?: unknown): Promise<ApiSuccess<T> | null> => apiWrite("POST", path, body);
export const apiPatch = <T>(path: string, body?: unknown): Promise<ApiSuccess<T> | null> => apiWrite("PATCH", path, body);
export const apiPut = <T>(path: string, body?: unknown): Promise<ApiSuccess<T> | null> => apiWrite("PUT", path, body);
export const apiDelete = <T>(path: string, params?: QueryParams): Promise<ApiSuccess<T> | null> =>
  apiWrite("DELETE", path, undefined, params);
