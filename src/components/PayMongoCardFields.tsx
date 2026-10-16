import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { SavedCard } from './CardManager';
import type { PayMongoCard } from '../utils/paymongo';
import { digitsOnly, formatCardNumber, formatExpiry, luhnOk, parseExpiry } from '../utils/card';
import { fullName } from '../utils/format';

/**
 * The card form for PayMongo. What is typed here is sent to PayMongo only (from the browser, with the public key);
 * our API never sees it. `onChange` gets the card once every field is valid, otherwise null.
 */
export function PayMongoCardFields({
  onChange,
  saved,
}: {
  onChange: (card: PayMongoCard | null) => void;
  /** A saved card: its name and expiry are filled in. We never keep the full number or the code, so those are typed again. */
  saved?: SavedCard;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(saved?.holderName ?? (user ? fullName(user) : ''));
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState(saved ? `${String(saved.expMonth).padStart(2, '0')}/${String(saved.expYear).slice(-2)}` : '');
  const [cvc, setCvc] = useState('');

  useEffect(() => {
    const exp = parseExpiry(expiry);
    const sameCard = !saved || digitsOnly(number).endsWith(saved.last4);
    const ok = name.trim() && luhnOk(number) && sameCard && exp && /^\d{3,4}$/.test(cvc) && user?.email;
    onChange(
      ok && exp && user
        ? { name: name.trim(), email: user.email, number: digitsOnly(number), expMonth: exp.month, expYear: exp.year, cvc }
        : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, number, expiry, cvc, user, saved]);

  return (
    <>
      <label>
        Name on card
        <input required maxLength={60} autoComplete="cc-name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        <span title={saved ? 'We only keep the last four digits, so type the full number again.' : undefined}>
          Card number{saved && <span className="muted"> (type it again)</span>}
        </span>
        <input
          required
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder={saved ? `•••• •••• •••• ${saved.last4}` : '1234 5678 9012 3456'}
          value={number}
          onChange={(e) => setNumber(formatCardNumber(e.target.value))}
        />
      </label>
      <div className="card-pair">
        <label>
          Expiry (MM/YY)
          <input
            required
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            maxLength={5}
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
          />
        </label>
        <label>
          Security code
          <input
            required
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="123"
            maxLength={4}
            value={cvc}
            onChange={(e) => setCvc(digitsOnly(e.target.value).slice(0, 4))}
          />
        </label>
      </div>
      <span className="hint">Sent straight to PayMongo. We never see your card.</span>
    </>
  );
}
