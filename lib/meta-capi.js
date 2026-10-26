const crypto = require('crypto');

const META_PIXEL_ID = '1570154944799546';
const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v25.0';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value).trim().toLowerCase()).digest('hex');
}

function usableUrl(value, fallback) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function paidTimestamp(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : Math.floor(Date.now() / 1000);
}

async function sendPurchase(payment, context = {}) {
  if (!payment || !payment.ok || !['guide', 'app'].includes(payment.kind)) return { skipped: true };

  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn('Meta CAPI skipped: META_CAPI_ACCESS_TOKEN is not configured.');
    return { skipped: true };
  }

  const metadata = payment.metadata || {};
  const email = String(payment.customer && payment.customer.email || metadata.customer_email || '').trim().toLowerCase();
  if (!email) {
    console.warn('Meta CAPI skipped: verified payment has no customer email.', { reference: payment.reference });
    return { skipped: true };
  }

  const userData = { em: [sha256(email)] };
  const fbp = String(metadata.fbp || '').trim();
  const fbc = String(metadata.fbc || '').trim();
  const clientIp = String(metadata.client_ip_address || context.clientIp || '').trim();
  const clientUserAgent = String(metadata.client_user_agent || context.clientUserAgent || '').trim();
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  if (clientIp) userData.client_ip_address = clientIp;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;

  const event = {
    event_name: 'Purchase',
    event_time: paidTimestamp(payment.paidAt),
    event_id: payment.reference,
    event_source_url: usableUrl(metadata.event_source_url, context.eventSourceUrl || ''),
    action_source: 'website',
    user_data: userData,
    custom_data: {
      value: payment.amountNaira,
      currency: 'NGN',
      content_name: payment.kind === 'app' ? 'Sales Engine App' : '24/7 Sales Engine Guide + Interactive Workbook',
      content_type: 'product',
    },
  };

  const payload = { data: [event], access_token: accessToken };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${META_PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      console.error('Meta CAPI Purchase failed.', { reference: payment.reference, status: response.status, body: body.slice(0, 1000) });
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error('Meta CAPI Purchase request failed.', { reference: payment.reference, error: error && error.message });
    return { sent: false };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { META_PIXEL_ID, sendPurchase };
