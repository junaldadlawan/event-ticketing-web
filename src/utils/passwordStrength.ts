// A small, dependency-free password strength check. It only guides the user: the app requires 8 characters and the
// API accepts anything up to 255, so nothing here blocks a sign-up.
// shortcut: a short list of very common passwords, not a full dictionary; upgrade to a library such as zxcvbn if
// stronger guessing checks are needed.

const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwerty123', 'qwertyuiop',
  'iloveyou', 'admin123', 'welcome1', 'letmein1', 'abc12345', 'football', 'baseball', '11111111', '00000000',
  'monkey123', 'dragon123', 'sunshine', 'princess', 'passw0rd', 'p@ssw0rd', 'qazwsxedc', 'asdfghjkl',
]);

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

export interface PasswordReport {
  /** 0 = nothing typed yet, 1 weak ... 4 strong. */
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  /** One thing to do next, or null when there is nothing to add. */
  tip: string | null;
  checks: PasswordCheck[];
}

/** `avoid`: personal words (name, email) the password should not contain. */
export function checkPassword(password: string, avoid: string[] = []): PasswordReport {
  const long = password.length >= 8;
  const mixed = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const number = /\d/.test(password);
  const symbol = /[^A-Za-z0-9\s]/.test(password);
  const checks: PasswordCheck[] = [
    { label: 'At least 8 characters', ok: long },
    { label: 'Upper and lower case letters', ok: mixed },
    { label: 'A number', ok: number },
    { label: 'A symbol, like ! ? # %', ok: symbol },
  ];
  if (!password) return { level: 0, label: '', tip: null, checks };
  if (!long) return { level: 1, label: 'Too short', tip: 'Use at least 8 characters.', checks };

  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return { level: 1, label: 'Too easy to guess', tip: 'This is a very common password.', checks };
  const personal = avoid.map((w) => w.trim().toLowerCase()).find((w) => w.length >= 3 && lower.includes(w));
  if (personal) return { level: 1, label: 'Too easy to guess', tip: "Don't use your name or email in it.", checks };

  const points =
    1 + // 8+
    (password.length >= 12 ? 1 : 0) +
    (password.length >= 16 ? 1 : 0) +
    (password.length >= 20 ? 1 : 0) +
    (mixed ? 1 : 0) +
    (number ? 1 : 0) +
    (symbol ? 1 : 0);
  const level = points <= 2 ? 1 : points === 3 ? 2 : points === 4 ? 3 : 4;
  const label = ['', 'Weak', 'Fair', 'Good', 'Strong'][level]!;
  const tip =
    level === 4
      ? null
      : password.length < 12
        ? 'Longer is stronger: try 12 or more characters.'
        : !mixed
          ? 'Mix upper and lower case letters.'
          : !number
            ? 'Add a number.'
            : !symbol
              ? 'Add a symbol.'
              : 'Add a few more characters.';
  return { level: level as 1 | 2 | 3 | 4, label, tip, checks };
}
