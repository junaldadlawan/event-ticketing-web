import { useState } from 'react';
import { COUNTRIES, guessCountry, splitPhone } from '../utils/countries';

/**
 * A phone number as a country-code dropdown plus the number. The code starts on the country the browser says the
 * user is in. `value` / `onChange` use the international form the API wants (+639171234567), or '' when empty.
 */
export function PhoneField({
  value,
  onChange,
  placeholder = '917 123 4567',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [guess] = useState(guessCountry);
  const [iso, setIso] = useState(() => splitPhone(value, guess)?.iso ?? guess);
  const [national, setNational] = useState(() => splitPhone(value, guess)?.national ?? '');
  const dial = COUNTRIES.find((c) => c.iso === iso)?.dial ?? '';

  function emit(nextIso: string, nextNational: string) {
    const code = COUNTRIES.find((c) => c.iso === nextIso)?.dial ?? '';
    onChange(nextNational ? `+${code}${nextNational}` : '');
  }

  return (
    <div className="phone-row">
      {/* The closed box is short ("PH +63"); the real dropdown sits invisibly on top and lists the full names. */}
      <div className="phone-code">
        <span aria-hidden="true">
          {iso} +{dial}
        </span>
        <select
          value={iso}
          aria-label="Country code"
          autoComplete="country"
          onChange={(e) => {
            setIso(e.target.value);
            emit(e.target.value, national);
          }}
        >
          {COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.name} (+{c.dial})
            </option>
          ))}
        </select>
      </div>
      <div className="phone-number">
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-label="Phone number"
          placeholder={placeholder}
          maxLength={15}
          value={national}
          onChange={(e) => {
            // digits only, and no leading 0 (09171234567 -> 9171234567: the code replaces it)
            const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
            setNational(digits);
            emit(iso, digits);
          }}
        />
      </div>
    </div>
  );
}
