# Native Unity purchases

The Unity client already calls authenticated `POST /shop/iap/verify`. The payment
service now implements that contract and adds Apple/Google product IDs to
`GET /shop/catalog`. Existing Stripe checkout is unchanged. Both native payment
availability flags remain false unless that platform is explicitly enabled.

| Coins | Apple consumable | Google one-time consumable | MYR base price |
|---|---|---|---|
| 500 | my.lepakmamak.syiling500 | syiling_500 | 5.00 |
| 1200 | my.lepakmamak.syiling1200 | syiling_1200 | 10.00 |
| 3000 | my.lepakmamak.syiling3000 | syiling_3000 | 20.00 |

These IDs are prepared in code; this does not create products in either console.
App/package ID is `my.lepakmamak.client`. Store prices/localizations must be created
there. The client displays store-provided localized prices.

## Server setup

Apply `20260921160000_native_store_topups.sql` through the existing migration
workflow after checking the linked database. It adds a service-role-only receipt
ledger and atomic wallet-credit RPC. Raw tokens and JWS are not stored or logged.
The hashed transaction claim survives account deletion and rejects another owner.
A failed credit rolls the claim back; a lost HTTP response can be retried safely.

Set secrets only on the payment server, never in Unity, Git or `VITE_*`:

- `APPLE_IAP_ENABLED=true`, `APPLE_IAP_ENVIRONMENT=Production`,
  `APPLE_IAP_APP_ID` (numeric App Store Connect app ID), `APPLE_IAP_KEY_ID`,
  `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_PRIVATE_KEY` (In-App Purchase API key PEM;
  literal `\n` is supported). The official Apple library checks signed evidence,
  certificate revocation, bundle/environment, and fresh Server API transaction
  status before granting coins. The bundled G3 root is Apple's public certificate,
  downloaded from https://www.apple.com/certificateauthority/AppleRootCA-G3.cer.
- `GOOGLE_IAP_ENABLED=true`, `GOOGLE_IAP_ENVIRONMENT=Production`,
  `GOOGLE_IAP_SERVICE_ACCOUNT_JSON`: an existing authorized service-account JSON
  credential with access to this app's purchases in Play Console and the Android
  Publisher API enabled. Google's API, not the client receipt, supplies the payment
  state, product, quantity, refund state and obfuscated account binding.

Use `Sandbox` environments on a separate test server/database for sandbox and
Google license-test purchases. Production rejects test purchases. Do not switch a
live player wallet database to Sandbox. TestFlight/review sandbox routing needs a
verified isolated tester setup before submission; this change does not supply one.

The client consumes/finishes purchases only after the RPC commits and the server
returns full inventory. A server/credential error returns 503 and leaves the order
pending. Configure refund notifications/reconciliation and unacknowledged-purchase
monitoring before launch; those operational workflows are not implemented here.
Do not enable sales or advertise live billing before end-to-end sandbox tests pass.

## Checks

`node --test tests/iap.test.mjs tests/unity-origin.test.mjs` covers account/app/product
binding, quantity, refund and environment rejection, disabled configuration,
forged Apple JWS, authentication, rate limits, and lost-response recovery.

Run `supabase/tests/native-store-topups.sql` with `psql -v ON_ERROR_STOP=1` only on
an isolated migrated test database. It creates fixture users inside a rolled-back
transaction and checks actual SQL idempotency, ownership/product rejection, rollback,
deleted-user replay and restricted grants. Also test concurrent requests against
PostgreSQL and real store transactions before release.

Sources: [Apple server library](https://github.com/apple/app-store-server-library-node),
[Google purchase verification](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2/getproductpurchasev2),
[Google purchase fields](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2).
