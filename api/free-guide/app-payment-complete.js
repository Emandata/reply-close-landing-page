const { verifyPurchaseTransaction } = require('../../lib/paystack');
const { findAwaitingAppPaymentByEmail, updateSignup } = require('../../lib/free-guide-leads');
const { json } = require('../../lib/paystack');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });
  try {
    const payment = await verifyPurchaseTransaction(req.body && req.body.reference);
    const email = payment && payment.customer && payment.customer.email;
    const claimId = payment && payment.metadata && payment.metadata.free_guide_claim_id;
    if (!payment.ok || payment.kind !== 'app') return json(res, 200, { saved: false });
    if (claimId) {
      await updateSignup(claimId, { app_payment_confirmed_at: new Date().toISOString() });
    } else {
      // Supports any free-Guide checkout started before this tracking field was added.
      const signup = await findAwaitingAppPaymentByEmail(email);
      if (!signup.ok || !signup.row) return json(res, 200, { saved: false });
      await updateSignup(signup.row.id, { app_payment_confirmed_at: new Date().toISOString() });
    }
    return json(res, 200, { saved: true });
  } catch (error) {
    console.error('Free Guide App-payment confirmation could not be stored.', { error: error && error.message });
    return json(res, 200, { saved: false });
  }
};
