export function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function startOfDayMs(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDaysStart(msStart: number, days: number) {
  const next = msStart + days * 24 * 60 * 60 * 1000;
  return startOfDayMs(next);
}

export function ymdKeyFromStart(msStart: number) {
  const d = new Date(msStart);
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

export function ymKeyFromStart(msStart: number) {
  const d = new Date(msStart);
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  return `${yyyy}-${mm}`;
}

export function startOfMonthMs(ms: number) {
  const d = new Date(ms);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function formatDayTitle(ms: number) {
  const d = new Date(ms);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dd = pad2(d.getDate());
  const mon = months[d.getMonth()] ?? "";
  const yyyy = d.getFullYear();
  return `${dd} ${mon} ${yyyy}`;
}

export function formatTime(ms: number) {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function minutesSinceStartOfDay(ms: number, dayStart: number) {
  return Math.floor((ms - dayStart) / 60000);
}

export function startOfWeekMonday(msStart: number) {
  const d = new Date(msStart);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDaysStart(msStart, mondayOffset);
}

export function shortDowLabel(msStart: number) {
  const d = new Date(msStart);
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels[d.getDay()] ?? "";
}

export function roundToStep(min: number, step: number) {
  return Math.round(min / step) * step;
}

export function isSameDay(aStart: number, bStart: number) {
  return startOfDayMs(aStart) === startOfDayMs(bStart);
}