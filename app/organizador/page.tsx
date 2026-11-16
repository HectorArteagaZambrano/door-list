"use client";

import { createClient, type Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Event = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  starts_at: string;
  venue: string;
  status: "borrador" | "publicado";
  capacity: number | null;
};

type Ticket = {
  id: string;
  event_id: string;
  name: string;
  capacity: number
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = url && key ? createClient(url, key) : null;
const input = "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2";
const button = "rounded-lg bg-emerald-800 px-4 py-2 font-semibold text-white hover:bg-emerald-900 disabled:opacity-50";
const secondary = "rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-100 disabled:opacity-50";

function localDate(value: string) {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function OrganizerPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState<Event[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [editing, setEditing] = useState<Event | null>(null);
  const [ticketEditing, setTicketEditing] = useState<Ticket | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) { setSession(data.session); setLoading(false); }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, current) => {
      setSession(current);
      if (!current) { setEvents([]); setTickets([]); setSelected(null); }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase || !session) return;
    const [eventResult, ticketResult] = await Promise.all([
      supabase.from("events").select("*").eq("owner_id", session.user.id).order("starts_at"),
      supabase.from("ticket_types").select("*").order("name"),
    ]);
    if (eventResult.error || ticketResult.error) {
      setMessage(eventResult.error?.message || ticketResult.error?.message || "No se pudieron cargar los datos.");
      return;
    }
    setEvents(eventResult.data as Event[]);
    setTickets(ticketResult.data as Ticket[]);
  }, [session]);
  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const data = new FormData(e.currentTarget);
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.signInWithPassword({
      email: String(data.get("email")).trim(), password: String(data.get("password")),
    });
    if (error) setMessage(error.message);
    setBusy(false);
  }

  async function saveEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !session) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const capacity = data.get("capacity") ? Number(data.get("capacity")) : null;
    const starts = new Date(String(data.get("starts_at")));
    if (Number.isNaN(starts.getTime())) { setMessage("Introduce una fecha válida."); return; }
    if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 1)) { setMessage("El aforo debe ser un número entero positivo."); return; }
    const payload = {
      title: String(data.get("title")).trim(), description: String(data.get("description")).trim(),
      venue: String(data.get("venue")).trim(), starts_at: starts.toISOString(),
      capacity, status: String(data.get("status")),
    };
    if (!payload.title || !payload.venue) { setMessage("El título y el lugar son obligatorios."); return; }
    setBusy(true); setMessage("");
    const result = editing
      ? await supabase.from("events").update(payload).eq("id", editing.id).eq("owner_id", session.user.id).select("id").single()
      : await supabase.from("events").insert({ ...payload, owner_id: session.user.id }).select("id").single();
    if (result.error) setMessage(result.error.message);
    else { setEditing(null); form.reset(); setMessage("Evento guardado."); await refresh(); }
    setBusy(false);
  }

  async function saveTicket(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !selected) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name")).trim();
    const capacity = Number(data.get("capacity"));
    if (!name || !Number.isSafeInteger(capacity) || capacity < 1) { setMessage("Indica un nombre y un aforo entero positivo."); return; }
    const event = events.find((item) => item.id === selected);
    const allocated = tickets.filter((item) => item.event_id === selected && item.id !== ticketEditing?.id).reduce((sum, item) => sum + item.capacity, 0);
    if (event?.capacity != null && allocated + capacity > event.capacity) {
      setMessage("La suma de los aforos supera el aforo máximo del evento."); return;
    }
    setBusy(true); setMessage("");
    const result = ticketEditing
      ? await supabase.from("ticket_types").update({ name, capacity }).eq("id", ticketEditing.id).eq("event_id", selected).select("id").single()
      : await supabase.from("ticket_types").insert({ name, capacity, event_id: selected }).select("id").single();
    if (result.error) setMessage(result.error.message);
    else { setTicketEditing(null); form.reset(); setMessage("Tipo de entrada guardado."); await refresh(); }
    setBusy(false);
  }

  async function remove(kind: "event" | "ticket", id: string) {
    if (!supabase || !session || !window.confirm(kind === "event" ? "¿Eliminar este evento y todos sus tipos de entrada?" : "¿Eliminar este tipo de entrada?")) return;
    setBusy(true); setMessage("");
    const query = kind === "event"
      ? supabase.from("events").delete().eq("id", id).eq("owner_id", session.user.id)
      : supabase.from("ticket_types").delete().eq("id", id).eq("event_id", selected);
    const { error } = await query.select("id").single();
    if (error) setMessage(error.message);
    else {
      if (kind === "event") { setSelected(null); setEditing(null); setTicketEditing(null); }
      else if (ticketEditing?.id === id) setTicketEditing(null);
      setMessage("Eliminado correctamente."); await refresh();
    }
    setBusy(false);
  }

  const current = events.find((event) => event.id === selected);
  const currentTickets = tickets.filter((ticket) => ticket.event_id === selected);
  const allocated = currentTickets.reduce((sum, ticket) => sum + ticket.capacity, 0);
  return (
    <main className="mx-auto min-h-svh max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div><Link href="/" className="text-sm font-bold tracking-widest text-emerald-800">DOOR LIST</Link><h1 className="mt-3 text-3xl font-semibold">Panel del organizador</h1></div>
        {session && <button className={secondary} onClick={async () => { const { error } = await supabase!.auth.signOut(); if (error) setMessage(error.message); }}>Cerrar sesión</button>}
      </header>
      {message && <p role="status" className="mb-6 rounded-lg bg-stone-100 p-4 text-stone-800">{message}</p>}
      {!supabase ? <p>Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para acceder.</p> : loading ? <p>Cargando sesión…</p> : !session ? (
        <form onSubmit={login} className="grid max-w-md gap-4 rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Iniciar sesión</h2>
          <p className="text-sm text-stone-600">Accede con tu cuenta de organizador de Supabase.</p>
          <label>Correo<input className={input} name="email" type="email" autoComplete="email" required /></label>
          <label>Contraseña<input className={input} name="password" type="password" autoComplete="current-password" required /></label>
          <button className={button} disabled={busy}>Entrar</button>
        </form>
      ) : (
        <div className="grid gap-8">
          <section className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-5 text-xl font-semibold">{editing ? "Editar evento" : "Crear evento"}</h2>
            <form key={editing?.id ?? "new"} onSubmit={saveEvent} className="grid gap-4 sm:grid-cols-2">
              <label>Título<input className={input} name="title" defaultValue={editing?.title} required /></label>
              <label>Lugar<input className={input} name="venue" defaultValue={editing?.venue} required /></label>
              <label>Fecha y hora<input className={input} name="starts_at" type="datetime-local" defaultValue={editing ? localDate(editing.starts_at) : ""} required /></label>
              <label>Aforo máximo <span className="text-sm text-stone-500">(opcional)</span><input className={input} name="capacity" type="number" min="1" step="1" defaultValue={editing?.capacity ?? ""} /></label>
              <label className="sm:col-span-2">Descripción<textarea className={input} name="description" rows={3} defaultValue={editing?.description} /></label>
              <label>Estado<select className={input} name="status" defaultValue={editing?.status ?? "borrador"}><option value="borrador">Borrador</option><option value="publicado" disabled={!editing}>Publicado</option></select></label>
              <p className="self-end text-sm text-stone-600">Para publicar, el evento debe tener al menos un tipo de entrada.</p>
              <div className="flex gap-3 sm:col-span-2"><button className={button} disabled={busy}>Guardar evento</button>{editing && <button type="button" className={secondary} onClick={() => setEditing(null)}>Cancelar edición</button>}</div>
            </form>
          </section>
          <section className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-xl font-semibold">Mis eventos</h2>
            {events.length === 0 ? <p className="text-stone-600">Aún no tienes eventos.</p> : <ul className="grid gap-4">{events.map((event) => (
              <li key={event.id} className="rounded-xl border border-stone-200 p-4">
                <h3 className="font-semibold">{event.title}</h3>{event.status === "publicado" && <Link className="text-sm text-emerald-800 underline" href={`/eventos/${event.id}`}>Página pública de registro</Link>}<p className="mt-1 text-sm text-stone-600">{new Date(event.starts_at).toLocaleString("es-PE")} · {event.venue} · {event.status}</p>
                <div className="mt-3 flex flex-wrap gap-2"><button className={secondary} onClick={() => { setSelected(event.id); setTicketEditing(null); setMessage(""); }}>Tipos de entrada</button><button className={secondary} onClick={() => setEditing(event)}>Editar</button><button className={secondary} disabled={busy} onClick={() => void remove("event", event.id)}>Eliminar</button></div>
              </li>
            ))}</ul>}
          </section>
          {current && <section className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Tipos de entrada · {current.title}</h2>
            <p className="mt-2 text-sm text-stone-600">Aforo asignado: {allocated}{current.capacity == null ? " · Sin límite general" : ` / ${current.capacity}`}</p>
            <ul className="my-5 grid gap-3">{currentTickets.map((ticket) => <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 p-3"><span>{ticket.name} · {ticket.capacity} plazas</span><span className="flex gap-2"><button className={secondary} onClick={() => setTicketEditing(ticket)}>Editar</button><button className={secondary} disabled={busy} onClick={() => void remove("ticket", ticket.id)}>Eliminar</button></span></li>)}</ul>
            {currentTickets.length === 0 && <p className="mb-5 text-stone-600">Aún no hay tipos de entrada.</p>}
            <h3 className="mb-3 font-semibold">{ticketEditing ? "Editar tipo de entrada" : "Añadir tipo de entrada"}</h3>
            <form key={ticketEditing?.id ?? current.id} onSubmit={saveTicket} className="flex flex-wrap items-end gap-3">
              <label className="min-w-48 flex-1">Nombre<input className={input} name="name" defaultValue={ticketEditing?.name} required /></label>
              <label>Aforo<input className={input} name="capacity" type="number" min="1" step="1" defaultValue={ticketEditing?.capacity} required /></label>
              <button className={button} disabled={busy}>Guardar</button>{ticketEditing && <button type="button" className={secondary} onClick={() => setTicketEditing(null)}>Cancelar</button>}
            </form>
          </section>}
        </div>
      )}
    </main>
  );
}

