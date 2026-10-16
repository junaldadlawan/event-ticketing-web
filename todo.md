# To do

Ideas and features that are not built yet.

## Automatic gateway fee

- **Where:** Settings > Finance & Payouts > Gateway fee > Edit. The "Automatic (coming soon)" choice is shown but switched off.
- **What it should do:** keep the gateway fee in step with what PayMongo really charges, so nobody has to type the rate.
  The two card rates today are 3.5% + PHP 15.00 (local card) and 4.5% + PHP 15.00 (foreign card), VAT included.
- **What is missing:** the API has no automatic mode. `GET /payment-gateway-fee/check` only compares the saved fee with the
  latest paid payments and suggests a rate (`suggestedSetting`); `PUT /payment-gateway-fee` always saves fixed numbers.
  PayMongo publishes no endpoint for its rates.
- **To build it:**
  - API: a mode on the fee setting (for example `mode: AUTOMATIC | MANUAL`) that works out the fee per payment from the card
    type (local or foreign), or refreshes the saved rate from `/check` on a schedule; audit-log every change.
  - Web: switch the "Automatic" choice on, send the mode with the save, and show which rate was used (the "Latest payment" tag
    that the dialog used to show comes from `suggestedSetting.basedOn` in `gatewayFeeApi.check()`, which is still in
    `src/api/endpoints.ts`).

## Save a card for next time

- **Where:** the Checkout window in the cart ("Save this card for next time (coming soon)") and Profile > Payment ("Add card
  (coming soon)"). Both are shown but switched off while `CARD_SAVING_AVAILABLE` in `src/config.ts` is `false` and PayMongo is on.
- **What it should do:** keep the card the buyer pays with, so the next checkout asks only for the security code.
- **What is missing:** PayMongo rejects the save with "On session payments are not yet supported" because card vaulting is not
  enabled on the account (it is a PayMongo setting; Visa and Mastercard only). The API already sends the request when asked
  (`saveCard`), falls back to paying without saving, and reports `cardSaving: UNAVAILABLE`.
- **To build it:**
  - PayMongo: ask support to enable card vaulting (test mode as well as live).
  - Web: set `CARD_SAVING_AVAILABLE` to `true` (this switches on both places). Adding a card on Profile > Payment also needs an API
    way to vault a card without a payment (a PayMongo setup flow), which does not exist yet. Cards saved the old way (before one-step payments) have to be added again.
