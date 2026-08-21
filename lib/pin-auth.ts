/** Company policy: 4-digit PIN; Supabase Auth stores PIN + "00" (min 6 chars). */

export function normalizeFourDigitPin(raw: string): string | null {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length !== 4) return null;
    return digits;
}

export function pinToAuthPassword(pin: string): string {
    const normalized = normalizeFourDigitPin(pin);
    if (!normalized) {
        throw new Error('PIN must be exactly 4 digits');
    }
    return `${normalized}00`;
}
