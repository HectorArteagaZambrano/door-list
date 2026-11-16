import { publicDb } from "./public";

import type { PublicEvent } from "../types";

type PublicEventRow = Omit<PublicEvent, "ticketTypes"> & { tickets: PublicEvent["ticketTypes"] };

export async function getPublicEvents(eventId?: string): Promise<PublicEvent[]> {
  if (!publicDb) throw new Error("Supabase is not configured");
  const { data, error } = await publicDb.rpc("public_events", eventId ? { p_event_id: eventId } : {});
  if (error) throw error;
  return (data as PublicEventRow[]).map(({ tickets, ...event }) => ({ ...event, ticketTypes: tickets }));
}
