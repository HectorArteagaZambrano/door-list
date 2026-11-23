"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { publicDb } from "../lib/supabase/public";

import type { PublicEventSummary } from "../lib/types";
import { EventDetails } from "../components/event-details";
import { startOfTodayInLima } from "../lib/dates";

export default function EventsLanding() {
  const [events, setEvents] = useState<PublicEventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!publicDb) throw new Error("Supabase no está configurado");
      const { data, error: queryError } = await publicDb
        .from("events")
        .select("id, title, description, starts_at, venue")
        .eq("status", "publicado")
        .gte("starts_at", startOfTodayInLima())
        .order("starts_at");
      if (queryError) throw queryError;
      setEvents(data ?? []);
    } catch {
      setError("No se pudieron cargar los eventos. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  if (loading) {
    return <>
      <p className="sr-only" role="status">Cargando eventos…</p>
      <div className="event-grid" aria-busy="true" aria-hidden="true">
        {[0, 1, 2].map(index => (
          <div key={index} className="door-card event-card stack">
            <span className="skeleton skeleton-primary" />
            <span className="skeleton skeleton-secondary" />
            <div className="event-details"><span className="skeleton skeleton-compact" /><span className="skeleton skeleton-secondary" /></div>
            <div className="card-footer"><span className="skeleton skeleton-compact" /></div>
          </div>
        ))}
      </div>
    </>;
  }

  if (error) {
    return <div className="data-state stack">
      <p className="door-alert" role="alert">{error}</p>
      <button type="button" className="button-secondary" onClick={() => void refresh()}>Intentar nuevamente</button>
    </div>;
  }

  if (events.length === 0) {
    return <div className="data-state">
      <h2>No hay eventos disponibles</h2>
      <p>Vuelve pronto para conocer nuevas fechas.</p>
    </div>;
  }

  return <ul className="event-grid">
    {events.map(event => (
      <li key={event.id}>
        <article className="door-card event-card stack">
          <h3>{event.title}</h3>
          {event.description && <p className="support whitespace-pre-wrap">{event.description}</p>}
          <EventDetails startsAt={event.starts_at} venue={event.venue} dateFormat="landing" />
          <footer className="card-footer">
            <Link className="door-button" href={`/eventos/${event.id}`}>Ver evento y registrarme<span className="sr-only"> en {event.title}</span></Link>
          </footer>
        </article>
      </li>
    ))}
  </ul>;
}
