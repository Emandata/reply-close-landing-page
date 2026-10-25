const {
  APP_AMOUNT_KOBO,
  APP_PRODUCT,
  createReference,
  getSecretKey,
  json,
  requestIp,
  siteUrl,
} = require('../../lib/paystack');
const { verifyGuideToken } = require('../../lib/free-guide');

function clean(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  const claim = verifyGuideToken(req.body && req.body.token);
  if (!claim) return json(res, 401, { error: 'Your free Guide link has expired. Please request the bundle again.' });
  const secretKey = getSecretKey();
  if (!secretKey) return json(res, 503, { error: 'Secure checkout is not configured yet. Please try again shortly.' });

  const origin = siteUrl(req);
  const fbp = clean(req.body && req.body.fbp, 500);
  const fbc = clean(req.body && req.body.fbc, 500);
  const eventSourceUrl = clean(req.body && req.body.eventSourceUrl, 2000);
  const clientUserAgent = clean(req.body && req.body.clientUserAgent, 1000);
  const transaction = {
    email: claim.email,
    amount: String(APP_AMOUNT_KOBO),
    currency: 'NGN',
    reference: createReference('app'),
    callback_url: `${origin}/payment-return.html`,
    metadata: JSON.stringify({
      product: APP_PRODUCT,
      purchase_kind: 'app',
      includes_app: true,
      customer_email: claim.email,
      free_guide_claim: true,
      // Tracking-only link back to this free Guide signup. It does not change checkout or App access.
      free_guide_claim_id: claim.claimId || '',
      fbp,
      fbc,
      event_source_url: eventSourceUrl || `${origin}/upsell.html`,
      client_ip_address: requestIp(req),
      client_user_agent: clientUserAgent || String(req.headers['user-agent'] || '').slice(0, 1000),
      cancel_action: `${origin}/upsell.html?token=${encodeURIComponent(req.body.token)}`,
    }),
  };

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
    const result = await response.json();
    if (!response.ok || !result.status || !result.data || !result.data.authorization_url) return json(res, 502, { error: 'We could not start secure checkout. Please try again.' });
    return json(res, 200, { authorizationUrl: result.data.authorization_url });
  } catch (error) {
    return json(res, 502, { error: 'We could not reach secure checkout. Please try again.' });
  }
};
