const crypto = require('crypto');

// These are the only price inputs for this funnel. Amounts sent to Paystack
// are derived from them, so changing the guide price updates the upgrade too.
const GUIDE_PRICE = 2500;
const APP_BUNDLE_PRICE = 25000;
const APP_UPGRADE_PRICE = APP_BUNDLE_PRICE - GUIDE_PRICE;
const GUIDE_AMOUNT_KOBO = GUIDE_PRICE * 100;
const APP_UPGRADE_AMOUNT_KOBO = APP_UPGRADE_PRICE * 100;
const APP_AMOUNT_KOBO = APP_BUNDLE_PRICE * 100;
const GUIDE_PRODUCT = '24/7 Sales Engine Guide + Interactive Workbook';
const APP_UPGRADE_PRODUCT = 'Sales Engine App upgrade';
const APP_PRODUCT = 'Sales Engine App';

function pricing() {
  return { guidePrice: GUIDE_PRICE, appBundlePrice: APP_BUNDLE_PRICE, appUpgradePrice: APP_UPGRADE_PRICE, appPrice: APP_BUNDLE_PRICE };
}

function json(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  return `${protocol}://${req.headers.host}`;
}

function getSecretKey() {
  return process.env.PAYSTACK_SECRET_KEY;
}

function requestIp(req) {
  const forwarded = String(req && req.headers && req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req && req.headers && (req.headers['x-real-ip'] || req.headers['x-vercel-forwarded-for']) || '').trim();
}

function createReference(kind = 'purchase') { return `${kind}-${Date.now()}-${crypto.randomUUID().replace(/-/g, '')}`; }

function isValidReference(reference) { return typeof reference === 'string' && /^(guide|upgrade|app)-[A-Za-z0-9.=\-]{12,}$/.test(reference); }

function parsedMetadata(value) {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value && typeof value === 'object' ? value : null;
}

function isTrue(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

async function verifyPurchaseTransaction(reference) {
  const secretKey = getSecretKey();
  if (!secretKey) return { ok: false, configurationError: true };
  if (!isValidReference(reference)) return { ok: false, reason: 'invalid_reference' };

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const result = await response.json();
  const transaction = result && result.data;
  const metadata = parsedMetadata(transaction && transaction.metadata);
  const amount = Number(transaction && transaction.amount);
  const isGuide = amount === GUIDE_AMOUNT_KOBO && metadata && metadata.product === GUIDE_PRODUCT;
  const isAppUpgrade = amount === APP_UPGRADE_AMOUNT_KOBO && metadata && metadata.product === APP_UPGRADE_PRODUCT && metadata.guide_reference;
  // Paystack can return metadata values as strings even though we sent JSON.
  // Keep every payment safeguard, but normalise that harmless representation
  // so a genuine App payment is not rejected after checkout.
  const isApp = amount === APP_AMOUNT_KOBO && metadata && metadata.product === APP_PRODUCT && metadata.purchase_kind === 'app' && isTrue(metadata.includes_app);
  const isPaid = Boolean(
    response.ok && result.status === true && transaction && transaction.status === 'success' &&
    transaction.currency === 'NGN' && transaction.reference === reference && (isGuide || isAppUpgrade || isApp)
  );
  if (!isPaid) return { ok: false, reason: 'not_paid' };
  return {
    ok: true,
    reference: transaction.reference,
    kind: isGuide ? 'guide' : 'app',
    amountNaira: amount / 100,
    paidAt: transaction.paid_at || null,
    customer: { email: transaction.customer && transaction.customer.email, firstName: transaction.customer && transaction.customer.first_name },
    metadata,
  };
}

module.exports = { GUIDE_PRICE, APP_BUNDLE_PRICE, APP_UPGRADE_PRICE, GUIDE_AMOUNT_KOBO, APP_UPGRADE_AMOUNT_KOBO, APP_AMOUNT_KOBO, GUIDE_PRODUCT, APP_UPGRADE_PRODUCT, APP_PRODUCT, createReference, getSecretKey, json, pricing, requestIp, siteUrl, verifyPurchaseTransaction };
