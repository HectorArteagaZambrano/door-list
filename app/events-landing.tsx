"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { publicDb } from "../lib/supabase/public";

import type { PublicEventSummary } from "../lib/types";
import { formatDate, startOfTodayInLima } from "../lib/dates";

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

  return (
    <main className="mx-auto min-h-svh max-w-2xl px-6 py-12">
      <Link href="/" className="text-sm font-bold tracking-widest text-emerald-800">DOOR LIST</Link>
      <section className="mt-8">
        <h1 className="text-3xl font-semibold">Próximos eventos</h1>
        <p className="mt-3 text-stone-600">Elige un evento y reserva tu lugar sin iniciar sesión.</p>
        {loading && <p role="status" className="mt-8">Cargando eventos…</p>}
        {error && (
          <div role="alert" className="mt-6">
            <p>{error}</p>
            <button type="button" className="mt-4 rounded-xl bg-emerald-800 px-6 py-3 font-semibold text-white disabled:opacity-50" disabled={loading} onClick={() => void refresh()}>Reintentar</button>
          </div>
        )}
        {!loading && !error && (events.length === 0 ? (
          <p role="status" className="mt-6">No hay eventos publicados disponibles.</p>
        ) : (
          <ul className="mt-6 grid gap-4">
            {events.map(event => (
              <li key={event.id} className="rounded-2xl border border-stone-200 bg-white p-6">
                <h2 className="text-xl font-semibold">{event.title}</h2>
                <p className="mt-3 whitespace-pre-wrap text-stone-600">{event.description}</p>
                <p className="mt-4"><time dateTime={event.starts_at}>{formatDate(event.starts_at, "landing")}</time> · Hora de Lima</p>
                <p className="mb-4">{event.venue}</p>
                <Link className="font-semibold text-emerald-800 underline" href={`/eventos/${event.id}`}>Ver evento y registrarme</Link>
              </li>
            ))}
          </ul>
        ))}
      </section>
      <Link href="/organizador" className="mt-10 inline-block text-sm text-emerald-800 underline">Acceso para organizadores</Link>
    </main>
  );
}
