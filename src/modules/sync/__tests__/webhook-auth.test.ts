import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookAuth } from "../webhook-auth.js";

/**
 * Build a mock PluginContext whose configured secrets are exactly those given.
 *
 * - `globalSecret` is returned from `ctx.config.get()` as `webhookSecret`.
 * - `serviceSecrets` are exposed through the `bridge.services` /
 *   `bridge.service.<id>.config` state records that `collectConfiguredSecrets`
 *   walks, so we can prove a per-service secret authenticates on its own.
 */
function makeCtx(opts: { globalSecret?: string; serviceSecrets?: string[] } = {}): any {
  const services = (opts.serviceSecrets ?? []).map((_, i) => ({ id: `svc-${i}` }));
  const serviceConfigs: Record<string, { webhookSecret: string }> = {};
  (opts.serviceSecrets ?? []).forEach((secret, i) => {
    serviceConfigs[`bridge.service.svc-${i}.config`] = { webhookSecret: secret };
  });

  return {
    config: {
      get: async () => (opts.globalSecret ? { webhookSecret: opts.globalSecret } : {}),
    },
    state: {
      get: async (key: any) => {
        if (key.stateKey === "bridge.services") return services;
        return serviceConfigs[key.stateKey] ?? null;
      },
    },
  };
}

/** Build a minimal PluginWebhookInput. */
function makeInput(opts: {
  headers?: Record<string, string | string[]>;
  parsedBody?: unknown;
  rawBody?: string;
} = {}): any {
  return {
    headers: opts.headers ?? {},
    parsedBody: opts.parsedBody,
    rawBody: opts.rawBody,
  };
}

const SECRET = "s3cr3t-shared-token";

describe("verifyWebhookAuth", () => {
  it("fails OPEN when no secret is configured anywhere", async () => {
    const res = await verifyWebhookAuth(makeCtx(), makeInput({ rawBody: "anything" }));
    expect(res.ok).toBe(true);
    expect(res.method).toBe("unconfigured");
  });

  it("accepts a valid shared-secret token from a header", async () => {
    const ctx = makeCtx({ globalSecret: SECRET });
    const res = await verifyWebhookAuth(ctx, makeInput({ headers: { "x-webhook-secret": SECRET } }));
    expect(res.ok).toBe(true);
    expect(res.method).toBe("token");
  });

  it("accepts a valid shared-secret token from a parsed body field", async () => {
    const ctx = makeCtx({ globalSecret: SECRET });
    const res = await verifyWebhookAuth(ctx, makeInput({ parsedBody: { webhookSecret: SECRET } }));
    expect(res.ok).toBe(true);
    expect(res.method).toBe("token");
  });

  it("accepts a valid shared-secret token from a form-encoded raw body", async () => {
    const ctx = makeCtx({ globalSecret: SECRET });
    const res = await verifyWebhookAuth(ctx, makeInput({ rawBody: `foo=bar&secret=${SECRET}` }));
    expect(res.ok).toBe(true);
    expect(res.method).toBe("token");
  });

  it("rejects an invalid token when a secret IS configured (enforced)", async () => {
    const ctx = makeCtx({ globalSecret: SECRET });
    const res = await verifyWebhookAuth(ctx, makeInput({ headers: { "x-webhook-secret": "wrong" } }));
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/did not match/);
  });

  it("rejects a request presenting no token or signature when enforced", async () => {
    const ctx = makeCtx({ globalSecret: SECRET });
    const res = await verifyWebhookAuth(ctx, makeInput({ rawBody: "no-auth-here" }));
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/no token or signature/);
  });

  it("accepts a valid HMAC-SHA256 signature of the raw body", async () => {
    const ctx = makeCtx({ globalSecret: SECRET });
    const raw = JSON.stringify({ Task: { id: "t-1" } });
    const sig = createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
    const res = await verifyWebhookAuth(
      ctx,
      makeInput({ headers: { "x-webhook-signature": `sha256=${sig}` }, rawBody: raw }),
    );
    expect(res.ok).toBe(true);
    expect(res.method).toBe("hmac");
  });

  it("accepts a bare (no sha256= prefix) HMAC signature", async () => {
    const ctx = makeCtx({ globalSecret: SECRET });
    const raw = "payload-bytes";
    const sig = createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
    const res = await verifyWebhookAuth(
      ctx,
      makeInput({ headers: { "x-webhook-signature": sig }, rawBody: raw }),
    );
    expect(res.ok).toBe(true);
    expect(res.method).toBe("hmac");
  });

  it("rejects an HMAC signature computed with the wrong secret", async () => {
    const ctx = makeCtx({ globalSecret: SECRET });
    const raw = "payload-bytes";
    const badSig = createHmac("sha256", "not-the-secret").update(raw, "utf8").digest("hex");
    const res = await verifyWebhookAuth(
      ctx,
      makeInput({ headers: { "x-webhook-signature": badSig }, rawBody: raw }),
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/did not match/);
  });

  it("rejects an HMAC signature over a tampered body", async () => {
    const ctx = makeCtx({ globalSecret: SECRET });
    const sig = createHmac("sha256", SECRET).update("original", "utf8").digest("hex");
    const res = await verifyWebhookAuth(
      ctx,
      makeInput({ headers: { "x-webhook-signature": sig }, rawBody: "tampered" }),
    );
    expect(res.ok).toBe(false);
  });

  it("authenticates against a per-service secret when no global secret is set", async () => {
    const ctx = makeCtx({ serviceSecrets: ["per-service-secret"] });
    const res = await verifyWebhookAuth(
      ctx,
      makeInput({ headers: { "x-webhook-secret": "per-service-secret" } }),
    );
    expect(res.ok).toBe(true);
    expect(res.method).toBe("token");
  });
});
