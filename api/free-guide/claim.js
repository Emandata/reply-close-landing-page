const { createGuideToken, sendGuideEmail } = require('../../lib/free-guide');
const { json, siteUrl } = require('../../lib/paystack');
const { claimId, createSignup } = require('../../lib/free-guide-leads');

const BUSINESS_TYPES = new Set([
  'Food & foodstuff', 'Fashion & clothing', 'Beauty, perfumes & skincare', 'Hair & wigs',
  'Phones & gadgets', 'Home & household', 'Services', 'Courses or digital products', 'Other',
]);
const WEEKLY_VOLUMES = new Set(['', 'Under 10', '10-30', '30-100', '100+']);

function clean(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  const email = clean(req.body && req.body.email, 254).toLowerCase();
  const businessType = clean(req.body && req.body.businessType, 80);
  const weeklyMessageVolume = clean(req.body && req.body.weeklyMessageVolume, 30);
  const whatsAppNumber = clean(req.body && req.body.whatsAppNumber, 30);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'Please enter a valid email address.' });
  if (!BUSINESS_TYPES.has(businessType)) return json(res, 400, { error: 'Please tell us what you sell.' });
  if (!WEEKLY_VOLUMES.has(weeklyMessageVolume)) return json(res, 400, { error: 'Please choose one weekly volume option.' });

  const id = claimId();
  const token = createGuideToken(email, id);
  if (!token) return json(res, 503, { error: 'Free Guide email is not configured yet. Please try again shortly.' });

  const origin = siteUrl(req);
  const accessUrl = `${origin}/guide-access.html?token=${encodeURIComponent(token)}`;
  try {
    // Lead storage is useful but never prevents a person receiving their free Guide.
    const stored = await createSignup({
      id,
      email,
      business_type: businessType,
      weekly_message_volume: weeklyMessageVolume || null,
      whatsapp_number: whatsAppNumber || null,
      whatsapp_contact_consent: Boolean(whatsAppNumber),
    });
    if (!stored.ok && !stored.configurationError) console.error('Free Guide signup was not stored.', { email });
    const delivery = await sendGuideEmail({ email, accessUrl });
    if (delivery.configurationError) return json(res, 503, { error: 'Free Guide email is not configured yet. Please try again shortly.' });
    if (!delivery.ok) {
      console.error('Free Guide email failed.', { status: delivery.status, body: delivery.body });
      return json(res, 502, { error: 'We could not send your Guide email yet. Please try again.' });
    }
    return json(res, 200, { token });
  } catch (error) {
    console.error('Free Guide email request failed.', { error: error && error.message });
    return json(res, 502, { error: 'We could not send your Guide email yet. Please try again.' });
  }
};
