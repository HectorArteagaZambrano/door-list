const locale = "es-PE";
const timeZone = "America/Lima";

type DateFormat = "default" | "landing" | "email" | "organizer";

// Preserve the existing presentation and timezone of each caller.
export function formatDate(value: string, format: DateFormat = "default") {
  const date = new Date(value);
  if (format === "organizer") return date.toLocaleString(locale);
  if (format === "landing") {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short", timeZone }).format(date);
  }
  return date.toLocaleString(locale, format === "email"
    ? { timeZone, dateStyle: "full", timeStyle: "short" }
    : { timeZone });
}

export function localDate(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function startOfTodayInLima() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}T00:00:00-05:00`;
}
