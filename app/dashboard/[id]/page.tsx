import { PageHeader } from "../../../components/page-header";
import { Suspense } from "react";
import Link from "next/link";
import OrganizerDashboard from "../../../components/organizer-dashboard";

export default function DashboardEventPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<main className="door-page"><PageHeader title="Cargando evento…" /><div className="door-card reading stack" role="status"><span className="sr-only">Cargando evento…</span><span className="skeleton skeleton-primary" aria-hidden="true" /></div></main>}>
    <DashboardEventContent params={params} />
  </Suspense>;
}

async function DashboardEventContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return <main className="door-page"><PageHeader title="Evento no disponible" /><div className="data-state"><p>Este evento no está disponible.</p><Link href="/dashboard">Volver a mis eventos</Link></div></main>;
  }
  return <OrganizerDashboard key={id} eventId={id} />;
}
