const { json, pricing, verifyPurchaseTransaction } = require('../../lib/paystack');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });

  try {
    const payment = await verifyPurchaseTransaction(req.query.reference);
    if (payment.configurationError) {
      return json(res, 503, { error: 'Payment verification is not configured yet.' });
    }
    if (!payment.ok) {
      return json(res, 402, { error: 'We could not confirm this payment.' });
    }
    return json(res, 200, { paid: true, reference: payment.reference, kind: payment.kind, amountNaira: payment.amountNaira, customer: payment.customer, pricing: pricing() });
  } catch (error) {
    return json(res, 502, { error: 'We could not confirm this payment yet. Please try again.' });
  }
};
