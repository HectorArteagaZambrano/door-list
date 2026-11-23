import Link from "next/link";
import { PageHeader } from "../components/page-header";
import EventsLanding from "./events-landing";

export default function Home() {
  return <main className="door-page">
    <PageHeader title="Próximos eventos" description="Elige un evento y reserva tu lugar sin iniciar sesión." />
    <div className="sections">
      <section aria-labelledby="public-events-title">
        <h2 id="public-events-title" className="sr-only">Eventos disponibles para registro</h2>
        <EventsLanding />
      </section>
      <footer><Link href="/organizador">Acceso para organizadores</Link></footer>
    </div>
  </main>;
}
