import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {AppStoreServerAPIClient, SignedDataVerifier, Environment, VerificationException, VerificationStatus} from '@apple/app-store-server-library';
import {GoogleAuth} from 'google-auth-library';
import packs from '../shared/currency-packs.json' with {type: 'json'};

export const nativePacks = packs.map(pack => ({...pack,
  appleProductId: `my.lepakmamak.syiling${pack.credits}`, googleProductId: `syiling_${pack.credits}`,
}));
const bundleId = 'my.lepakmamak.client';
const invalid = () => Object.assign(Error('Invalid purchase or account binding.'), {status: 400});
export const transactionHash = value => createHash('sha256').update(value).digest('hex');

export function validateApple(transaction, input, userId, environment) {
  if (transaction.bundleId !== bundleId || transaction.environment !== environment ||
      transaction.transactionId !== input.transactionId || transaction.productId !== input.productId ||
      transaction.type !== 'Consumable' || transaction.quantity !== 1 ||
      transaction.inAppOwnershipType !== 'PURCHASED' || transaction.revocationDate != null ||
      transaction.appAccountToken?.toLowerCase() !== userId.toLowerCase()) throw invalid();
}
export function validateGoogle(purchase, input, userId, environment) {
  const line = purchase.productLineItem?.[0];
  if (purchase.productLineItem?.length !== 1 || line?.productId !== input.productId ||
      line?.productOfferDetails?.quantity !== 1 || line.productOfferDetails.refundableQuantity !== 1 ||
      purchase.obfuscatedExternalAccountId !== transactionHash(userId) ||
      Boolean(purchase.testPurchaseContext) !== (environment === 'Sandbox')) throw invalid();
  if (purchase.purchaseStateContext?.purchaseState === 'PENDING')
    throw Object.assign(Error('Store payment is pending.'), {status: 202});
  if (purchase.purchaseStateContext?.purchaseState !== 'PURCHASED') throw invalid();
}

export function createIap(env = process.env) {
  let apple, google;
  const appleEnvironment = env.APPLE_IAP_ENVIRONMENT || Environment.PRODUCTION;
  const googleEnvironment = env.GOOGLE_IAP_ENVIRONMENT || 'Production';
  if (env.APPLE_IAP_ENABLED === 'true') {
    if (![Environment.PRODUCTION, Environment.SANDBOX].includes(appleEnvironment) ||
        !env.APPLE_IAP_PRIVATE_KEY || !env.APPLE_IAP_KEY_ID || !env.APPLE_IAP_ISSUER_ID ||
        (appleEnvironment === Environment.PRODUCTION && !/^[1-9]\d*$/.test(env.APPLE_IAP_APP_ID || '')))
      throw Error('Apple IAP configuration is incomplete.');
    const roots = [readFileSync(new URL('./certificates/AppleRootCA-G3.cer', import.meta.url))];
    apple = {
      verifier: new SignedDataVerifier(roots, true, appleEnvironment, bundleId, Number(env.APPLE_IAP_APP_ID) || undefined),
      api: new AppStoreServerAPIClient(env.APPLE_IAP_PRIVATE_KEY.replace(/\\n/g, '\n'), env.APPLE_IAP_KEY_ID,
        env.APPLE_IAP_ISSUER_ID, bundleId, appleEnvironment),
    };
  }
  if (env.GOOGLE_IAP_ENABLED === 'true') {
    if (!['Production', 'Sandbox'].includes(googleEnvironment) || !env.GOOGLE_IAP_SERVICE_ACCOUNT_JSON)
      throw Error('Google IAP configuration is incomplete.');
    const credentials = JSON.parse(env.GOOGLE_IAP_SERVICE_ACCOUNT_JSON);
    if (credentials.type !== 'service_account' || !credentials.client_email || !credentials.private_key)
      throw Error('Google IAP requires a service account.');
    google = new GoogleAuth({credentials, scopes: ['https://www.googleapis.com/auth/androidpublisher']});
  }
  return {
    applePaymentsAvailable: !!apple, googlePaymentsAvailable: !!google,
    async verify(input, userId) {
      if (!input || !['apple', 'google'].includes(input.store) || typeof input.transactionId !== 'string' ||
          !input.transactionId.length || input.transactionId.length > 4096) throw invalid();
      const pack = nativePacks.find(pack => pack[`${input.store}ProductId`] === input.productId);
      if (!pack) throw invalid();
      if (!(input.store === 'apple' ? apple : google))
        throw Object.assign(Error('Store payments are not configured.'), {status: 503});
      const environment = input.store === 'apple' ? appleEnvironment : googleEnvironment;
      if (input.store === 'apple') {
        if (!/^\d{1,64}$/.test(input.transactionId) || typeof input.jws !== 'string' || input.jws.length > 32768) throw invalid();
        // Verify the client proof, then fetch current store state so a revoked old JWS cannot mint coins.
        try { validateApple(await apple.verifier.verifyAndDecodeTransaction(input.jws), input, userId, environment); }
        catch (error) {
          if (error instanceof VerificationException && error.status !== VerificationStatus.RETRYABLE_VERIFICATION_FAILURE) throw invalid();
          throw error;
        }
        const current = await apple.api.getTransactionInfo(input.transactionId);
        validateApple(await apple.verifier.verifyAndDecodeTransaction(current.signedTransactionInfo), input, userId, environment);
      } else {
        // Client receipt JSON is not evidence. Query the configured app with Google's authenticated API.
        const client = await google.getClient();
        const {data} = await client.request({url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${bundleId}/purchases/productsv2/tokens/${encodeURIComponent(input.transactionId)}`,
          method: 'GET', timeout: 15000, retry: false});
        validateGoogle(data, input, userId, environment);
      }
      return {pack, environment};
    },
  };
}
