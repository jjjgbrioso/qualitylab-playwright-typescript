import { type APIRequestContext, type APIResponse, expect, request } from '@playwright/test';
import type { ApiErrorBody, ApiPage, AppModule } from './types';

type Query = Record<string, string | number | boolean | undefined>;

/**
 * A thin wrapper around Playwright's APIRequestContext for the QualityLab REST API (/api/v1).
 * Every response is checked, and the { data } envelope is unwrapped.
 */
export class ApiClient {
  private constructor(
    private readonly context: APIRequestContext,
    readonly module: AppModule | null,
  ) {}

  /** An API client without a session, for public endpoints such as products and hotels. */
  static async anonymous(apiBaseUrl: string): Promise<ApiClient> {
    return new ApiClient(await request.newContext({ baseURL: `${apiBaseUrl}/` }), null);
  }

  /** Signs in to one module and sends the token as a Bearer header on every call. */
  static async signedIn(
    apiBaseUrl: string,
    module: AppModule,
    credentials: { username: string; password: string },
  ): Promise<ApiClient> {
    const login = await request.newContext({ baseURL: `${apiBaseUrl}/` });
    try {
      const response = await login.post('auth/login', {
        data: { email: credentials.username, password: credentials.password, module },
      });
      await expectOk(response, `API sign-in to ${module}`);
      const { token } = ((await response.json()) as { data: { token: string } }).data;
      const context = await request.newContext({
        baseURL: `${apiBaseUrl}/`,
        extraHTTPHeaders: { Authorization: `Bearer ${token}` },
      });
      return new ApiClient(context, module);
    } finally {
      await login.dispose();
    }
  }

  async get<T>(path: string, query?: Query): Promise<T> {
    const response = await this.context.get(relative(path), { params: clean(query) });
    await expectOk(response, `GET ${path}`);
    return ((await response.json()) as { data: T }).data;
  }

  async getPage<T>(path: string, query?: Query): Promise<ApiPage<T>> {
    const response = await this.context.get(relative(path), { params: clean(query) });
    await expectOk(response, `GET ${path}`);
    return (await response.json()) as ApiPage<T>;
  }

  async post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    const response = await this.postRaw(path, body, headers);
    await expectOk(response, `POST ${path}`);
    return ((await response.json()) as { data: T }).data;
  }

  /** For negative checks: returns the response without asserting on its status. */
  async postRaw(path: string, body?: unknown, headers?: Record<string, string>): Promise<APIResponse> {
    return this.context.post(relative(path), { data: body ?? {}, headers });
  }

  async delete(path: string): Promise<void> {
    const response = await this.context.delete(relative(path));
    await expectOk(response, `DELETE ${path}`);
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }
}

/** Reads the standard error body: { error: { code, message, details } }. */
export async function errorOf(response: APIResponse): Promise<ApiErrorBody['error']> {
  return ((await response.json()) as ApiErrorBody).error;
}

async function expectOk(response: APIResponse, what: string): Promise<void> {
  if (!response.ok()) {
    const body = await response.text();
    expect(response.ok(), `${what} returned ${response.status()}: ${body.slice(0, 300)}`).toBe(true);
  }
}

function relative(path: string): string {
  return path.replace(/^\/+/, '');
}

function clean(query?: Query): Record<string, string | number | boolean> | undefined {
  if (!query) return undefined;
  return Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined)) as Record<
    string,
    string | number | boolean
  >;
}
