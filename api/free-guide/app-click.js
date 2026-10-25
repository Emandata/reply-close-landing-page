const { verifyGuideToken } = require('../../lib/free-guide');
const { updateSignup } = require('../../lib/free-guide-leads');
const { json } = require('../../lib/paystack');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  const claim = verifyGuideToken(req.body && req.body.token);
  if (!claim) return json(res, 401, { error: 'This Guide link is invalid or has expired.' });
  try {
    if (claim.claimId) await updateSignup(claim.claimId, { app_unlock_clicked_at: new Date().toISOString() });
  } catch (error) {
    console.error('Free Guide App click could not be stored.', { error: error && error.message });
  }
  return json(res, 200, { saved: true });
};
