import type { EmailStatus, RegistrationResponse } from "./types";

// Translate persistence fields only here, at the application's JSON API boundary.
export function registrationResponse(
  result: { ticket_code: string }, emailStatus: EmailStatus,
): RegistrationResponse {
  return { code: "ok", ticketCode: result.ticket_code, emailStatus };
}
