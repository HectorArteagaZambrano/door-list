"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { publicDb } from "../../../lib/supabase/public";

import type { Ticket as TicketData } from "../../../lib/types";
import { formatDate } from "../../../lib/dates";
const labels = { valid: "Válida", used: "Utilizada", revoked: "Revocada" };

function TicketQR({ code }: { code: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (canvas.current) void QRCode.toCanvas(canvas.current, code, { width: 300, margin: 4, errorCorrectionLevel: "M" }).catch(() => setFailed(true));
  }, [code]);
  return failed ? <p role="alert">No se pudo generar el QR. Puedes usar el código escrito debajo.</p> : <canvas ref={canvas} role="img" aria-label="Código QR de la entrada" className="mx-auto h-auto max-w-full" />;
}

export default function Ticket({ code }: { code: string }) {
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError(""); setTicket(null);
    try {
      if (!publicDb) throw new Error();
      const { data, error } = await publicDb.rpc("public_ticket", { p_code: code });
      if (error) throw error;
      setTicket(data as TicketData | null);
    } catch { setError("No pudimos consultar la entrada. Inténtalo de nuevo."); }
    finally { setLoading(false); }
  }, [code]);
  useEffect(() => {
    void Promise.resolve().then(refresh);
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  return <main className="mx-auto min-h-svh max-w-xl px-6 py-12">
    <Link href="/" className="text-sm font-bold tracking-widest text-emerald-800">DOOR LIST</Link>
    <h1 className="mt-8 text-3xl font-semibold">Tu entrada</h1>
    {loading ? <p role="status" className="mt-6">Consultando estado actual…</p> : error ? <p role="alert" className="mt-6 text-red-900">{error}</p> : !ticket ? <p className="mt-6">Entrada no encontrada. Comprueba el enlace completo.</p> : <article className="mt-6 rounded-3xl border border-stone-200 bg-white p-6">
      <h2 className="text-2xl font-semibold">{ticket.event_title}</h2>
      <p role="status" className={`my-5 rounded-lg p-3 font-semibold ${ticket.status === "valid" ? "bg-emerald-50 text-emerald-900" : "bg-stone-100 text-stone-800"}`}>{labels[ticket.status]} · {ticket.status}</p>
      {ticket.status !== "valid" && <p className="mb-5">Esta entrada no permite el acceso al evento.</p>}
      <dl className="grid gap-4">
        <div><dt className="text-sm text-stone-500">Asistente</dt><dd>{ticket.name}</dd></div>
        <div><dt className="text-sm text-stone-500">Correo</dt><dd className="break-all">{ticket.email}</dd></div>
        <div><dt className="text-sm text-stone-500">Tipo de entrada</dt><dd>{ticket.ticket_type}</dd></div>
        <div><dt className="text-sm text-stone-500">Fecha · Hora de Lima</dt><dd><time dateTime={ticket.starts_at}>{formatDate(ticket.starts_at)}</time></dd></div>
        <div><dt className="text-sm text-stone-500">Lugar</dt><dd>{ticket.venue}</dd></div>
      </dl>
      <div className="mt-6"><TicketQR code={ticket.code} /></div>
      <p className="mt-3 break-all text-center font-mono text-xs">{ticket.code}</p>
      <p className="mt-5 text-sm text-stone-600">Guarda este enlace. El enlace y el QR dan acceso a los datos de tu entrada; compártelos solo cuando sea necesario.</p>
    </article>}
    <button type="button" disabled={loading} className="mt-6 rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white disabled:opacity-50" onClick={() => void refresh()}>Actualizar estado</button>
  </main>;
}
