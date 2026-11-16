import PublicEvents from "../../public-events";
import { Suspense } from "react";
type Props = { params: Promise<{ id: string }> };
export default function EventPage(props: Props) {
 return <Suspense fallback={<p role="status" className="p-10">Cargando evento…</p>}><EventContent {...props} /></Suspense>;
}
async function EventContent({ params }: Props) {
 const { id } = await params;
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return <main className="p-10">Este evento no está disponible para registro.</main>;
 return <PublicEvents key={id} eventId={id} />;
}
