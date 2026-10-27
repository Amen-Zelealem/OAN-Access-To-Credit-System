/** Local mobile number digits, excluding any country/dial code prefix. */
export const PHONE_NUMBER_LENGTH = 9;

export const PHONE_NUMBER_REGEX = /^\d{9}$/;

/** Strips every non-digit character (spaces, dashes, parens, `+`, letters). */
export function toDigitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Drops a single leading trunk `0` from a local number before it's
 * concatenated with a country/dial code (e.g. domestic "0911000000" ->
 * "911000000" so "+251" + result is valid E.164, not "+2510911000000").
 * Only one `0` is stripped — the field is capped at 9 digits, so a
 * valid local number never starts with a trunk 0.
 */
export function stripLeadingZero(digits: string): string {
  return digits.replace(/^0/, '');
}

/** Dial codes used anywhere in the app's registration/registration-adjacent forms. */
export const KNOWN_COUNTRY_CODES = ['+251', '+255', '+254', '+256', '+250', '+1'];

/**
 * Splits an already-combined phone number (e.g. "+251912345678", as stored
 * by registration) into its dial code and local digits, so a field with no
 * country-code selector of its own can still edit just the local part
 * without corrupting the prefix.
 *
 * Two different fallbacks when the value doesn't start with a known code:
 * - No `+` at all: legacy data saved as a bare domestic number (e.g.
 *   "0911000000") — the leading trunk 0 is stripped, matching every other
 *   form's local-digits convention, so displaying it as "+251" + local
 *   digits doesn't imply one digit too many.
 * - A `+` followed by an unrecognized code: an actually-foreign number this
 *   app doesn't have a flag/option for. There's no way to know where its
 *   dial code ends, so it's kept opaque rather than guessing which digits
 *   are "local" — stripping a leading 0 here could remove a real digit.
 */
export function splitPhoneNumber(value: string): { countryCode: string; localDigits: string } {
  const trimmed = value.trim();
  const countryCode = KNOWN_COUNTRY_CODES.find((code) => trimmed.startsWith(code));
  if (countryCode) {
    return { countryCode, localDigits: toDigitsOnly(trimmed.slice(countryCode.length)) };
  }
  if (trimmed.startsWith('+')) {
    return { countryCode: '+251', localDigits: toDigitsOnly(trimmed) };
  }
  return { countryCode: '+251', localDigits: stripLeadingZero(toDigitsOnly(trimmed)) };
}

/** Longest phone-style login identifier: "+251" plus 9 local digits plus a trunk 0 slip. */
const LOGIN_PHONE_MAX_DIGITS = 13;

/** Caps phone-style (no `@`) login input to a sane digit count; emails pass through. */
export function normalizeLoginIdentifierInput(value: string): string {
  if (value.includes('@') || /[a-z]/i.test(value)) return value;
  let digits = 0;
  let out = '';
  for (const ch of value) {
    if (/\d/.test(ch)) {
      if (digits >= LOGIN_PHONE_MAX_DIGITS) continue;
      digits += 1;
    }
    out += ch;
  }
  return out;
}

/** Login identifier is an email, or a phone whose local part is exactly PHONE_NUMBER_LENGTH digits. */
export function isValidLoginIdentifier(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.includes('@') || /[a-z]/i.test(v)) return true;
  const digits = toDigitsOnly(v);
  const local = v.startsWith('+') ? digits.replace(/^251/, '') : stripLeadingZero(digits.replace(/^251(?=\d{9}$)/, ''));
  return PHONE_NUMBER_REGEX.test(local);
}
