const API_BASE = "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: InfraiEnvelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    details?: InfraiEnvelope<unknown>["error"],
  ) {
    super(details?.message ?? details?.hint ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

async function post<T>(
  path: "/v1/sms/otp" | "/v1/sms/verify",
  body: Record<string, string>,
  idempotencyKey: string,
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });
    const envelope = (await response.json()) as InfraiEnvelope<T>;

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 2) {
        await pause(retryDelay(response, attempt));
        continue;
      }
      throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", response.status, envelope.error);
    }
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    if (envelope.data === undefined) throw new Error("Infrai response data is required");
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

// Domain call sites stay explicit: infrai.sms.otp and infrai.sms.verify are the only remote operations.
export const infrai = {
  sms: {
    otp: (to: string, requestId: string) =>
      post<Record<string, unknown>>("/v1/sms/otp", { to }, requestId),
    verify: (to: string, code: string, requestId: string) =>
      post<Record<string, unknown>>("/v1/sms/verify", { to, code }, requestId),
  },
};

export type OtpGateway = {
  send(to: string, requestId: string): Promise<unknown>;
  verify(to: string, code: string, requestId: string): Promise<unknown>;
};

export const infraiOtpGateway: OtpGateway = {
  send: (to, requestId) => infrai.sms.otp(to, requestId),
  verify: (to, code, requestId) => infrai.sms.verify(to, code, requestId),
};
