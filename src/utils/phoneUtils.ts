import { Member } from '../types';

/**
 * Normalizes phone numbers to canonical E.164 format.
 * Specifically handles Nigerian mobile numbers:
 * - 09035123456 -> +2349035123456 (leading 0 removed, +234 added)
 * - 2349035123456 -> +2349035123456
 * - 9035123456 -> +2349035123456
 * - +2349035123456 -> +2349035123456
 * - Non-Nigerian international numbers (e.g. +1..., +44...) are preserved.
 */
export function normalizePhoneNumber(raw: string, defaultCountryCode = '+234'): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Remove spaces, hyphens, brackets, and any non-digit except a leading '+'
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return '';

  if (hasPlus) {
    // If it's a Nigerian number with a redundant 0 after country code, e.g. +234090...
    if (digitsOnly.startsWith('2340') && digitsOnly.length === 14) {
      return '+234' + digitsOnly.slice(4);
    }
    return '+' + digitsOnly;
  }

  // If starts with '234' and has 13 or 14 digits
  if (digitsOnly.startsWith('234')) {
    if (digitsOnly.startsWith('2340') && digitsOnly.length === 14) {
      return '+234' + digitsOnly.slice(4);
    }
    if (digitsOnly.length === 13) {
      return '+' + digitsOnly;
    }
  }

  // Standard Nigerian 11-digit local mobile number starting with 0 (e.g. 080..., 090..., 070...)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    return defaultCountryCode + digitsOnly.slice(1);
  }

  // 10-digit Nigerian mobile without the leading 0 (e.g. 9035123456, 8023456789)
  if (digitsOnly.length === 10 && /^[789]\d{9}$/.test(digitsOnly)) {
    return defaultCountryCode + digitsOnly;
  }

  // If looks like an international number without plus (e.g. length > 11)
  if (digitsOnly.length > 10) {
    return '+' + digitsOnly;
  }

  return digitsOnly;
}

/**
 * Formats a phone number for clean human readability in the UI
 * e.g. +234 903 512 3456
 */
export function formatPhoneNumberDisplay(phone: string): string {
  if (!phone) return '';
  const normalized = normalizePhoneNumber(phone);
  if (normalized.startsWith('+234') && normalized.length === 14) {
    return `+234 ${normalized.slice(4, 7)} ${normalized.slice(7, 10)} ${normalized.slice(10)}`;
  }
  return normalized || phone;
}

/**
 * Checks if a member with the same normalized phone number already exists
 * in the roster (excluding the current member being edited, if applicable).
 */
export function findDuplicateMemberByPhone(
  members: Member[],
  newPhone: string,
  excludeMemberId?: string
): Member | null {
  if (!newPhone) return null;
  const targetNorm = normalizePhoneNumber(newPhone);
  if (!targetNorm || targetNorm.length < 8) return null;

  for (const m of members) {
    if (excludeMemberId && m.id === excludeMemberId) continue;
    if (!m.phone) continue;
    const existingNorm = normalizePhoneNumber(m.phone);
    if (existingNorm && existingNorm === targetNorm) {
      return m;
    }
  }

  return null;
}

/**
 * Extracts pure international digits for WhatsApp links.
 * Normalizes Nigerian mobile numbers to 234XXXXXXXXXX format.
 * Strips '+' and any non-digits.
 * e.g. '07035620537' -> '2347035620537'
 * e.g. '+234 703 562 0537' -> '2347035620537'
 */
export function getWhatsAppPhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  const normalized = normalizePhoneNumber(phone);
  const digits = normalized.replace(/\D/g, '');
  // Valid Nigerian phone digits should be at least 10 digits
  return digits.length >= 10 ? digits : '';
}

/**
 * Builds a direct-to-DM WhatsApp URL:
 * - If phone is valid, returns https://wa.me/<digits>?text=<encoded>
 * - If phone is empty/invalid, falls back to https://wa.me/?text=<encoded>
 */
export function buildWhatsAppDirectLink(phone?: string | null, message?: string): string {
  const digits = getWhatsAppPhoneDigits(phone);
  const encodedText = message ? encodeURIComponent(message) : '';
  if (digits) {
    return encodedText ? `https://wa.me/${digits}?text=${encodedText}` : `https://wa.me/${digits}`;
  }
  return encodedText ? `https://wa.me/?text=${encodedText}` : `https://wa.me/`;
}

export const normalizeNigerianPhone = normalizePhoneNumber;
