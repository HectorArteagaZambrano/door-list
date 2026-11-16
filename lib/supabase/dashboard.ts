import type { OrganizerDashboardData } from "../types";
import { organizerDb } from "./organizer";

export async function getOrganizerDashboard(eventId?: string): Promise<OrganizerDashboardData> {
  if (!organizerDb) throw new Error("Supabase is not configured");
  const { data, error } = await organizerDb.rpc("organizer_dashboard", eventId ? { p_event_id: eventId } : {});
  if (error) throw error;
  if (!data || !Array.isArray(data.events) || !Array.isArray(data.ticketTypes) || !Array.isArray(data.registrations)) {
    throw new Error("Invalid dashboard response");
  }
  return data as OrganizerDashboardData;
}
