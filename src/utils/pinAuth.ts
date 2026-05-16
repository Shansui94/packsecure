/** Company policy: login with 4-digit PIN; Auth password is PIN + "00". */

export function normalizeFourDigitPin(raw: string): string | null {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length !== 4) return null;
    return digits;
}

export function loginPasswordFromInput(input: string): string {
    const pin = normalizeFourDigitPin(input);
    if (pin) return `${pin}00`;
    return input;
}

export function pinToAuthPassword(pin: string): string {
    const normalized = normalizeFourDigitPin(pin);
    if (!normalized) {
        throw new Error('PIN must be exactly 4 digits');
    }
    return `${normalized}00`;
}
