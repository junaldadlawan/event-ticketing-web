import { paymentMethodApi } from '../api/endpoints';
import { CardManager } from '../components/CardManager';
import { ProfileTabs } from '../components/ProfileTabs';
import { CARD_SAVING_AVAILABLE, PAYMONGO_PUBLIC_KEY, STRIPE_PUBLISHABLE_KEY } from '../config';

/** A customer's Payment page (next to Profile): the cards they pay with. */
export function CustomerPaymentPage() {
  return (
    <ProfileTabs>
      <h1>Payment</h1>
      <CardManager
        calls={paymentMethodApi}
        canEdit
        intro="Cards you can pay with at checkout. The primary card is used first."
        // With PayMongo, a saved card must be vaulted by PayMongo (a PayMongo account setting), so adding one is a future feature.
        comingSoon={Boolean(PAYMONGO_PUBLIC_KEY) && !CARD_SAVING_AVAILABLE}
        emptyText={PAYMONGO_PUBLIC_KEY && !CARD_SAVING_AVAILABLE ? 'No saved cards. Saving a card is coming soon.' : 'No card yet. Add one to pay faster.'}
        stripe={
          // With PayMongo on, the API saves cards without Stripe (its setup intent is a mock), so use the plain form.
          STRIPE_PUBLISHABLE_KEY && !PAYMONGO_PUBLIC_KEY
            ? { publishableKey: STRIPE_PUBLISHABLE_KEY, clientSecret: async () => (await paymentMethodApi.setupIntent()).clientSecret }
            : undefined
        }
      />
    </ProfileTabs>
  );
}
