const { verifyGuideToken } = require('../../lib/free-guide');
const { updateSignup } = require('../../lib/free-guide-leads');
const { json } = require('../../lib/paystack');

const REASONS = new Set(['Price', 'Not right now', 'Not sure it fits my business', 'I just wanted the file', 'Other']);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  const claim = verifyGuideToken(req.body && req.body.token);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  const otherText = typeof req.body?.otherText === 'string' ? req.body.otherText.trim().slice(0, 240) : '';
  if (!claim) return json(res, 401, { error: 'This Guide link is invalid or has expired.' });
  if (!REASONS.has(reason)) return json(res, 400, { error: 'Please choose what held you back.' });

  try {
    if (claim.claimId) await updateSignup(claim.claimId, {
      declined_reason: reason,
      declined_other_text: reason === 'Other' ? otherText || null : null,
      declined_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Free Guide decline could not be stored.', { error: error && error.message });
  }
  return json(res, 200, { saved: true });
};
