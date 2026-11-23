import { PageHeader } from "../../../components/page-header";
import Link from "next/link";
import PublicEvents from "./public-events";
import { Suspense } from "react";
type Props = { params: Promise<{ id: string }> };
export default function EventPage(props: Props) {
 return <Suspense fallback={<main className="door-page"><PageHeader title="Cargando evento…" /><div className="door-card reading stack" role="status"><span className="sr-only">Cargando evento…</span><span className="skeleton skeleton-primary" aria-hidden="true" /></div></main>}><EventContent {...props} /></Suspense>;
}
async function EventContent({ params }: Props) {
 const { id } = await params;
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return <main className="door-page"><PageHeader title="Evento no disponible" /><div className="data-state"><p>Este evento no está disponible.</p><Link href="/">Ver próximos eventos</Link></div></main>;
 return <PublicEvents key={id} eventId={id} />;
}
