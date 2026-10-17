// The same character rules the API enforces for names and emails (BR-AUTH-010), so a mistake is caught before the
// request is sent. The API stays the authority: it answers 400 with the same wording if something slips through.

// Starts with a letter (any language), then letters, accents, spaces, '.', apostrophes and '-'.
const NAME_RE = /^\p{L}[\p{L}\p{M} .'’-]*$/u;
// Plain ASCII: letters, digits and . _ % + - before the @ (never doubled, starting and ending with a letter or digit).
const EMAIL_RE = /^[A-Za-z0-9]+([._%+-][A-Za-z0-9]+)*@([A-Za-z0-9]+(-[A-Za-z0-9]+)*\.)+[A-Za-z]{2,}$/;

export function nameError(name: string, label = 'Name'): string | null {
  return NAME_RE.test(name.trim())
    ? null
    : `${label} may only contain letters, spaces, '.', apostrophes and '-', and must start with a letter.`;
}

export function emailError(email: string): string | null {
  return EMAIL_RE.test(email.trim())
    ? null
    : 'Enter a valid email address using only letters, digits and . _ % + - (for example name@example.com).';
}

// Same rules as the API: an international number (+, then 8 to 15 digits, the first not 0), or nothing.
const PHONE_RE = /^\+[1-9][0-9]{7,14}$/;

export function phoneError(phone: string): string | null {
  const t = phone.trim();
  return !t || PHONE_RE.test(t)
    ? null
    : 'Phone number must start with + and the country code, then 8 to 15 digits in total and nothing else (for example +639171234567).';
}

/** The latest date a birthdate can be: yesterday (it must be in the past). */
export function latestBirthDate(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

/** Past, and no more than 120 years ago (as the API checks). */
export function birthDateError(value: string): string | null {
  if (!value) return 'Enter your birthdate.';
  if (value > latestBirthDate()) return 'Birthdate must be in the past.';
  const oldest = new Date();
  oldest.setFullYear(oldest.getFullYear() - 120);
  return value < oldest.toISOString().slice(0, 10) ? "Birthdate can't be more than 120 years ago." : null;
}
