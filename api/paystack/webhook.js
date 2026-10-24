const crypto = require('crypto');
const { getSecretKey, json, requestIp, siteUrl, verifyPurchaseTransaction } = require('../../lib/paystack');
const { sendGuidePurchase } = require('../../lib/meta-capi');

// Paystack supports one webhook URL. This endpoint reports Guide purchases to Meta,
// then relays App-upgrade events to the existing Lovable entitlement webhook.
const APP_WEBHOOK_URL = process.env.APP_PAYSTACK_WEBHOOK_URL || 'https://sale-engine.lovable.app/api/public/paystack-webhook';

module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function matchingSignature(rawBody, suppliedSignature, secret) {
  if (!suppliedSignature) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const supplied = Buffer.from(String(suppliedSignature), 'utf8');
  const calculated = Buffer.from(expected, 'utf8');
  return supplied.length === calculated.length && crypto.timingSafeEqual(supplied, calculated);
}

async function relayUpgrade(rawBody, signature) {
  const response = await fetch(APP_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
    body: rawBody,
  });
  if (!response.ok) throw new Error(`App webhook returned ${response.status}`);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  const secret = getSecretKey();
  if (!secret) return json(res, 503, { error: 'Webhook is not configured.' });

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['x-paystack-signature'];
    if (!matchingSignature(rawBody, signature, secret)) return json(res, 401, { error: 'Invalid webhook signature.' });

    const event = JSON.parse(rawBody.toString('utf8'));
    if (event.event !== 'charge.success' || !event.data || !event.data.reference) return json(res, 200, { received: true });

    const payment = await verifyPurchaseTransaction(event.data.reference);
    // A genuine Paystack event that does not belong to this funnel is safely ignored.
    if (!payment.ok) return json(res, 200, { received: true });

    if (payment.kind === 'guide') {
      // Best effort: CAPI failure is logged inside this helper and never rejects the payment.
      await sendGuidePurchase(payment, {
        clientIp: requestIp(req),
        clientUserAgent: String(req.headers['user-agent'] || ''),
        eventSourceUrl: `${siteUrl(req)}/payment-return.html`,
      });
    }

    if (payment.kind === 'app_upgrade') {
      // Preserve the existing App-unlock flow after moving Paystack's single webhook here.
      await relayUpgrade(rawBody, signature);
    }

    return json(res, 200, { received: true });
  } catch (error) {
    console.error('Paystack webhook processing failed.', { error: error && error.message });
    // Returning 500 asks Paystack to retry; buyers are never held on this endpoint.
    return json(res, 500, { error: 'Webhook processing failed.' });
  }
};
