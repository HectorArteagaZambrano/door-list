"use client";

import { type Session } from "@supabase/supabase-js";
import { PageHeader } from "../../components/page-header";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import type { Event, TicketType } from "../../lib/types";
import { formatDate, localDate } from "../../lib/dates";
import { organizerDb as supabase } from "../../lib/supabase/organizer";



export default function OrganizerPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState("");
  const busy = Boolean(operation);
  const [listState, setListState] = useState<"loading" | "ready" | "error">("loading");
  const [listPending, setListPending] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [editing, setEditing] = useState<Event | null>(null);
  const [ticketTypeEditing, setTicketTypeEditing] = useState<TicketType | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) { setSession(data.session); setLoading(false); }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, current) => {
      setSession(current);
      if (!current) { setListState("loading"); setEvents([]); setTicketTypes([]); setSelected(null); }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase || !session) return;
    setListPending(true);
    const [eventResult, ticketTypeResult] = await Promise.all([
      supabase.from("events").select("*").eq("owner_id", session.user.id).order("starts_at"),
      supabase.from("ticket_types").select("*").order("name"),
    ]);
    setListPending(false);
    if (eventResult.error || ticketTypeResult.error) {
      setListState("error");
      return;
    }
    setListState("ready");
    setEvents(eventResult.data as Event[]);
    setTicketTypes(ticketTypeResult.data as TicketType[]);
  }, [session]);
  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const data = new FormData(e.currentTarget);
    setOperation("login"); setMessage(""); setError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: String(data.get("email")).trim(), password: String(data.get("password")),
    });
    if (error) setError("No se pudo iniciar sesión. Revisa tus credenciales e inténtalo de nuevo.");
    setOperation("");
  }

  async function saveEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !session) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const capacity = data.get("capacity") ? Number(data.get("capacity")) : null;
    const starts = new Date(String(data.get("starts_at")));
    if (Number.isNaN(starts.getTime())) { setError("Introduce una fecha válida."); return; }
    if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 1)) { setError("El aforo debe ser un número entero positivo."); return; }
    const payload = {
      title: String(data.get("title")).trim(), description: String(data.get("description")).trim(),
      venue: String(data.get("venue")).trim(), starts_at: starts.toISOString(),
      capacity, status: String(data.get("status")),
    };
    if (!payload.title || !payload.venue) { setError("El título y el lugar son obligatorios."); return; }
    setOperation("event"); setMessage(""); setError("");
    const result = editing
      ? await supabase.from("events").update(payload).eq("id", editing.id).eq("owner_id", session.user.id).select("id").single()
      : await supabase.from("events").insert({ ...payload, owner_id: session.user.id }).select("id").single();
    if (result.error) setError("No se pudo guardar el evento. Revisa su aforo y sus tipos de entrada antes de publicar.");
    else { setEditing(null); form.reset(); setMessage("Evento guardado."); await refresh(); }
    setOperation("");
  }

  async function saveTicketType(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !selected) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name")).trim();
    const capacity = Number(data.get("capacity"));
    if (!name || !Number.isSafeInteger(capacity) || capacity < 1) { setError("Indica un nombre y un aforo entero positivo."); return; }
    const event = events.find((item) => item.id === selected);
    const allocated = ticketTypes.filter((item) => item.event_id === selected && item.id !== ticketTypeEditing?.id).reduce((sum, item) => sum + item.capacity, 0);
    if (event?.capacity != null && allocated + capacity > event.capacity) {
      setError("La suma de los aforos supera el aforo máximo del evento."); return;
    }
    setOperation("ticket"); setMessage(""); setError("");
    const result = ticketTypeEditing
      ? await supabase.from("ticket_types").update({ name, capacity }).eq("id", ticketTypeEditing.id).eq("event_id", selected).select("id").single()
      : await supabase.from("ticket_types").insert({ name, capacity, event_id: selected }).select("id").single();
    if (result.error) setError("No se pudo guardar el tipo de entrada. Revisa el aforo del evento y los registros existentes.");
    else { setTicketTypeEditing(null); form.reset(); setMessage("Tipo de entrada guardado."); await refresh(); }
    setOperation("");
  }

  async function remove(kind: "event" | "ticketType", id: string) {
    if (!supabase || !session || !window.confirm(kind === "event" ? "¿Eliminar este evento y todos sus tipos de entrada?" : "¿Eliminar este tipo de entrada?")) return;
    setOperation("remove"); setMessage(""); setError("");
    const query = kind === "event"
      ? supabase.from("events").delete().eq("id", id).eq("owner_id", session.user.id)
      : supabase.from("ticket_types").delete().eq("id", id).eq("event_id", selected);
    const { error } = await query.select("id").single();
    if (error) setError("No se pudo eliminar. Actualiza los datos e inténtalo de nuevo.");
    else {
      if (kind === "event") { setSelected(null); setEditing(null); setTicketTypeEditing(null); }
      else if (ticketTypeEditing?.id === id) setTicketTypeEditing(null);
      setMessage("Eliminado correctamente."); await refresh();
    }
    setOperation("");
  }

  const current = events.find((event) => event.id === selected);
  const currentTicketTypes = ticketTypes.filter((ticketType) => ticketType.event_id === selected);
  const allocated = currentTicketTypes.reduce((sum, ticketType) => sum + ticketType.capacity, 0);
  return (
    <main className="door-page">
      <PageHeader title="Panel del organizador">
        <div className="actions"><Link href="/dashboard" className="door-link">Ver registros y asistentes</Link>
          {session && <button className="button-secondary" disabled={busy} onClick={async () => { const { error } = await supabase!.auth.signOut(); if (error) setError("No se pudo cerrar sesión. Inténtalo de nuevo."); }}>Cerrar sesión</button>}</div>
      </PageHeader>
      {error && <p role="alert" className="door-alert">{error}</p>}
      {message && !error && <p role="status" className="success-alert">{message}</p>}
      {!supabase ? <p role="alert" className="door-alert">El panel no está disponible en este momento.</p> : loading ? <p role="status">Comprobando sesión…</p> : !session ? (
        <form aria-busy={busy} onSubmit={login} className="reading door-card stack">
          <h2>Iniciar sesión</h2>
          <p className="support">Accede con tu cuenta de organizador.</p>
          <label>Correo electrónico<input className="door-field" name="email" type="email" autoComplete="email" required /></label>
          <label>Contraseña<input className="door-field" name="password" type="password" autoComplete="current-password" required /></label>
          <button className="door-button" disabled={busy}>{busy ? "Accediendo…" : "Entrar"}</button>
        </form>
      ) : (
        <div className="stack">
          <section className="door-card stack">
            <h2>{editing ? "Editar evento" : "Crear evento"}</h2>
            <form aria-busy={busy} key={editing?.id ?? "new"} onSubmit={saveEvent} className="form-grid">
              <label>Título<input className="door-field" name="title" defaultValue={editing?.title} required /></label>
              <label>Lugar<input className="door-field" name="venue" defaultValue={editing?.venue} required /></label>
              <label>Fecha y hora<input className="door-field" name="starts_at" type="datetime-local" defaultValue={editing ? localDate(editing.starts_at) : ""} required /></label>
              <label>Aforo máximo <span className="metadata">(opcional)</span><input className="door-field" name="capacity" type="number" min="1" step="1" defaultValue={editing?.capacity ?? ""} /></label>
              <label className="full-row">Descripción<textarea className="door-field" name="description" rows={3} defaultValue={editing?.description} /></label>
              <label>Estado<select aria-describedby="publish-help" className="door-field" name="status" defaultValue={editing?.status ?? "borrador"}><option value="borrador">Borrador</option><option value="publicado" disabled={!editing}>Publicado</option></select></label>
              <p id="publish-help" className="support">Para publicar, el evento debe tener al menos un tipo de entrada.</p>
              <div className="actions full-row"><button className="door-button" disabled={busy}>{operation === "event" ? "Guardando evento…" : "Guardar evento"}</button>{editing && <button type="button" className="button-secondary" disabled={busy} onClick={() => setEditing(null)}>Cancelar edición</button>}</div>
            </form>
          </section>
          <section className="door-card stack">
            <h2>Mis eventos</h2>
            {listState === "loading" && <div className="stack" role="status">Cargando tus eventos…<span className="skeleton skeleton-primary" aria-hidden="true" /></div>}
            {listState === "error" && <div><p className="door-alert" role="alert">No se pudieron cargar los eventos.</p><button type="button" disabled={listPending} className="button-secondary" onClick={() => void refresh()}>Intentar nuevamente</button></div>}
            {listState === "ready" && events.length === 0 && <div className="data-state"><h3>Aún no tienes eventos</h3><p>Cuando crees uno, aparecerá aquí.</p></div>}
            {events.length > 0 && <ul aria-busy={listPending} className="event-grid">{events.map((event) => (
              <li key={event.id} className="door-card stack">
                <h3>{event.title}</h3>{event.status === "publicado" && <Link className="door-link" href={`/eventos/${event.id}`}>Página pública de registro</Link>}<p className="metadata">{formatDate(event.starts_at, "organizer")} · {event.venue} · {event.status}</p>
                <div className="actions"><button className="button-secondary" disabled={busy} onClick={() => { setSelected(event.id); setTicketTypeEditing(null); setMessage(""); setError(""); }}>Tipos de entrada</button><button className="button-secondary" disabled={busy} onClick={() => setEditing(event)}>Editar</button><button className="button-danger" disabled={busy} onClick={() => void remove("event", event.id)}>Eliminar</button></div>
              </li>
            ))}</ul>}
          </section>
          {current && <section className="door-card stack">
            <h2>Tipos de entrada · {current.title}</h2>
            <p className="support">Aforo asignado: {allocated}{current.capacity == null ? " · Sin límite general" : ` / ${current.capacity}`}</p>
            <ul className="stack">{currentTicketTypes.map((ticketType) => <li key={ticketType.id} className="door-card section-heading"><span>{ticketType.name} · {ticketType.capacity} plazas</span><span className="actions"><button className="button-secondary" disabled={busy} onClick={() => setTicketTypeEditing(ticketType)}>Editar</button><button className="button-danger" disabled={busy} onClick={() => void remove("ticketType", ticketType.id)}>Eliminar</button></span></li>)}</ul>
            {currentTicketTypes.length === 0 && <p className="support">Aún no hay tipos de entrada.</p>}
            <h3>{ticketTypeEditing ? "Editar tipo de entrada" : "Añadir tipo de entrada"}</h3>
            <form aria-busy={busy} key={ticketTypeEditing?.id ?? current.id} onSubmit={saveTicketType} className="fields">
              <label>Nombre<input className="door-field" name="name" defaultValue={ticketTypeEditing?.name} required /></label>
              <label>Aforo<input className="door-field" name="capacity" type="number" min="1" step="1" defaultValue={ticketTypeEditing?.capacity} required /></label>
              <button className="door-button" disabled={busy}>{operation === "ticket" ? "Guardando tipo de entrada…" : "Guardar"}</button>{ticketTypeEditing && <button type="button" className="button-secondary" disabled={busy} onClick={() => setTicketTypeEditing(null)}>Cancelar</button>}
            </form>
          </section>}
        </div>
      )}
    </main>
  );
}
