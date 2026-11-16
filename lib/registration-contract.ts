import type { ApiError, EmailStatus, RegistrationErrorCode, RegistrationResponse } from "./types";

// Translate persistence fields only here, at the application's JSON API boundary.
export function registrationResponse(
  result: { ticket_code: string }, emailStatus: EmailStatus,
): RegistrationResponse {
  return { code: "ok", ticketCode: result.ticket_code, emailStatus };
}

export function registrationFailure(code: unknown): { body: ApiError; status: number } {
  switch (code) {
    case "invalid": return { body: { error: "invalid" }, status: 400 };
    case "unavailable": return { body: { error: "unavailable" }, status: 409 };
    case "sold_out": return { body: { error: "soldOut" }, status: 409 };
    default: return { body: { error: "internalError" }, status: 500 };
  }
}

export class RegistrationApiError extends Error {
  constructor(public readonly code: RegistrationErrorCode, public readonly status: number) {
    super(code);
  }
}

export async function readRegistrationResponse(response: Response): Promise<RegistrationResponse> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const code = body && typeof body === "object" && "error" in body ? body.error : null;
    // Only trusted combinations of status and identifier are business failures.
    if (response.status === 400 && code === "invalid") throw new RegistrationApiError(code, response.status);
    if (response.status === 409 && (code === "unavailable" || code === "soldOut")) {
      throw new RegistrationApiError(code, response.status);
    }
    throw new RegistrationApiError("internalError", response.status);
  }
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("code" in body) || body.code !== "ok"
    || !("ticketCode" in body) || typeof body.ticketCode !== "string" || !/^[0-9a-f]{64}$/.test(body.ticketCode)
    || !("emailStatus" in body) || (body.emailStatus !== "sent" && body.emailStatus !== "failed")) {
    throw new RegistrationApiError("internalError", response.status);
  }
  return { code: "ok", ticketCode: body.ticketCode, emailStatus: body.emailStatus };
}
