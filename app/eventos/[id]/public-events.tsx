"use client";
import { publicDb as db } from "../../../lib/supabase/public";
import { getPublicEvents } from "../../../lib/supabase/public-events";
import { PageHeader } from "../../../components/page-header";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { PublicEvent, RegistrationRequest } from "../../../lib/types";

import { readRegistrationResponse, RegistrationApiError } from "../../../lib/registration-contract";

import { EventDetails } from "../../../components/event-details";

export default function PublicEvents({ eventId }: { eventId: string }) {
 const [events, setEvents] = useState<PublicEvent[]>([]);
 const [loading, setLoading] = useState(true);
 const [loadError, setLoadError] = useState("");
 const [error, setError] = useState("");
 const [busy, setBusy] = useState(false);
 const [success, setSuccess] = useState("");
 const [emailStatus, setEmailStatus] = useState("");
 const [registeredEmail, setRegisteredEmail] = useState("");
 const [ticketTypeId, setTicketTypeId] = useState("");
 const sending = useRef(false);
 const request = useRef<{ payload: string; id: string } | null>(null);
 const refresh = useCallback(async () => {
  setLoading(true); setLoadError("");
  try {
   if (!db) throw new Error();
   setEvents(await getPublicEvents(eventId));
  } catch { setLoadError(eventId ? "No se pudo cargar el evento." : "No se pudieron cargar los eventos."); }
  finally { setLoading(false); }
 }, [eventId]);
 useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);
 async function confirmRegistration() {
  if (!request.current) throw new Error();
  const [eventId, ticketTypeId, name, email] = JSON.parse(request.current.payload);
  const response = await fetch("/api/registrations", {
   method: "POST", headers: { "Content-Type": "application/json" },
   body: JSON.stringify({ eventId, ticketTypeId, name, email, requestId: request.current.id } satisfies RegistrationRequest),
  });
  return readRegistrationResponse(response);
 }
 async function retryEmail() {
  if (sending.current) return;
  sending.current = true; setBusy(true);
  try {
   const data = await confirmRegistration();
   setEmailStatus(data.emailStatus);
  } catch { setEmailStatus("failed"); }
  finally { sending.current = false; setBusy(false); }
 }
 async function submit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  if (!db || sending.current) return;
  const form = new FormData(e.currentTarget);
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  if (!name || !email || !ticketTypeId) { setError("Completa tu nombre, correo y tipo de entrada."); return; }
  setRegisteredEmail(email);
  const payload = JSON.stringify([eventId, ticketTypeId, name, email]);
  if (request.current?.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
  sending.current = true; setBusy(true); setError("");
  try {
   const data = await confirmRegistration();
   setEmailStatus(data.emailStatus); setSuccess(data.ticketCode);
  } catch (error) {
   if (error instanceof RegistrationApiError && error.code !== "internalError") {
    request.current = null;
    if (error.code === "soldOut") { setError("La entrada seleccionada ya no está disponible. Elige otra opción con cupo."); setTicketTypeId(""); }
    else if (error.code === "unavailable") setError("Este evento ya no está disponible para registro.");
    else setError("Revisa tu nombre y correo electrónico.");
    await refresh();
   } else setError("No pudimos confirmar el registro. Reintenta con los mismos datos; no se duplicará tu registro.");
  }
  finally { sending.current = false; setBusy(false); }
 }
 const event = events[0];
 const hasTickets = event?.ticketTypes.some(type => type.remaining > 0);
 return <main className="door-page">
  <PageHeader title={success ? "Registro confirmado" : event?.title ?? (loading ? "Cargando evento…" : loadError ? "Registro al evento" : "Evento no disponible")} />
  <div className="sections">
   {success ? <section className="door-card event-card featured-card reading stack">
    <p role="status">Tu lugar en {event?.title ?? "el evento"} está reservado.</p>
    {emailStatus === "sent" ? <div className="success-alert stack">
     <h2>Correo enviado</h2><p>Enviamos tu entrada con el QR a <strong>{registeredEmail}</strong>.</p>
     <p>Si no la encuentras en tu bandeja de entrada, revisa la carpeta de spam.</p>
    </div> : <div className="stack"><p role="alert" className="door-alert">Tu entrada está confirmada, pero no pudimos enviar el correo. Puedes ver tu QR o reintentar el envío.</p>
     <button type="button" className="button-secondary" disabled={busy} onClick={() => void retryEmail()}>{busy ? "Enviando…" : "Reintentar envío por correo"}</button></div>}
    <p className="support">Código de entrada: <code>{success}</code></p>
    <Link href={`/entradas/${success}`} prefetch={false} className="door-button">Ver mi entrada y QR</Link>
   </section> : <>
    {loadError && <div className="door-alert"><p role="alert">{loadError}</p><button type="button" className="button-secondary" onClick={() => void refresh()}>Intentar nuevamente</button></div>}
    {loading && !event && <div className="event-grid" aria-busy="true"><p className="sr-only" role="status">Cargando los datos del evento…</p>
     {["details","form"].map(key => <div key={key} className="door-card stack" aria-hidden="true"><span className="skeleton skeleton-primary" /><span className="skeleton skeleton-secondary" /><span className="skeleton skeleton-compact" /></div>)}
    </div>}
    {event ? <div className="event-grid" aria-busy={loading}>
     <section className="door-card event-card featured-card stack">
      <h2>Detalles del evento</h2>
      {event.description && <p className="support whitespace-pre-wrap">{event.description}</p>}
      <EventDetails startsAt={event.starts_at} venue={event.venue} />
     </section>
     <section className="door-card stack">
      <h2>Regístrate</h2><p className="support">No necesitas una cuenta. Todos los campos son obligatorios.</p>
      <form onSubmit={submit} className="fields" aria-busy={busy}>
       {error && <p role="alert" className="door-alert">{error}</p>}
       <fieldset disabled={busy} className="fields">
        <label>Tipo de entrada<select className="door-field" required value={ticketTypeId} onChange={e => setTicketTypeId(e.target.value)}><option value="">Elige una entrada</option>{event.ticketTypes.map(t => <option key={t.id} value={t.id} disabled={t.remaining <= 0}>{t.name} · {t.remaining > 0 ? `${t.remaining} disponibles` : "Agotada"}</option>)}</select></label>
        <label>Nombre<input className="door-field" name="name" autoComplete="name" required maxLength={200} /></label>
        <label>Correo electrónico<input className="door-field" name="email" type="email" autoComplete="email" required maxLength={254} aria-describedby="email-help" /></label>
        <p id="email-help" className="support">Al confirmar, recibirás tu entrada con el QR en este correo.</p>
       </fieldset>
       {!hasTickets && <p>No quedan entradas disponibles para este evento.</p>}
       <button className="door-button" disabled={busy || !hasTickets}>{busy ? "Registrando…" : "Confirmar registro"}</button>
      </form>
     </section>
    </div> : !loading && !loadError && <section className="data-state"><h2>Registro no disponible</h2><p>Solo puedes registrarte en eventos publicados desde hoy en adelante.</p><Link href="/">Ver próximos eventos</Link></section>}
   </>}
   <footer><Link href="/organizador">Acceso para organizadores</Link></footer>
  </div>
 </main>;
}
