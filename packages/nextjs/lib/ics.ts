/** Builds a calendar file (.ics) with reminders and downloads it. Works with Google, Apple and Outlook calendars. */

export type Reminder = {
  uid: string;
  title: string;
  description: string;
  /** Unix time in seconds. */
  start: number;
};

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const stamp = (unix: number) =>
  new Date(unix * 1000)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

/** Lines longer than 75 characters are folded, as the format requires. */
const fold = (line: string) => {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  parts.push(rest);
  return parts.join("\r\n");
};

export function buildIcs(reminders: Reminder[], link: string): string {
  const now = Math.floor(Date.now() / 1000);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Milestone Pools//Reminders//EN", "CALSCALE:GREGORIAN"];
  for (const r of reminders) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.uid}@milestone-pools`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(r.start)}`,
      `DTEND:${stamp(r.start + 30 * 60)}`,
      `SUMMARY:${esc(r.title)}`,
      `DESCRIPTION:${esc(`${r.description}\n${link}`)}`,
      `URL:${link}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(r.title)}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(r.title)}`,
      "TRIGGER:-PT1H",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function downloadIcs(filename: string, reminders: Reminder[], link: string) {
  const blob = new Blob([buildIcs(reminders, link)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
