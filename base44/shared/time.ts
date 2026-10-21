// Timezone handling for scheduling.
//
// A post stores a local calendar day + local wall-clock time + an IANA zone.
// The publishing job compares against a derived UTC instant, so a post fires at
// the owner's intended local time year-round, including across DST changes.

export const DEFAULT_TIMEZONE = 'America/New_York';

export function isValidTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Offset of a zone from UTC, in milliseconds, at a given UTC instant. */
function zoneOffsetMs(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));

  const map = {};
  for (const part of parts) map[part.type] = part.value;

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - utcMs;
}

/**
 * Convert a local calendar day + time in a zone into the UTC instant as an ISO string.
 * Falls back to treating the input as UTC when the zone is unknown.
 */
export function zonedToUtcIso(dateStr, timeStr, timeZone) {
  if (!dateStr) return null;
  const day = String(dateStr).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  const rawTime = /^\d{1,2}:\d{2}/.test(String(timeStr || '')) ? String(timeStr).slice(0, 5) : '09:00';
  const [hour, minute] = rawTime.split(':').map(Number);
  const [year, month, dayOfMonth] = day.split('-').map(Number);

  const naive = Date.UTC(year, month - 1, dayOfMonth, hour, minute, 0);
  if (!isValidTimeZone(timeZone)) return new Date(naive).toISOString();

  // Two passes settle the offset on either side of a DST boundary.
  let instant = naive - zoneOffsetMs(naive, timeZone);
  instant = naive - zoneOffsetMs(instant, timeZone);
  return new Date(instant).toISOString();
}

/**
 * Current wall-clock parts in a zone, used to bucket a post onto the right
 * calendar day in the owner's local terms.
 */
export function zonedParts(timeZone) {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date());

  const map = {};
  for (const part of parts) map[part.type] = part.value;
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${String(map.hour).padStart(2, '0')}:${map.minute}`,
    timeZone: zone,
  };
}

export function nowIso() {
  return new Date().toISOString();
}