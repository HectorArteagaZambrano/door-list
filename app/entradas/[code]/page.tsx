import { Suspense } from "react";
import type { Metadata } from "next";
import Ticket from "./ticket";

export const metadata: Metadata = {
  title: "Tu entrada | Door List",
  description: "Consulta tu entrada y su estado actual.",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ code: string }> };
export default function TicketPage(props: Props) {
  return <Suspense fallback={<p role="status" className="p-10">Cargando entrada…</p>}><TicketContent {...props} /></Suspense>;
}

async function TicketContent({ params }: Props) {
  const { code } = await params;
  if (!/^[0-9a-f]{64}$/.test(code)) return <main className="p-10">Entrada no encontrada. Comprueba el enlace completo.</main>;
  return <Ticket key={code} code={code} />;
}
