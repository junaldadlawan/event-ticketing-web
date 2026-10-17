import { useCallback, useEffect, useState } from 'react';
import { gatewayFeeApi } from '../api/endpoints';
import type { Money } from '../api/types';

/** The newest paid payment whose gateway fee is not what the saved fee setting would charge. */
export interface GatewayFeeAlert {
  paymentId: string;
  paidAt: string | null;
  /** What the gateway really charged. */
  charged: Money;
  /** What the saved setting would have charged on the same payment. */
  expected: Money;
  /** expected - charged: negative means the setting charges less than the gateway took. */
  difference: Money;
}

const EVERY_MS = 5 * 60_000;
/** Fired on window after the gateway fee is saved, so the bell looks again right away. */
export const GATEWAY_FEE_SAVED = 'gateway-fee-saved';

/**
 * Asks the API how the newest payment's gateway fee compares with the saved fee (GET /payment-gateway-fee/check), now,
 * every five minutes, and when the tab comes back into view. `null` means they match, there is no payment yet, or the
 * check could not be read. Meant for admins: the check is admin only.
 */
export function useGatewayFeeAlert(enabled: boolean) {
  const [alert, setAlert] = useState<GatewayFeeAlert | null>(null);

  const read = useCallback(async () => {
    try {
      const check = await gatewayFeeApi.check(1);
      const s = check.samples[0];
      setAlert(
        s && !s.matchesConfigured
          ? { paymentId: s.paymentId, paidAt: s.paidAt, charged: s.totalFee, expected: s.expectedWithConfigured, difference: s.differenceFromConfigured }
          : null,
      );
    } catch {
      // PayMongo unreachable, or not an admin: no notification rather than a false one
      setAlert(null);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAlert(null);
      return;
    }
    void read();
    const timer = setInterval(() => void read(), EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && void read();
    document.addEventListener('visibilitychange', onVisible);
    const onSaved = () => void read();
    window.addEventListener(GATEWAY_FEE_SAVED, onSaved);
    return () => {
      window.removeEventListener(GATEWAY_FEE_SAVED, onSaved);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, read]);

  return { alert, recheck: read };
}
