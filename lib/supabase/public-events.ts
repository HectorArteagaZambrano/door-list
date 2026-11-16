import { publicDb } from "../../app/public-db";

export type PublicEvent = {
  id: string; title: string; description: string; starts_at: string; venue: string;
  ticketTypes: { id: string; name: string; remaining: number }[];
};

type PublicEventRow = Omit<PublicEvent, "ticketTypes"> & { tickets: PublicEvent["ticketTypes"] };

export async function getPublicEvents(eventId?: string): Promise<PublicEvent[]> {
  if (!publicDb) throw new Error("Supabase is not configured");
  const { data, error } = await publicDb.rpc("public_events", eventId ? { p_event_id: eventId } : {});
  if (error) throw error;
  return (data as PublicEventRow[]).map(({ tickets, ...event }) => ({ ...event, ticketTypes: tickets }));
}
