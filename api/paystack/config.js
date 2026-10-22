const { json, pricing } = require('../../lib/paystack');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  return json(res, 200, pricing());
};
