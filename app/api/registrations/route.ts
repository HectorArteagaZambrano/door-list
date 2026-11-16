import { publicDb } from "../../../lib/supabase/public";
import { sendTicketEmail, TicketEmailError } from "../../../lib/ticket-email";

import { registrationFailure, registrationResponse } from "../../../lib/registration-contract";
import type { ApiError, EmailStatus } from "../../../lib/types";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(error: ApiError["error"], status: number) {
  return Response.json({ error } satisfies ApiError, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try { return await register(request); }
  catch { return errorResponse("internalError", 500); }
}

async function register(request: Request) {
  let body;
  try { body = await request.json(); }
  catch { return errorResponse("invalid", 400); }
  if (!body || typeof body !== "object" ||
    ![body.eventId, body.ticketTypeId, body.requestId].every(value => typeof value === "string" && uuid.test(value)) ||
    typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 200 ||
    typeof body.email !== "string" || body.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return errorResponse("invalid", 400);
  }
  if (!publicDb) return errorResponse("internalError", 503);
  let result;
  try { result = await publicDb.rpc("register_attendee", {
    p_event_id: body.eventId, p_ticket_id: body.ticketTypeId, p_name: body.name.trim(),
    p_email: body.email.trim(), p_request_id: body.requestId,
  }); } catch { return errorResponse("internalError", 503); }
  const { data, error } = result;
  if (error) return errorResponse("internalError", 503);
  if (data?.code !== "ok") {
    const failure = registrationFailure(data?.code);
    return errorResponse(failure.body.error, failure.status);
  }
  if (typeof data.ticket_code !== "string" || !/^[0-9a-f]{64}$/.test(data.ticket_code)) return errorResponse("internalError", 500);
  let emailStatus: EmailStatus = "failed";
  try {
    // Resolve the recipient and event from the issued ticket, never from client email content.
    const { data: ticket, error: ticketError } = await publicDb.rpc("public_ticket", { p_code: data.ticket_code });
    if (ticketError || !ticket) throw new Error("Ticket lookup failed");
    await sendTicketEmail(ticket);
    emailStatus = "sent";
  } catch (error) {
    // Do not expose personal data, bearer codes, or provider credentials in logs.
    console.error("Ticket confirmation email failed", error instanceof TicketEmailError
      ? { code: error.code, status: error.status }
      : { code: "ticket_email_unexpected_error" });
  }
  return Response.json(registrationResponse(data, emailStatus), {
    headers: { "Cache-Control": "no-store" },
  });
}
