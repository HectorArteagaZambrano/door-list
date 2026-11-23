export type Event = {
  id: string; owner_id: string; title: string; description: string;
  starts_at: string; venue: string; status: "borrador" | "publicado"; capacity: number | null;
};

export type TicketType = { id: string; event_id: string; name: string; capacity: number };
export type Registration = { id: string; ticket_type_id: string; name: string; email: string; created_at: string };
export type Ticket = Pick<Registration, "name" | "email"> & {
  code: string; status: "valid" | "used" | "revoked";
  ticket_type: string; event_title: string; starts_at: string; venue: string;
};
export type EmailTicket = Omit<Ticket, "status">;
export type PublicEventSummary = Pick<Event, "id" | "title" | "description" | "starts_at" | "venue">;
export type AvailableTicketType = Pick<TicketType, "id" | "name"> & { remaining: number };
export type PublicEvent = PublicEventSummary & { ticketTypes: AvailableTicketType[] };
export type RegistrationRequest = Pick<Registration, "name" | "email"> & {
  eventId: string; ticketTypeId: string; requestId: string;
};
export type EmailStatus = "sent" | "failed";
export type RegistrationResponse = { code: "ok"; ticketCode: string; emailStatus: EmailStatus };

export type RegistrationErrorCode = "invalid" | "unavailable" | "soldOut" | "internalError";
export type ApiError = { error: RegistrationErrorCode };

export type OrganizerDashboardData = {
  events: Event[];
  ticketTypes: (TicketType & { registeredCount: number })[];
  registrations: Registration[];
};

export type DailyRegistrations = {
  isHistorical: boolean;
  days: { date: string; count: number }[];
};
