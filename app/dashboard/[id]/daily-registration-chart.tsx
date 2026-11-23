"use client";

import { useEffect, useState } from "react";
import { formatCalendarDay } from "@/lib/dates";
import type { DailyRegistrations } from "@/lib/types";

type Props = { eventId: string; accessToken: string; refresh: number };

export function DailyRegistrationChart({ eventId, accessToken, refresh }: Props) {
  const [data, setData] = useState<DailyRegistrations | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setStatus("loading");
      try {
        const response = await fetch(`/api/eventos/${eventId}/registros-diarios`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (!controller.signal.aborted && [401, 403, 404].includes(response.status)) setData(null);
          throw new Error();
        }
        const result: DailyRegistrations = await response.json();
        if (!controller.signal.aborted) {
          setData(result);
          setStatus("ready");
        }
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }
    void load();
    return () => controller.abort();
  }, [eventId, accessToken, refresh, retry]);

  return <section className="door-card stack" aria-labelledby="daily-title" aria-busy={status === "loading"}>
    <h2 id="daily-title">Registros por día</h2>
    {status === "loading" && !data && <div className="daily-loading stack">
      <p role="status">Cargando registros diarios…</p>
      <span aria-hidden="true" className="skeleton skeleton-primary" />
    </div>}
    {status === "error" && <div className="stack">
      <p role="alert" className="door-alert">No se pudieron cargar los registros diarios.</p>
      <div><button type="button" className="button-secondary" onClick={() => setRetry(value => value + 1)}>Intentar nuevamente</button></div>
    </div>}
    {data && (data.days.length ? <DailySeries {...data} /> : <div className="data-state">
      <h3>Evento sin publicar</h3><p>La gráfica comenzará el día de la publicación.</p>
    </div>)}
  </section>;
}

function DailySeries({ days, isHistorical }: DailyRegistrations) {
  const peak = days.reduce((maximum, day) => Math.max(maximum, day.count), 0);
  const scale = Math.max(1, peak);
  const first = formatCalendarDay(days[0].date);
  const last = formatCalendarDay(days[days.length - 1].date);
  return <>
    <p className="support">{isHistorical
      ? "Desde el primer día documentado. Se desconoce la fecha original de publicación."
      : "Desde la primera publicación hasta hoy."} Hora de Lima.</p>
    <figure className="stack">
      <figcaption>{peak ? `Máximo diario: ${peak}` : "Todavía no hay registros en este periodo."}</figcaption>
      <div className="daily-plot" aria-hidden="true">
        <div className="daily-scale metadata"><span>{scale}</span><span>0</span></div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          {days.map(({ date, count }, index) => <rect key={date}
            x={100 * (index + 0.1) / days.length} y={100 * (1 - count / scale)}
            width={80 / days.length} height={100 * count / scale} />)}
        </svg>
      </div>
      <div className="section-heading metadata"><time dateTime={days[0].date}>{first}</time>
        {days.length > 1 && <time dateTime={days[days.length - 1].date}>{last}</time>}
      </div>
    </figure>
    <details className="daily-details">
      <summary>Ver cifras por día</summary>
      <div className="table-wrap"><table className="data-table">
        <caption className="sr-only">Registros diarios del evento en hora de Lima</caption>
        <thead><tr><th scope="col">Día</th><th scope="col">Registros</th></tr></thead>
        <tbody>{days.map(day => <tr key={day.date}>
          <td><time dateTime={day.date}>{formatCalendarDay(day.date)}</time></td><td>{day.count}</td>
        </tr>)}</tbody>
      </table></div>
    </details>
  </>;
}
