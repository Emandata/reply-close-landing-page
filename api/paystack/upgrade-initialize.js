const {
  APP_UPGRADE_AMOUNT_KOBO,
  APP_UPGRADE_PRODUCT,
  createReference,
  getSecretKey,
  json,
  siteUrl,
  verifyPurchaseTransaction,
} = require('../../lib/paystack');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  try {
    // The first purchase is the source of truth for the customer's email and form answers.
    // A browser cannot choose a different address or invent an upgrade without a paid Guide.
    const guidePayment = await verifyPurchaseTransaction(req.body && req.body.guideReference);
    if (!guidePayment.ok || guidePayment.kind !== 'guide') {
      return json(res, 402, { error: 'Please confirm your Guide purchase before adding the App.' });
    }

    const email = String(guidePayment.customer && guidePayment.customer.email || '').trim().toLowerCase();
    const secretKey = getSecretKey();
    if (!email || !secretKey) return json(res, 503, { error: 'Secure checkout is not configured yet. Please try again shortly.' });

    const origin = siteUrl(req);
    const guideMetadata = guidePayment.metadata || {};
    const transaction = {
      email,
      amount: String(APP_UPGRADE_AMOUNT_KOBO),
      currency: 'NGN',
      reference: createReference('upgrade'),
      callback_url: `${origin}/payment-return.html`,
      metadata: JSON.stringify({
        product: APP_UPGRADE_PRODUCT,
        purchase_kind: 'app_upgrade',
        includes_app: true,
        guide_reference: guidePayment.reference,
        customer_email: email,
        first_name: guideMetadata.first_name || '',
        business_type: guideMetadata.business_type || '',
        weekly_enquiries: guideMetadata.weekly_enquiries || '',
        whatsapp_number: guideMetadata.whatsapp_number || '',
        replying_pain_point: guideMetadata.replying_pain_point || '',
        cancel_action: `${origin}/guide-access.html?reference=${encodeURIComponent(guidePayment.reference)}`,
      }),
    };

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
    const result = await response.json();
    if (!response.ok || !result.status || !result.data || !result.data.authorization_url) {
      return json(res, 502, { error: 'We could not start secure checkout. Please try again.' });
    }
    return json(res, 200, { authorizationUrl: result.data.authorization_url });
  } catch (error) {
    return json(res, 502, { error: 'We could not confirm your Guide purchase yet. Please try again.' });
  }
};
