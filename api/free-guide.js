const fs = require('fs');
const path = require('path');
const { createGuideToken, GUIDE_FILE_NAME, sendGuideEmail, verifyGuideToken } = require('../lib/free-guide');
const { json, siteUrl, verifyPurchaseTransaction } = require('../lib/paystack');
const { claimId, createSignup, listSignups, markAppPaymentConfirmed, updateSignup } = require('../lib/free-guide-leads');

const BUSINESS_TYPES = new Set([
  'Food and drinks', 'Fashion, shoes and bags', 'Beauty, skincare, hair and perfumes',
  'Health and wellness products', 'Home, kitchen and cleaning products',
  'Phones, gadgets and electronics', 'Logistics and delivery', 'Other services',
  'Digital products and courses', 'Other',
]);
const WEEKLY_VOLUMES = new Set(['', 'Under 10', '10-30', '30-100', '100+']);
const REASONS = new Set(['Price', 'Not right now', 'Not sure it fits my business', 'I just wanted the file', 'Other']);

function clean(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function tally(rows, key, fallback = 'Not answered') {
  return rows.reduce((counts, row) => {
    const value = row[key] || fallback;
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

async function claim(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  const email = clean(req.body && req.body.email, 254).toLowerCase();
  const businessType = clean(req.body && req.body.businessType, 80);
  const otherBusinessType = clean(req.body && req.body.otherBusinessType, 80);
  const weeklyMessageVolume = clean(req.body && req.body.weeklyMessageVolume, 30);
  const whatsAppNumber = clean(req.body && req.body.whatsAppNumber, 30);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'Please enter a valid email address.' });
  if (!BUSINESS_TYPES.has(businessType)) return json(res, 400, { error: 'Please tell us what you sell.' });
  if (businessType === 'Other' && !otherBusinessType) return json(res, 400, { error: 'Please tell us what you sell.' });
  if (!WEEKLY_VOLUMES.has(weeklyMessageVolume)) return json(res, 400, { error: 'Please choose one weekly volume option.' });

  const id = claimId();
  const token = createGuideToken(email, id);
  if (!token) return json(res, 503, { error: 'Free Guide email is not configured yet. Please try again shortly.' });
  const accessUrl = `${siteUrl(req)}/guide-access.html?token=${encodeURIComponent(token)}`;
  try {
    const stored = await createSignup({
      id, email, business_type: businessType === 'Other' ? `Other — ${otherBusinessType}` : businessType, weekly_message_volume: weeklyMessageVolume || null,
      whatsapp_number: whatsAppNumber || null, whatsapp_contact_consent: Boolean(whatsAppNumber),
    });
    if (!stored.ok && !stored.configurationError) console.error('Free Guide signup was not stored.', { email });
    // Direct-download mode works before email delivery is configured. Once Resend
    // is added later, the same request also emails the buyer their private link.
    const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
    if (emailConfigured) {
      // The browser journey must not depend on a third-party email request. The
      // buyer gets their signed link immediately; email is only a helpful backup.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      try {
        const delivery = await sendGuideEmail({ email, accessUrl, signal: controller.signal });
        if (!delivery.ok) console.error('Free Guide email failed.', { status: delivery.status, body: delivery.body });
      } catch (error) {
        console.error('Free Guide email failed.', { error: error && error.message });
      } finally {
        clearTimeout(timeout);
      }
    }
    return json(res, 200, { token, emailed: emailConfigured });
  } catch (error) {
    console.error('Free Guide email request failed.', { error: error && error.message });
    return json(res, 502, { error: 'We could not send your Guide email yet. Please try again.' });
  }
}

function verify(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  const result = verifyGuideToken(req.query && req.query.token);
  if (!result) return json(res, 401, { error: 'This Guide link is invalid or has expired. Please request the free bundle again.' });
  return json(res, 200, { valid: true, email: result.email });
}

function download(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed.');
  if (!verifyGuideToken(req.query && req.query.token)) return res.status(401).send('This Guide link is invalid or has expired.');
  try {
    const filePath = path.join(process.cwd(), 'private', 'sales-engine-guide-and-workbook.zip');
    if (!fs.existsSync(filePath)) return res.status(503).send('Your files are being prepared. Please try again shortly.');
    const file = fs.readFileSync(filePath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${GUIDE_FILE_NAME}"`);
    res.setHeader('Content-Length', file.length);
    return res.status(200).send(file);
  } catch (error) {
    return res.status(502).send('We could not prepare your download yet. Please try again.');
  }
}

async function decline(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  const result = verifyGuideToken(req.body && req.body.token);
  const reason = clean(req.body && req.body.reason, 80);
  const otherText = clean(req.body && req.body.otherText, 240);
  if (!result) return json(res, 401, { error: 'This Guide link is invalid or has expired.' });
  if (!REASONS.has(reason)) return json(res, 400, { error: 'Please choose what held you back.' });
  try {
    if (result.claimId) await updateSignup(result.claimId, {
      declined_reason: reason, declined_other_text: reason === 'Other' ? otherText || null : null,
      declined_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Free Guide decline could not be stored.', { error: error && error.message });
  }
  return json(res, 200, { saved: true });
}

async function appClick(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  const result = verifyGuideToken(req.body && req.body.token);
  if (!result) return json(res, 401, { error: 'This Guide link is invalid or has expired.' });
  try {
    if (result.claimId) await updateSignup(result.claimId, { app_unlock_clicked_at: new Date().toISOString() });
  } catch (error) {
    console.error('Free Guide App click could not be stored.', { error: error && error.message });
  }
  return json(res, 200, { saved: true });
}

async function appPaymentComplete(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  try {
    const payment = await verifyPurchaseTransaction(req.body && req.body.reference);
    const email = payment && payment.customer && payment.customer.email;
    const signupId = payment && payment.metadata && payment.metadata.free_guide_claim_id;
    if (!payment.ok || payment.kind !== 'app') return json(res, 200, { saved: false });
    const saved = await markAppPaymentConfirmed({ signupId, email, confirmedAt: payment.paidAt });
    return json(res, 200, { saved: Boolean(saved.ok) });
  } catch (error) {
    console.error('Free Guide App-payment confirmation could not be stored.', { error: error && error.message });
    return json(res, 200, { saved: false });
  }
}

async function report(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  const expectedKey = String(process.env.FREE_GUIDE_REPORT_KEY || '');
  if (!expectedKey || req.headers['x-free-guide-report-key'] !== expectedKey) return json(res, 401, { error: 'Private report access is required.' });
  try {
    const result = await listSignups();
    if (result.configurationError) return json(res, 503, { error: 'Lead reporting is not configured yet.' });
    if (!result.ok) return json(res, 502, { error: 'Lead reporting is temporarily unavailable.' });
    const rows = result.rows || [];
    const clicked = rows.filter(row => row.app_unlock_clicked_at);
    const awaitingPayment = clicked.filter(row => !row.app_payment_confirmed_at);
    return json(res, 200, {
      totals: { signups: rows.length, appUnlockClicks: clicked.length, appPaymentsConfirmed: clicked.length - awaitingPayment.length, appClicksAwaitingPayment: awaitingPayment.length },
      businessTypes: tally(rows, 'business_type'),
      weeklyVolumes: tally(rows, 'weekly_message_volume'),
      declineReasons: tally(rows.filter(row => row.declined_reason), 'declined_reason'),
      followUps: awaitingPayment.map(row => ({ email: row.email, whatsappNumber: row.whatsapp_number, businessType: row.business_type, weeklyMessageVolume: row.weekly_message_volume, clickedAt: row.app_unlock_clicked_at })),
    });
  } catch (error) {
    console.error('Free Guide report failed.', { error: error && error.message });
    return json(res, 502, { error: 'Lead reporting is temporarily unavailable.' });
  }
}

module.exports = async (req, res) => {
  const action = Array.isArray(req.query && req.query.action) ? req.query.action[0] : req.query && req.query.action;
  const routes = { claim, verify, download, decline, 'app-click': appClick, 'app-payment-complete': appPaymentComplete, report };
  const handler = routes[action];
  if (!handler) return json(res, 404, { error: 'Not found.' });
  return handler(req, res);
};
