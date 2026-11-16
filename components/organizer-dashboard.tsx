"use client";

// Both dashboard routes require browser-session authentication, forms and refresh actions.
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { organizerDb } from "../lib/supabase/organizer";
import { getOrganizerDashboard } from "../lib/supabase/dashboard";
import type { OrganizerDashboardData } from "../lib/types";
import { formatDate } from "../lib/dates";

const button = "rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white disabled:opacity-50";
const link = "font-semibold text-emerald-800 underline underline-offset-4";
const input = "mt-2 w-full rounded-lg border border-stone-300 p-3";

export default function OrganizerDashboard({ eventId }: { eventId?: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!organizerDb) return;
    let active = true;
    let authChanged = false;
    const { data } = organizerDb.auth.onAuthStateChange((_event, current) => {
      authChanged = true;
      if (active) { setSession(current); setLoading(false); }
    });
    organizerDb.auth.getSession().then(({ data, error }) => {
      if (!active || authChanged) return;
      setSession(error ? null : data.session);
      if (error) setError("No se pudo recuperar la sesión. Inicia sesión de nuevo.");
      setLoading(false);
    }).catch(() => {
      if (active && !authChanged) { setError("No se pudo recuperar la sesión. Inicia sesión de nuevo."); setLoading(false); }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizerDb || busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const { error } = await organizerDb.auth.signInWithPassword({
        email: String(form.get("email")).trim(), password: String(form.get("password")),
      });
      if (error) throw error;
    } catch { setError("No se pudo iniciar sesión. Revisa tu correo y contraseña e inténtalo de nuevo."); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (!organizerDb || busy) return;
    setBusy(true); setError("");
    try {
      const { error } = await organizerDb.auth.signOut();
      if (error) throw error;
      setSession(null);
    } catch { setError("No se pudo cerrar sesión. Inténtalo de nuevo."); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto min-h-svh max-w-5xl px-6 py-10">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div><Link href="/" className="text-sm font-bold tracking-widest text-emerald-800">DOOR LIST</Link>
        <h1 className="mt-3 text-3xl font-semibold">Panel del organizador</h1></div>
      {session && <button type="button" className={button} disabled={busy} onClick={() => void logout()}>Cerrar sesión</button>}
    </header>
    {error && <p role="alert" className="mb-6 rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}
    {!organizerDb ? <p role="alert">El panel no está disponible en este momento.</p>
      : loading ? <p role="status">Comprobando sesión…</p>
      : !session ? <section className="max-w-md rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Iniciar sesión</h2>
        <p className="mt-2 text-stone-600">Accede para consultar tus eventos y asistentes.</p>
        <form onSubmit={login} className="mt-6 grid gap-5" aria-busy={busy}>
          <fieldset disabled={busy} className="grid gap-5">
            <label>Correo electrónico<input className={input} name="email" type="email" autoComplete="email" required /></label>
            <label>Contraseña<input className={input} name="password" type="password" autoComplete="current-password" required /></label>
          </fieldset>
          <button className={button} disabled={busy}>{busy ? "Accediendo…" : "Entrar"}</button>
        </form>
      </section>
      : <DashboardContent key={`${session.user.id}/${eventId ?? ""}`} eventId={eventId} />}
  </main>;
}

function DashboardContent({ eventId }: { eventId?: string }) {
  const [data, setData] = useState<OrganizerDashboardData | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    getOrganizerDashboard(eventId).then(result => {
      if (active) setData(result);
    }).catch(() => {
      if (active) setError("No se pudieron cargar los datos del panel. Inténtalo de nuevo.");
    });
    return () => { active = false; };
  }, [eventId, refresh]);

  const loading = !data && !error;
  function reload() { setData(null); setError(""); setRefresh(value => value + 1); }
  const event = data?.events[0];
  const typeNames = new Map(data?.ticketTypes.map(type => [type.id, type.name]));

  return <>
    <nav aria-label="Navegación del organizador" className="mb-8 flex flex-wrap gap-6">
      {eventId && <Link href="/dashboard" className={link}>Mis eventos</Link>}
      <Link href="/organizador" className={link}>Gestionar eventos</Link>
      <button type="button" className={link} disabled={loading} onClick={reload}>Actualizar datos</button>
    </nav>
    {loading && <p role="status">Cargando {eventId ? "evento y asistentes" : "tus eventos"}…</p>}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-5 text-red-900">
      <p>{error}</p><button type="button" className={`${button} mt-4`} onClick={reload}>Reintentar</button>
    </div>}
    {data && (!eventId ? <section>
      <h2 className="text-2xl font-semibold">Mis eventos</h2>
      <p className="mt-2 text-stone-600">Selecciona un evento para consultar su ocupación y sus asistentes.</p>
      {data.events.length === 0 ? <p role="status" className="mt-6">Todavía no tienes eventos. Crea uno desde Gestionar eventos.</p>
        : <ul className="mt-6 grid gap-4 sm:grid-cols-2">{data.events.map(item => <li key={item.id} className="rounded-2xl border border-stone-200 bg-white p-6">
          <p className="text-sm font-semibold text-emerald-800">{item.status === "publicado" ? "Publicado" : "Borrador"}</p>
          <h3 className="mt-2 text-xl font-semibold"><Link className={link} href={`/dashboard/${item.id}`}>{item.title}</Link></h3>
          <p className="mt-3"><time dateTime={item.starts_at}>{formatDate(item.starts_at)}</time> · Hora de Lima</p>
          <p className="mt-2 text-stone-600">{item.venue}</p>
        </li>)}</ul>}
    </section> : !event ? <p role="status">Evento no disponible. Solo puedes consultar eventos de tu propiedad.</p>
      : <>
        <section className="mb-8 rounded-2xl bg-emerald-950 p-6 text-white">
          <p className="text-sm">{event.status === "publicado" ? "Publicado" : "Borrador"}</p>
          <h2 className="mt-2 text-3xl font-semibold">{event.title}</h2>
          <p className="mt-3"><time dateTime={event.starts_at}>{formatDate(event.starts_at)}</time> · Hora de Lima</p>
          <p className="mt-2">{event.venue}</p>
          <p className="mt-5 text-lg font-semibold">{data.registrations.length} registros{event.capacity === null ? " · Sin aforo general" : ` / ${event.capacity} de aforo general`}</p>
        </section>
        <section aria-labelledby="ticket-types-title">
          <h3 id="ticket-types-title" className="text-2xl font-semibold">Tipos de entrada</h3>
          {data.ticketTypes.length === 0 ? <p className="mt-4">Este evento todavía no tiene tipos de entrada.</p>
            : <ul className="mt-5 grid gap-4 sm:grid-cols-2">{data.ticketTypes.map(type => <li key={type.id} className="rounded-2xl border border-stone-200 bg-white p-5">
              <h4 className="text-lg font-semibold">{type.name}</h4>
              <p className="mt-2">{type.registeredCount} / {type.capacity} registros</p>
              <progress className="mt-3 h-3 w-full accent-emerald-800" value={type.registeredCount} max={type.capacity} aria-label={`Ocupación de ${type.name}`} />
              <p className="mt-2 text-sm text-stone-600">{Math.max(0, type.capacity - type.registeredCount)} plazas disponibles</p>
            </li>)}</ul>}
        </section>
        <section className="mt-10" aria-labelledby="attendees-title">
          <h3 id="attendees-title" className="text-2xl font-semibold">Asistentes registrados</h3>
          {data.registrations.length === 0 ? <p role="status" className="mt-4">Todavía no hay asistentes registrados.</p>
            : <div className="mt-5 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
              <table className="w-full text-left text-sm"><caption className="sr-only">Asistentes registrados en {event.title}</caption>
                <thead className="bg-stone-100"><tr>{["Nombre", "Correo electrónico", "Tipo de entrada", "Fecha de registro · Lima"].map(title => <th key={title} scope="col" className="px-5 py-4">{title}</th>)}</tr></thead>
                <tbody>{data.registrations.map(registration => <tr key={registration.id} className="border-t border-stone-200">
                  <td className="px-5 py-4 font-medium">{registration.name}</td>
                  <td className="break-all px-5 py-4">{registration.email}</td>
                  <td className="px-5 py-4">{typeNames.get(registration.ticket_type_id)}</td>
                  <td className="whitespace-nowrap px-5 py-4"><time dateTime={registration.created_at}>{formatDate(registration.created_at)}</time></td>
                </tr>)}</tbody>
              </table>
            </div>}
        </section>
      </>)}
  </>;
}
