/**
 * Zoho API client for Paperclip plugin context.
 * Handles OAuth token refresh, rate limiting, and data-center-aware URLs.
 * Ported from ~/.claude-agent/src/cliq-api.ts, adapted to use ctx.http and ctx.state.
 */

import type { PluginContext } from "@paperclipai/plugin-sdk";
import { DATA_CENTERS, type DataCenterKey } from "../constants.js";
import type { ZohoAuthState, ZohoService } from "./types.js";

const TOKEN_SAFETY_MARGIN_MS = 60_000;
const LOCKOUT_DURATION_MS = 10 * 60_000;

let lockoutUntil = 0;

function getDataCenter(dc: DataCenterKey) {
  return DATA_CENTERS[dc] ?? DATA_CENTERS.US;
}

function getBaseUrl(service: ZohoService, dc: DataCenterKey): string {
  const center = getDataCenter(dc);
  switch (service) {
    case "desk":
      return `https://${center.desk}/api/v1`;
    case "crm":
      return `https://${center.crm}/crm/v8`;
    case "projects":
      return `https://${center.projects}/restapi`;
  }
}

function getAuthHeader(service: ZohoService, token: string): string {
  if (service === "projects") {
    return `Zoho-oauthtoken ${token}`;
  }
  return `Zoho-oauthtoken ${token}`;
}

/**
 * Per-service OAuth config — the single source of truth for Zoho credentials.
 * Written by the settings UI via the `save-service-oauth-config` action and the
 * OAuth callback handler. Mirrors `ServiceOAuthConfig` in worker.ts.
 */
type ServiceOAuthConfig = {
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
  dataCenter?: DataCenterKey;
};

/** Resolved auth plus the service it belongs to. */
type ResolvedAuth = { auth: ZohoAuthState; serviceId: string };

function serviceConfigKey(serviceId: string): string {
  return `bridge.service.${serviceId}.config`;
}

function serviceAuthKey(serviceId: string): string {
  return `bridge.service.${serviceId}.auth`;
}

async function getAuth(ctx: PluginContext): Promise<ResolvedAuth> {
  // Per-service auth is the single source of truth. Any legacy global
  // `zoho.auth` blob is migrated into a per-service slot at plugin setup.
  const services = ((await ctx.state.get({ scopeKind: "instance", stateKey: "bridge.services" })) as Array<{ id: string }> | null) ?? [];
  for (const svc of services) {
    const auth = (await ctx.state.get({ scopeKind: "instance", stateKey: serviceAuthKey(svc.id) })) as ZohoAuthState | null;
    if (auth?.refreshToken) return { auth, serviceId: svc.id };
  }

  throw new Error("Zoho not connected. Please complete OAuth setup in plugin settings.");
}

/**
 * Resolve OAuth credentials from per-service state — the single source of truth.
 * Credentials live in `bridge.service.{id}.config`, NOT in the manifest
 * `instanceConfigSchema` (the manifest credential fields were removed in NEO-89).
 * We prefer the credentials of the service the tokens belong to, falling back to
 * any other service with credentials configured (e.g. a migrated legacy install
 * whose tokens landed on a service that has no credentials of its own).
 */
async function getOAuthCredentials(
  ctx: PluginContext,
  serviceId: string,
): Promise<{ clientId: string; clientSecret: string }> {
  const cfg = (await ctx.state.get({ scopeKind: "instance", stateKey: serviceConfigKey(serviceId) })) as ServiceOAuthConfig | null;
  if (cfg?.clientId && cfg?.clientSecret) {
    return { clientId: cfg.clientId, clientSecret: cfg.clientSecret };
  }

  // Fall back to any service that has credentials configured.
  const services = ((await ctx.state.get({ scopeKind: "instance", stateKey: "bridge.services" })) as Array<{ id: string }> | null) ?? [];
  for (const svc of services) {
    const other = (await ctx.state.get({ scopeKind: "instance", stateKey: serviceConfigKey(svc.id) })) as ServiceOAuthConfig | null;
    if (other?.clientId && other?.clientSecret) {
      return { clientId: other.clientId, clientSecret: other.clientSecret };
    }
  }

  throw new Error("Missing Zoho Client ID or Client Secret. Configure credentials in the service connection settings.");
}

async function saveAuth(ctx: PluginContext, resolved: ResolvedAuth): Promise<void> {
  // Persist refreshed tokens back to the service slot they were read from, so
  // each service keeps its own tokens isolated.
  await ctx.state.set({ scopeKind: "instance", stateKey: serviceAuthKey(resolved.serviceId) }, resolved.auth);
}

async function refreshAccessToken(ctx: PluginContext, resolved?: ResolvedAuth): Promise<string> {
  const current = resolved ?? (await getAuth(ctx));
  const { auth, serviceId } = current;
  const { clientId, clientSecret } = await getOAuthCredentials(ctx, serviceId);

  const center = getDataCenter(auth.dataCenter);
  const params = new URLSearchParams({
    refresh_token: auth.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const res = await ctx.http.fetch(`https://${center.accounts}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoho token refresh failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error("Zoho token refresh returned no access_token");
  }

  const updated: ZohoAuthState = {
    ...auth,
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - TOKEN_SAFETY_MARGIN_MS,
  };
  await saveAuth(ctx, { auth: updated, serviceId });
  return data.access_token;
}

async function getAccessToken(ctx: PluginContext): Promise<{ token: string; dataCenter: DataCenterKey }> {
  const resolved = await getAuth(ctx);
  const { auth } = resolved;
  if (auth.accessToken && auth.expiresAt && Date.now() < auth.expiresAt) {
    return { token: auth.accessToken, dataCenter: auth.dataCenter };
  }
  const token = await refreshAccessToken(ctx, resolved);
  return { token, dataCenter: auth.dataCenter };
}

export type ZohoResponse = {
  status: number;
  data: unknown;
  ok: boolean;
};

/**
 * Make an authenticated request to a Zoho API.
 * Handles token refresh on 401 and lockout on 429.
 */
export async function zohoFetch(
  ctx: PluginContext,
  service: ZohoService,
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<ZohoResponse> {
  if (Date.now() < lockoutUntil) {
    return {
      status: 429,
      data: { error: "Rate limited — locked out", retryAfterMs: lockoutUntil - Date.now() },
      ok: false,
    };
  }

  const { token, dataCenter } = await getAccessToken(ctx);
  const baseUrl = getBaseUrl(service, dataCenter);
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    Authorization: getAuthHeader(service, token),
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  const fetchOpts: RequestInit = {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  };

  let res = await ctx.http.fetch(url, fetchOpts);

  // 429: rate limited — lock out
  if (res.status === 429) {
    lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    return { status: 429, data: await safeJson(res), ok: false };
  }

  // 401: token expired — refresh and retry once
  if (res.status === 401) {
    const newToken = await refreshAccessToken(ctx);
    headers.Authorization = getAuthHeader(service, newToken);
    res = await ctx.http.fetch(url, { ...fetchOpts, headers });

    if (res.status === 429) {
      lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      return { status: 429, data: await safeJson(res), ok: false };
    }
  }

  const data = await safeJson(res);
  return { status: res.status, data, ok: res.ok };
}

/** Convenience for Zoho Projects API calls that need portalId in the path */
export async function projectsFetch(
  ctx: PluginContext,
  method: string,
  path: string,
  body?: unknown,
): Promise<ZohoResponse> {
  return zohoFetch(ctx, "projects", method, path, body);
}

/** Convenience for Zoho Desk API calls that need orgId header */
export async function deskFetch(
  ctx: PluginContext,
  method: string,
  path: string,
  body?: unknown,
  orgId?: string,
): Promise<ZohoResponse> {
  const headers: Record<string, string> = {};
  if (orgId) headers.orgId = orgId;
  return zohoFetch(ctx, "desk", method, path, body, headers);
}

/** Safely parse JSON from a response, falling back to text */
async function safeJson(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  return await res.text();
}

/** Proactive token refresh for the scheduled job */
export async function proactiveTokenRefresh(ctx: PluginContext): Promise<void> {
  try {
    const resolved = await getAuth(ctx);
    const timeUntilExpiry = resolved.auth.expiresAt - Date.now();
    if (timeUntilExpiry < 15 * 60_000) {
      await refreshAccessToken(ctx, resolved);
    }
  } catch {
    // No auth configured yet — skip
  }
}
