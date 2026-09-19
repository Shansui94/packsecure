// Malaysia Public Holidays (Cuti Umum) Utility for 2025, 2026, and 2027
// Covers Federal / National holidays as well as Perak (Taiping) and Negeri Sembilan (Nilai) state holidays.

export interface PublicHoliday {
    date: string; // YYYY-MM-DD
    nameMs: string;
    nameEn: string;
    nameZh: string;
    region: 'NATIONAL' | 'PERAK' | 'NEGERI_SEMBILAN';
}

export const MALAYSIA_PUBLIC_HOLIDAYS: PublicHoliday[] = [
    // ══════════════════════════════════════════════════════════
    // 2025
    // ══════════════════════════════════════════════════════════
    { date: '2025-01-01', nameMs: 'Tahun Baru', nameEn: "New Year's Day", nameZh: '元旦新年', region: 'NATIONAL' },
    { date: '2025-01-14', nameMs: 'Hari Keputeraan YDPB Negeri Sembilan', nameEn: 'Negeri Sembilan Sultan Birthday', nameZh: '森美兰最高统治者诞辰', region: 'NEGERI_SEMBILAN' },
    { date: '2025-01-27', nameMs: 'Israk dan Mikraj', nameEn: 'Isra and Mi\'raj', nameZh: '伊斯兰夜行登霄日', region: 'NEGERI_SEMBILAN' },
    { date: '2025-01-29', nameMs: 'Tahun Baru Cina (Hari Pertama)', nameEn: 'Chinese New Year (Day 1)', nameZh: '农历大年初一', region: 'NATIONAL' },
    { date: '2025-01-30', nameMs: 'Tahun Baru Cina (Hari Kedua)', nameEn: 'Chinese New Year (Day 2)', nameZh: '农历大年初二', region: 'NATIONAL' },
    { date: '2025-02-11', nameMs: 'Hari Thaipusam', nameEn: 'Thaipusam', nameZh: '大宝森节', region: 'PERAK' },
    { date: '2025-03-18', nameMs: 'Hari Nuzul Al-Quran', nameEn: 'Nuzul Al-Quran', nameZh: '可兰经降世日', region: 'PERAK' },
    { date: '2025-03-31', nameMs: 'Hari Raya Aidilfitri (Hari Pertama)', nameEn: 'Hari Raya Aidilfitri (Day 1)', nameZh: '开斋节首日', region: 'NATIONAL' },
    { date: '2025-04-01', nameMs: 'Hari Raya Aidilfitri (Hari Kedua)', nameEn: 'Hari Raya Aidilfitri (Day 2)', nameZh: '开斋节次日', region: 'NATIONAL' },
    { date: '2025-05-01', nameMs: 'Hari Pekerja', nameEn: 'Labour Day', nameZh: '劳动节', region: 'NATIONAL' },
    { date: '2025-05-12', nameMs: 'Hari Wesak', nameEn: 'Wesak Day', nameZh: '卫塞节', region: 'NATIONAL' },
    { date: '2025-06-02', nameMs: 'Hari Keputeraan YDP Agong', nameEn: "Agong's Birthday", nameZh: '国家元首诞辰', region: 'NATIONAL' },
    { date: '2025-06-07', nameMs: 'Hari Raya Haji / Aidiladha', nameEn: 'Hari Raya Aidiladha', nameZh: '哈芝节 / 宰牲节', region: 'NATIONAL' },
    { date: '2025-06-27', nameMs: 'Awal Muharram (Maal Hijrah)', nameEn: 'Islamic New Year', nameZh: '回历新年', region: 'NATIONAL' },
    { date: '2025-08-31', nameMs: 'Hari Kebangsaan (Hari Merdeka)', nameEn: 'National Day (Merdeka)', nameZh: '马来西亚国庆日', region: 'NATIONAL' },
    { date: '2025-09-05', nameMs: 'Maulidur Rasul', nameEn: "Prophet Muhammad's Birthday", nameZh: '先知穆罕默德诞辰', region: 'NATIONAL' },
    { date: '2025-09-16', nameMs: 'Hari Malaysia', nameEn: 'Malaysia Day', nameZh: '马来西亚日', region: 'NATIONAL' },
    { date: '2025-10-20', nameMs: 'Hari Deepavali', nameEn: 'Deepavali', nameZh: '屠妖节', region: 'NATIONAL' },
    { date: '2025-11-07', nameMs: 'Hari Keputeraan Sultan Perak', nameEn: 'Perak Sultan Birthday', nameZh: '霹雳州苏丹诞辰', region: 'PERAK' },
    { date: '2025-12-25', nameMs: 'Hari Krismas', nameEn: 'Christmas Day', nameZh: '圣诞节', region: 'NATIONAL' },

    // ══════════════════════════════════════════════════════════
    // 2026
    // ══════════════════════════════════════════════════════════
    { date: '2026-01-01', nameMs: 'Tahun Baru', nameEn: "New Year's Day", nameZh: '元旦新年', region: 'NATIONAL' },
    { date: '2026-01-14', nameMs: 'Hari Keputeraan YDPB Negeri Sembilan', nameEn: 'Negeri Sembilan Sultan Birthday', nameZh: '森美兰最高统治者诞辰', region: 'NEGERI_SEMBILAN' },
    { date: '2026-01-16', nameMs: 'Israk dan Mikraj', nameEn: 'Isra and Mi\'raj', nameZh: '伊斯兰夜行登霄日', region: 'NEGERI_SEMBILAN' },
    { date: '2026-02-01', nameMs: 'Hari Thaipusam', nameEn: 'Thaipusam', nameZh: '大宝森节', region: 'PERAK' },
    { date: '2026-02-17', nameMs: 'Tahun Baru Cina (Hari Pertama)', nameEn: 'Chinese New Year (Day 1)', nameZh: '农历大年初一', region: 'NATIONAL' },
    { date: '2026-02-18', nameMs: 'Tahun Baru Cina (Hari Kedua)', nameEn: 'Chinese New Year (Day 2)', nameZh: '农历大年初二', region: 'NATIONAL' },
    { date: '2026-03-07', nameMs: 'Hari Nuzul Al-Quran', nameEn: 'Nuzul Al-Quran', nameZh: '可兰经降世日', region: 'PERAK' },
    { date: '2026-03-20', nameMs: 'Hari Raya Aidilfitri (Hari Pertama)', nameEn: 'Hari Raya Aidilfitri (Day 1)', nameZh: '开斋节首日', region: 'NATIONAL' },
    { date: '2026-03-21', nameMs: 'Hari Raya Aidilfitri (Hari Kedua)', nameEn: 'Hari Raya Aidilfitri (Day 2)', nameZh: '开斋节次日', region: 'NATIONAL' },
    { date: '2026-05-01', nameMs: 'Hari Pekerja', nameEn: 'Labour Day', nameZh: '劳动节', region: 'NATIONAL' },
    { date: '2026-05-27', nameMs: 'Hari Raya Haji / Aidiladha', nameEn: 'Hari Raya Aidiladha', nameZh: '哈芝节 / 宰牲节', region: 'NATIONAL' },
    { date: '2026-05-31', nameMs: 'Hari Wesak', nameEn: 'Wesak Day', nameZh: '卫塞节', region: 'NATIONAL' },
    { date: '2026-06-01', nameMs: 'Hari Keputeraan YDP Agong', nameEn: "Agong's Birthday", nameZh: '国家元首诞辰', region: 'NATIONAL' },
    { date: '2026-06-16', nameMs: 'Awal Muharram (Maal Hijrah)', nameEn: 'Islamic New Year', nameZh: '回历新年', region: 'NATIONAL' },
    { date: '2026-08-25', nameMs: 'Maulidur Rasul', nameEn: "Prophet Muhammad's Birthday", nameZh: '先知穆罕默德诞辰', region: 'NATIONAL' },
    { date: '2026-08-31', nameMs: 'Hari Kebangsaan (Hari Merdeka)', nameEn: 'National Day (Merdeka)', nameZh: '马来西亚国庆日', region: 'NATIONAL' },
    { date: '2026-09-16', nameMs: 'Hari Malaysia', nameEn: 'Malaysia Day', nameZh: '马来西亚日', region: 'NATIONAL' },
    { date: '2026-11-06', nameMs: 'Hari Keputeraan Sultan Perak', nameEn: 'Perak Sultan Birthday', nameZh: '霹雳州苏丹诞辰', region: 'PERAK' },
    { date: '2026-11-08', nameMs: 'Hari Deepavali', nameEn: 'Deepavali', nameZh: '屠妖节', region: 'NATIONAL' },
    { date: '2026-12-25', nameMs: 'Hari Krismas', nameEn: 'Christmas Day', nameZh: '圣诞节', region: 'NATIONAL' },

    // ══════════════════════════════════════════════════════════
    // 2027
    // ══════════════════════════════════════════════════════════
    { date: '2027-01-01', nameMs: 'Tahun Baru', nameEn: "New Year's Day", nameZh: '元旦新年', region: 'NATIONAL' },
    { date: '2027-01-06', nameMs: 'Israk dan Mikraj', nameEn: 'Isra and Mi\'raj', nameZh: '伊斯兰夜行登霄日', region: 'NEGERI_SEMBILAN' },
    { date: '2027-01-14', nameMs: 'Hari Keputeraan YDPB Negeri Sembilan', nameEn: 'Negeri Sembilan Sultan Birthday', nameZh: '森美兰最高统治者诞辰', region: 'NEGERI_SEMBILAN' },
    { date: '2027-01-22', nameMs: 'Hari Thaipusam', nameEn: 'Thaipusam', nameZh: '大宝森节', region: 'PERAK' },
    { date: '2027-02-06', nameMs: 'Tahun Baru Cina (Hari Pertama)', nameEn: 'Chinese New Year (Day 1)', nameZh: '农历大年初一', region: 'NATIONAL' },
    { date: '2027-02-07', nameMs: 'Tahun Baru Cina (Hari Kedua)', nameEn: 'Chinese New Year (Day 2)', nameZh: '农历大年初二', region: 'NATIONAL' },
    { date: '2027-02-24', nameMs: 'Hari Nuzul Al-Quran', nameEn: 'Nuzul Al-Quran', nameZh: '可兰经降世日', region: 'PERAK' },
    { date: '2027-03-10', nameMs: 'Hari Raya Aidilfitri (Hari Pertama)', nameEn: 'Hari Raya Aidilfitri (Day 1)', nameZh: '开斋节首日', region: 'NATIONAL' },
    { date: '2027-03-11', nameMs: 'Hari Raya Aidilfitri (Hari Kedua)', nameEn: 'Hari Raya Aidilfitri (Day 2)', nameZh: '开斋节次日', region: 'NATIONAL' },
    { date: '2027-05-01', nameMs: 'Hari Pekerja', nameEn: 'Labour Day', nameZh: '劳动节', region: 'NATIONAL' },
    { date: '2027-05-17', nameMs: 'Hari Raya Haji / Aidiladha', nameEn: 'Hari Raya Aidiladha', nameZh: '哈芝节 / 宰牲节', region: 'NATIONAL' },
    { date: '2027-05-20', nameMs: 'Hari Wesak', nameEn: 'Wesak Day', nameZh: '卫塞节', region: 'NATIONAL' },
    { date: '2027-06-06', nameMs: 'Awal Muharram (Maal Hijrah)', nameEn: 'Islamic New Year', nameZh: '回历新年', region: 'NATIONAL' },
    { date: '2027-06-07', nameMs: 'Hari Keputeraan YDP Agong', nameEn: "Agong's Birthday", nameZh: '国家元首诞辰', region: 'NATIONAL' },
    { date: '2027-08-15', nameMs: 'Maulidur Rasul', nameEn: "Prophet Muhammad's Birthday", nameZh: '先知穆罕默德诞辰', region: 'NATIONAL' },
    { date: '2027-08-31', nameMs: 'Hari Kebangsaan (Hari Merdeka)', nameEn: 'National Day (Merdeka)', nameZh: '马来西亚国庆日', region: 'NATIONAL' },
    { date: '2027-09-16', nameMs: 'Hari Malaysia', nameEn: 'Malaysia Day', nameZh: '马来西亚日', region: 'NATIONAL' },
    { date: '2027-10-29', nameMs: 'Hari Deepavali', nameEn: 'Deepavali', nameZh: '屠妖节', region: 'NATIONAL' },
    { date: '2027-11-05', nameMs: 'Hari Keputeraan Sultan Perak', nameEn: 'Perak Sultan Birthday', nameZh: '霹雳州苏丹诞辰', region: 'PERAK' },
    { date: '2027-12-25', nameMs: 'Hari Krismas', nameEn: 'Christmas Day', nameZh: '圣诞节', region: 'NATIONAL' },
];

/**
 * Filter holidays applicable to the specified plant / factory location.
 * If plant is not specified or 'ALL', includes National and both Perak/Nilai state holidays.
 */
export function isHolidayApplicableToPlant(holiday: PublicHoliday, plant?: string | null): boolean {
    if (!plant || plant.toUpperCase() === 'ALL') return true;
    const p = plant.toUpperCase();
    if (holiday.region === 'NATIONAL') return true;
    if ((p.includes('TAIPING') || p.includes('PERAK')) && holiday.region === 'PERAK') return true;
    if ((p.includes('NILAI') || p.includes('NEGERI SEMBILAN') || p.includes('NS')) && holiday.region === 'NEGERI_SEMBILAN') return true;
    // Default fallback: if unknown plant, allow National holidays
    return holiday.region === 'NATIONAL';
}

/**
 * Check if a date is a public holiday.
 */
export function getPublicHoliday(dateStr: string, plant?: string | null): PublicHoliday | null {
    const holiday = MALAYSIA_PUBLIC_HOLIDAYS.find(h => h.date === dateStr);
    if (!holiday) return null;
    return isHolidayApplicableToPlant(holiday, plant) ? holiday : null;
}

/**
 * Returns all public holidays for a given year and month (0-indexed month: 0 = Jan, 11 = Dec).
 */
export function getMonthPublicHolidays(year: number, monthIndex: number, plant?: string | null): PublicHoliday[] {
    const mStr = String(monthIndex + 1).padStart(2, '0');
    const prefix = `${year}-${mStr}`;
    return MALAYSIA_PUBLIC_HOLIDAYS.filter(h => h.date.startsWith(prefix) && isHolidayApplicableToPlant(h, plant));
}

/**
 * Helper to get a localized name for the public holiday based on current language
 */
export function getHolidayLocalizedName(holiday: PublicHoliday, lang: string = 'ms'): string {
    if (lang.startsWith('zh')) return holiday.nameZh;
    if (lang.startsWith('en')) return holiday.nameEn;
    return holiday.nameMs;
}
