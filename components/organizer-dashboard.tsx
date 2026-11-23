"use client";

// Both dashboard routes require browser-session authentication, forms and refresh actions.
import { PageHeader } from "./page-header";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { organizerDb } from "../lib/supabase/organizer";
import { getOrganizerDashboard } from "../lib/supabase/dashboard";
import type { OrganizerDashboardData } from "../lib/types";
import { formatDate } from "../lib/dates";

import { EventDetails } from "./event-details";
import { DailyRegistrationChart } from "../app/dashboard/[id]/daily-registration-chart";

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

  return <main className="door-page">
    <PageHeader title="Panel del organizador">
      {session && <button type="button" className="door-button" disabled={busy} onClick={() => void logout()}>Cerrar sesión</button>}
    </PageHeader>
    {error && <p role="alert" className="door-alert">{error}</p>}
    {!organizerDb ? <p role="alert" className="door-alert">El panel no está disponible en este momento.</p>
      : loading ? <p role="status">Comprobando sesión…</p>
      : !session ? <section className="reading door-card stack">
        <h2>Iniciar sesión</h2>
        <p className="support">Accede para consultar tus eventos y asistentes.</p>
        <form onSubmit={login} className="fields" aria-busy={busy}>
          <fieldset disabled={busy} className="fields">
            <label>Correo electrónico<input className="door-field" name="email" type="email" autoComplete="email" required /></label>
            <label>Contraseña<input className="door-field" name="password" type="password" autoComplete="current-password" required /></label>
          </fieldset>
          <button className="door-button" disabled={busy}>{busy ? "Accediendo…" : "Entrar"}</button>
        </form>
      </section>
      : <DashboardContent key={`${session.user.id}/${eventId ?? ""}`} eventId={eventId} accessToken={session.access_token} />}
  </main>;
}

function DashboardContent({ eventId, accessToken }: { eventId?: string; accessToken: string }) {
  const [data, setData] = useState<OrganizerDashboardData | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    getOrganizerDashboard(eventId).then(result => {
      if (active) setData(result);
    }).catch(() => {
      if (active) setError(eventId ? "No pudimos cargar los asistentes. Intenta nuevamente." : "No se pudieron cargar tus eventos.");
    }).finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, [eventId, refresh]);

  const loading = pending && !data;
  function reload() { setPending(true); setError(""); setRefresh(value => value + 1); }
  const event = data?.events[0];
  const typeNames = new Map(data?.ticketTypes.map(type => [type.id, type.name]));

  return <>
    <nav aria-label="Navegación del organizador" className="dashboard-nav actions">
      {eventId && <Link href="/dashboard">Mis eventos</Link>}
      <Link href="/organizador">Gestionar eventos</Link>
      <button type="button" className="button-secondary" disabled={pending} onClick={reload}>{pending && data ? "Actualizando…" : "Actualizar datos"}</button>
    </nav>
    <div className="sections" aria-busy={pending}>
      {error && (!eventId || data) && <div className="door-alert">
        <p role="alert">{error}</p><button type="button" className="button-secondary" onClick={reload}>Intentar nuevamente</button>
      </div>}
      {!eventId && <section className="stack">
        <h2>Mis eventos</h2>
        {loading && <div className="door-card stack"><p role="status">Cargando tus eventos…</p><span className="skeleton skeleton-primary" aria-hidden="true" /></div>}
        {data && (data.events.length ? <ul className="event-grid">{data.events.map(item => <li key={item.id}>
          <article className="door-card event-card stack">
            <span className="status-badge">{item.status === "publicado" ? "Publicado" : "Borrador"}</span>
            <h3>{item.title}</h3>
            <EventDetails startsAt={item.starts_at} venue={item.venue} />
            <footer className="card-footer section-heading"><span className="support">{item.capacity === null ? "Sin aforo general" : `Aforo: ${item.capacity}`}</span><Link href={`/dashboard/${item.id}`} aria-label={`Ver detalle de ${item.title}`}>Ver detalle</Link></footer>
          </article>
        </li>)}</ul> : <div className="data-state"><h2>Aún no tienes eventos</h2><p>Cuando crees uno, aparecerá aquí.</p><Link href="/organizador">Crear evento</Link></div>)}
      </section>}
      {eventId && data && !event && <section className="data-state"><h2>Evento no disponible</h2><p>Solo puedes consultar eventos de tu propiedad.</p></section>}
      {eventId && event && data && <>
        <section className="door-card event-card stack">
          <span className="status-badge">{event.status === "publicado" ? "Publicado" : "Borrador"}</span>
          <h2>{event.title}</h2>
          <EventDetails startsAt={event.starts_at} venue={event.venue} />
          <p>{data.registrations.length} registros{event.capacity === null ? " · Sin aforo general" : ` / ${event.capacity} de aforo general`}</p>
        </section>
        <DailyRegistrationChart eventId={eventId} accessToken={accessToken} refresh={refresh} />
        <section className="stack">
          <h2>Tipos de entrada</h2>
          {data.ticketTypes.length ? <ul className="event-grid">{data.ticketTypes.map(type => <li key={type.id} className="door-card stack">
            <h3>{type.name}</h3><p>{type.registeredCount} / {type.capacity} registros</p>
            <progress value={type.registeredCount} max={type.capacity} aria-label={`Ocupación de ${type.name}`} />
            <p className="metadata">{Math.max(0, type.capacity - type.registeredCount)} plazas disponibles</p>
          </li>)}</ul> : <div className="data-state"><h3>Aún no hay tipos de entrada</h3><p>Puedes añadirlos desde la gestión de eventos.</p></div>}
        </section>
      </>}
      {eventId && (!data || event) && <section className="stack" aria-labelledby="attendees-title">
        <div className="section-heading"><h2 id="attendees-title">Asistentes registrados</h2>{data && <span className="support">{data.registrations.length} personas</span>}</div>
        {loading && <p className="sr-only" role="status">Cargando asistentes…</p>}
        <div className="table-wrap" tabIndex={0} role="region" aria-labelledby="attendees-title" aria-busy={pending}>
          <table className="data-table">
            <caption className="sr-only">Personas registradas y su tipo de entrada</caption>
            <thead><tr><th scope="col">Asistente</th><th scope="col">Tipo de entrada</th><th scope="col">Registro · Lima</th></tr></thead>
            <tbody aria-hidden={loading || undefined}>
              {loading ? Array.from({ length: 5 }, (_, index) => <tr key={index}>
                {["primary", "compact", "secondary"].map(size => <td key={size}><span className={`skeleton skeleton-${size}`} /></td>)}
              </tr>) : !data && error ? <tr><td colSpan={3}><div className="table-state">
                <p role="alert" className="door-alert">{error}</p><button type="button" className="button-secondary" onClick={reload}>Intentar nuevamente</button>
              </div></td></tr> : data?.registrations.length ? data.registrations.map(registration => <tr key={registration.id}>
                <td><strong>{registration.name}</strong><span className="metadata">{registration.email}</span></td>
                <td><span className="status-badge">{typeNames.get(registration.ticket_type_id)}</span></td>
                <td><time dateTime={registration.created_at}>{formatDate(registration.created_at)}</time></td>
              </tr>) : <tr><td colSpan={3}><div className="table-state"><strong>Todavía no hay asistentes registrados</strong><p>Las personas aparecerán aquí cuando completen su registro.</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>}
    </div>
  </>;
}
