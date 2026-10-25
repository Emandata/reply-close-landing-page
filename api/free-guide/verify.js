const { verifyGuideToken } = require('../../lib/free-guide');
const { json } = require('../../lib/paystack');

module.exports = (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  const claim = verifyGuideToken(req.query && req.query.token);
  if (!claim) return json(res, 401, { error: 'This Guide link is invalid or has expired. Please request the free bundle again.' });
  return json(res, 200, { valid: true, email: claim.email });
};
