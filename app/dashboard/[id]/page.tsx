import { Suspense } from "react";
import Link from "next/link";
import OrganizerDashboard from "../../../components/organizer-dashboard";

export default function DashboardEventPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p role="status" className="p-10">Cargando evento…</p>}>
    <DashboardEventContent params={params} />
  </Suspense>;
}

async function DashboardEventContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return <main className="mx-auto max-w-5xl p-10"><h1 className="text-2xl font-semibold">Evento no disponible</h1>
      <Link href="/dashboard" className="mt-4 inline-block text-emerald-800 underline">Volver a mis eventos</Link></main>;
  }
  return <OrganizerDashboard key={id} eventId={id} />;
}
