/** Malaysia Time (UTC+8) date helpers for reports and queries */

export const MYT_TIMEZONE = 'Asia/Kuala_Lumpur';

/** YYYY-MM-DD in MYT for the given instant */
export function formatYmdInMyt(d: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: MYT_TIMEZONE }).format(d);
}

export function mytTodayYmd(): string {
    return formatYmdInMyt(new Date());
}

/** UTC ISO bounds for one MYT calendar day */
export function mytDayBoundsUtcIso(dateYmd: string): { start: string; end: string } {
    const start = new Date(`${dateYmd}T00:00:00+08:00`);
    const end = new Date(`${dateYmd}T23:59:59.999+08:00`);
    return { start: start.toISOString(), end: end.toISOString() };
}

/** UTC ISO bounds from startYmd 00:00 MYT through endYmd 23:59:59 MYT (inclusive) */
export function mytRangeBoundsUtcIso(startYmd: string, endYmd: string): { start: string; end: string } {
    const { start } = mytDayBoundsUtcIso(startYmd);
    const { end } = mytDayBoundsUtcIso(endYmd);
    return { start, end };
}

/** Add calendar days to a YYYY-MM-DD string (interpreted in MYT) */
export function addDaysYmd(ymd: string, days: number): string {
    const d = new Date(`${ymd}T12:00:00+08:00`);
    d.setUTCDate(d.getUTCDate() + days);
    return formatYmdInMyt(d);
}

/** Monday–Sunday week containing referenceYmd (MYT) */
export function mytWeekRange(referenceYmd?: string): { start: string; end: string } {
    const anchor = referenceYmd || mytTodayYmd();
    const d = new Date(`${anchor}T12:00:00+08:00`);
    const dow = d.getUTCDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
        start: formatYmdInMyt(monday),
        end: formatYmdInMyt(sunday),
    };
}

export function formatDateTimeMyt(iso: string | null | undefined): string {
    if (!iso) return '–';
    return new Date(iso).toLocaleString('en-MY', { timeZone: MYT_TIMEZONE });
}
