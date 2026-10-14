import { paymentMethodApi } from '../api/endpoints';
import { CardManager } from '../components/CardManager';
import { ProfileTabs } from '../components/ProfileTabs';
import { STRIPE_PUBLISHABLE_KEY } from '../config';

/** A customer's Payment page (next to Profile): the cards they pay with. */
export function CustomerPaymentPage() {
  return (
    <ProfileTabs>
      <h1>Payment</h1>
      <CardManager
        calls={paymentMethodApi}
        canEdit
        intro="Cards you can pay with at checkout. The primary card is used first."
        emptyText="No card yet. Add one to pay faster."
        stripe={
          STRIPE_PUBLISHABLE_KEY
            ? { publishableKey: STRIPE_PUBLISHABLE_KEY, clientSecret: async () => (await paymentMethodApi.setupIntent()).clientSecret }
            : undefined
        }
      />
    </ProfileTabs>
  );
}
