import { createClient } from "@supabase/supabase-js";
import type { DailyRegistrations } from "@/lib/types";

const headers = { "Cache-Control": "private, no-store" };
const unavailable = "No se pudieron cargar los registros diarios.";

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers });
}

export async function GET(request: Request, context: RouteContext<"/api/eventos/[id]/registros-diarios">) {
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return failure("Identificador de evento inválido.", 400);
  }
  const token = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return failure("Inicia sesión para consultar los registros.", 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return failure(unavailable, 503);
  try {
    const db = createClient(url, key, { accessToken: async () => token });
    const { data, error, status } = await db.rpc("daily_registrations", { p_event_id: id });
    if (status === 401 || status === 403) return failure("No tienes acceso a los registros.", status);
    if (error) return failure(unavailable, 503);
    if (data === null) return failure("Evento no disponible.", 404);
    return Response.json(data as DailyRegistrations, { headers });
  } catch {
    return failure(unavailable, 503);
  }
}
