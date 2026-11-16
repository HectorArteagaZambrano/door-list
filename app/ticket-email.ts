import QRCode from "qrcode";

type EmailTicket = {
  code: string; name: string; email: string; event_title: string;
  starts_at: string; venue: string; ticket_type: string;
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]!);

export class TicketEmailError extends Error {
  constructor(public readonly code: string, public readonly status?: number) {
    super(code);
  }
}

export async function sendTicketEmail(ticket: EmailTicket) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!key || !from) throw new TicketEmailError("resend_not_configured");
  const date = new Date(ticket.starts_at).toLocaleString("es-PE", {
    timeZone: "America/Lima", dateStyle: "full", timeStyle: "short",
  });
  const qr = await QRCode.toBuffer(ticket.code, { type: "png", width: 300, margin: 4, errorCorrectionLevel: "M" });
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f5f5f4;font-family:Arial,sans-serif;color:#1c1917">
    <main style="max-width:560px;margin:24px auto;padding:32px;background:#fff;border-radius:16px">
      <p style="color:#065f46;font-weight:bold">DOOR LIST</p><h1>¡Tu registro está confirmado!</h1>
      <p>Hola, ${escapeHtml(ticket.name)}. Esta es tu entrada:</p>
      <h2>${escapeHtml(ticket.event_title)}</h2>
      <p><strong>Fecha:</strong> ${escapeHtml(date)} (hora de Lima)</p>
      <p><strong>Lugar:</strong> ${escapeHtml(ticket.venue)}</p>
      <p><strong>Tipo de entrada:</strong> ${escapeHtml(ticket.ticket_type)}</p>
      <p>Presenta este QR al ingresar al evento:</p>
      <img src="cid:ticket-qr" width="300" height="300" alt="Código QR de tu entrada" style="display:block;max-width:100%;height:auto;margin:20px auto" />
      <p style="font-size:12px;word-break:break-all">Código: ${ticket.code}</p>
      <p>Conserva este correo y evita compartir tu entrada.</p>
    </main></body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `registration-ticket/${ticket.code}` },
    body: JSON.stringify({
      from, to: [ticket.email], subject: `Tu entrada para ${ticket.event_title.replace(/[\r\n]/g, " ")}`,
      html, text: `Hola, ${ticket.name}.\nTu registro está confirmado.\nEvento: ${ticket.event_title}\nFecha: ${date} (hora de Lima)\nLugar: ${ticket.venue}\nTipo de entrada: ${ticket.ticket_type}\nCódigo: ${ticket.code}\nEl QR está incluido en este correo.`,
      attachments: [{ filename: "entrada-qr.png", content: qr.toString("base64"), content_type: "image/png", content_id: "ticket-qr" }],
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    // Classify the response without retaining its message (it may contain email addresses).
    const message = typeof error?.message === "string" ? error.message : "";
    const code = /only send testing emails/i.test(message) ? "resend_test_sender_restricted"
      : /domain.*not verified|verify a domain/i.test(message) ? "resend_domain_not_verified"
      : response.status === 401 ? "resend_invalid_api_key"
      : response.status === 429 ? "resend_rate_limited" : "resend_rejected";
    throw new TicketEmailError(code, response.status);
  }
}
