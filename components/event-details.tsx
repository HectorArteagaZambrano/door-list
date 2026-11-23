import { formatDate } from "../lib/dates";

export function EventDetails({ startsAt, venue, dateFormat }: { startsAt: string; venue: string; dateFormat?: "landing" }) {
  return (
    <dl className="event-details">
      <div>
        <dt>Fecha y hora · Lima</dt>
        <dd className="support"><time dateTime={startsAt}>{formatDate(startsAt, dateFormat)}</time></dd>
      </div>
      <div>
        <dt>Lugar</dt>
        <dd className="support">{venue}</dd>
      </div>
    </dl>
  );
}
