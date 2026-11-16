"use client";
import { publicDb as db } from "./public-db";
import { getPublicEvents, type PublicEvent } from "../lib/supabase/public-events";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
const button = "rounded-xl bg-emerald-800 px-6 py-3 font-semibold text-white disabled:opacity-50";
const input = "mt-2 w-full rounded-lg border border-stone-300 p-3";
const date = (value: string) => new Date(value).toLocaleString("es-PE", { timeZone: "America/Lima" });
export default function PublicEvents({ eventId }: { eventId?: string }) {
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
  setLoadError("");
  try {
   if (!db) throw new Error();
   setEvents(await getPublicEvents(eventId));
  } catch { setLoadError("No se pudieron cargar los eventos. Inténtalo de nuevo."); }
  finally { setLoading(false); }
 }, [eventId]);
 useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);
 async function confirmRegistration() {
  if (!request.current) throw new Error();
  const [eventId, ticketTypeId, name, email] = JSON.parse(request.current.payload);
  const response = await fetch("/api/registrations", {
   method: "POST", headers: { "Content-Type": "application/json" },
   body: JSON.stringify({ eventId, ticketTypeId, name, email, requestId: request.current.id }),
  });
  const data = await response.json();
  if (!response.ok && data.code !== "invalid") throw new Error();
  return data;
 }
 async function retryEmail() {
  if (sending.current) return;
  sending.current = true; setBusy(true);
  try {
   const data = await confirmRegistration();
   setEmailStatus(data.code === "ok" ? data.email_status : "failed");
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
   if (data.code === "ok") { if (!/^[0-9a-f]{64}$/.test(data.ticket_code ?? "")) throw new Error(); setEmailStatus(data.email_status); setSuccess(data.ticket_code); return; }
   request.current = null;
   if (data.code === "sold_out") { setError("La entrada seleccionada ya no está disponible. Elige otra opción con cupo."); setTicketTypeId(""); }
   else if (data.code === "unavailable") setError("Este evento ya no está disponible para registro.");
   else setError("Revisa tu nombre y correo electrónico.");
   await refresh();
  } catch { setError("No pudimos confirmar el registro. Reintenta con los mismos datos; no se duplicará tu registro."); }
  finally { sending.current = false; setBusy(false); }
 }
 const event = events[0];
 return <main className="mx-auto min-h-svh max-w-2xl px-6 py-12">
  <Link href="/" className="text-sm font-bold tracking-widest text-emerald-800">DOOR LIST</Link>
  {success ? <section role="status" className="mt-8 rounded-2xl border border-emerald-300 bg-white p-8"><h1 className="text-3xl font-semibold">¡Registro confirmado!</h1><p className="mt-4">Tu lugar en {event?.title ?? "el evento"} está reservado.</p>
   {emailStatus === "sent" ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950"><h2 className="text-lg font-semibold">¡Correo enviado!</h2><p className="mt-2">Enviamos tu entrada a <strong className="break-all">{registeredEmail}</strong> con el nombre del evento, la fecha, el lugar y tu QR.</p><p className="mt-2 text-sm">Revisa tu bandeja de entrada y la carpeta de spam. Puedes presentar el QR directamente desde el correo.</p></div> : <div className="mt-4"><p>Tu entrada está confirmada, pero no pudimos enviar el correo. Puedes ver tu QR aquí o reintentar el envío.</p><button type="button" className={`${button} mt-3`} disabled={busy} onClick={() => void retryEmail()}>{busy ? "Enviando…" : "Reintentar envío por correo"}</button></div>}
   <p className="mt-3 break-all text-sm">Código de entrada: {success}</p><Link href={`/entradas/${success}`} prefetch={false} className="mt-6 inline-block rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white">Ver mi entrada y QR</Link></section> : <>
   {loading && <p role="status" className="mt-8">Cargando eventos…</p>}
   {loadError && <div role="alert" className="mt-6"><p>{loadError}</p><button className={`${button} mt-4`} onClick={() => { setLoading(true); void refresh(); }}>Reintentar</button></div>}
   {!loading && (!loadError || events.length > 0) && (eventId ? event ? <article className="mt-8 rounded-3xl border border-stone-200 bg-white p-6 sm:p-10">
    <h1 className="text-3xl font-semibold">{event.title}</h1><p className="mt-4 whitespace-pre-wrap text-stone-600">{event.description}</p>
    <p className="mt-5"><time dateTime={event.starts_at}>{date(event.starts_at)}</time> · Hora de Lima</p><p>{event.venue}</p>
    <h2 className="mt-8 text-xl font-semibold">Regístrate</h2><p className="mt-2 text-sm text-stone-600">No necesitas una cuenta. Nombre y correo son obligatorios.</p>
    <form onSubmit={submit} className="mt-6 grid gap-5" aria-busy={busy}>
     <fieldset disabled={busy} className="grid gap-5">
      <label>Tipo de entrada<select className={input} required value={ticketTypeId} onChange={e => setTicketTypeId(e.target.value)}><option value="">Elige una entrada</option>{event.ticketTypes.map(t => <option key={t.id} value={t.id} disabled={t.remaining <= 0}>{t.name} · {t.remaining > 0 ? `${t.remaining} disponibles` : "Agotada"}</option>)}</select></label>
      <label>Nombre<input className={input} name="name" autoComplete="name" required maxLength={200} /></label>
      <label>Correo electrónico<input className={input} name="email" type="email" autoComplete="email" required maxLength={254} /></label>
     </fieldset>
     {!event.ticketTypes.some(t => t.remaining > 0) && <p role="status">No quedan entradas disponibles para este evento.</p>}
     <p className="text-sm text-stone-600">Al confirmar, recibirás tu entrada con el QR en el correo indicado.</p>
     <button className={button} disabled={busy || !event.ticketTypes.some(t => t.remaining > 0)}>{busy ? "Confirmando y enviando entrada…" : "Confirmar registro"}</button>
    </form>
   </article> : <p className="mt-8">Este evento no está disponible para registro. Solo puedes registrarte en eventos publicados desde hoy en adelante.</p> : <section className="mt-8"><h1 className="text-3xl font-semibold">Próximos eventos</h1><p className="mt-3 text-stone-600">Elige un evento y reserva tu lugar sin iniciar sesión.</p>{events.length === 0 && <p className="mt-6">No hay eventos publicados disponibles.</p>}<ul className="mt-6 grid gap-4">{events.map(item => <li key={item.id} className="rounded-2xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-semibold">{item.title}</h2><p className="my-3">{date(item.starts_at)} · {item.venue}</p><Link className="font-semibold text-emerald-800 underline" href={`/eventos/${item.id}`}>Ver evento y registrarme</Link></li>)}</ul></section>)}
   {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}
  </>}
  <Link href="/organizador" className="mt-10 inline-block text-sm text-emerald-800 underline">Acceso para organizadores</Link>
 </main>;
}



