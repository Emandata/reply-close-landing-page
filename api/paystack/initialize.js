const {
  GUIDE_AMOUNT_KOBO,
  GUIDE_PRODUCT,
  createReference,
  getSecretKey,
  json,
  requestIp,
  siteUrl,
} = require('../../lib/paystack');

function clean(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  const email = clean(req.body && req.body.email, 254).toLowerCase();
  const confirmEmail = clean(req.body && req.body.confirmEmail, 254).toLowerCase();
  const firstName = clean(req.body && req.body.firstName, 80);
  const businessType = clean(req.body && req.body.businessType, 80);
  const businessTypeOther = clean(req.body && req.body.businessTypeOther, 80);
  const weeklyEnquiries = clean(req.body && req.body.weeklyEnquiries, 30);
  const whatsAppNumber = clean(req.body && req.body.whatsAppNumber, 30);
  const replyPain = clean(req.body && req.body.replyPain, 500);
  const fbp = clean(req.body && req.body.fbp, 500);
  const fbc = clean(req.body && req.body.fbc, 500);
  const eventSourceUrl = clean(req.body && req.body.eventSourceUrl, 2000);
  const clientUserAgent = clean(req.body && req.body.clientUserAgent, 1000);
  const permittedBusinessTypes = new Set([
    'Food & foodstuff',
    'Fashion & clothing',
    'Beauty, perfumes & skincare',
    'Hair & wigs',
    'Phones & gadgets',
    'Home & household',
    'Services',
    'Courses or digital products',
    'Other',
  ]);
  const permittedWeeklyVolumes = new Set(['Under 10', '10–30', '30–100', '100+']);
  const resolvedBusinessType = businessType === 'Other' ? businessTypeOther : businessType;
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email !== confirmEmail ||
    !permittedBusinessTypes.has(businessType) || !resolvedBusinessType || !permittedWeeklyVolumes.has(weeklyEnquiries)
  ) {
    return json(res, 400, { error: 'Please complete every field with valid details.' });
  }

  const secretKey = getSecretKey();
  if (!secretKey) {
    return json(res, 503, { error: 'Checkout is not configured yet. Please try again shortly.' });
  }

  const reference = createReference('guide');
  const origin = siteUrl(req);
  const transaction = {
    email,
    amount: String(GUIDE_AMOUNT_KOBO),
    currency: 'NGN',
    reference,
    callback_url: `${origin}/payment-return.html`,
    metadata: JSON.stringify({
      product: GUIDE_PRODUCT,
      purchase_kind: 'guide',
      customer_email: email,
      first_name: firstName,
      business_type: resolvedBusinessType,
      weekly_enquiries: weeklyEnquiries,
      whatsapp_number: whatsAppNumber,
      replying_pain_point: replyPain,
      fbp,
      fbc,
      event_source_url: eventSourceUrl || `${origin}/checkout.html`,
      client_ip_address: requestIp(req),
      client_user_agent: clientUserAgent || String(req.headers['user-agent'] || '').slice(0, 1000),
      custom_fields: [
        { display_name: 'What they sell', variable_name: 'business_type', value: resolvedBusinessType },
        { display_name: 'Weekly messages or orders', variable_name: 'weekly_enquiries', value: weeklyEnquiries },
        ...(whatsAppNumber ? [{ display_name: 'WhatsApp number', variable_name: 'whatsapp_number', value: whatsAppNumber }] : []),
        ...(replyPain ? [{ display_name: 'Biggest sales challenge', variable_name: 'replying_pain_point', value: replyPain }] : []),
      ],
      cancel_action: `${origin}/checkout.html`,
    }),
  };

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transaction),
    });
    const result = await response.json();

    if (!response.ok || !result.status || !result.data || !result.data.authorization_url) {
      return json(res, 502, { error: 'We could not start secure checkout. Please try again.' });
    }

    return json(res, 200, { authorizationUrl: result.data.authorization_url });
  } catch (error) {
    return json(res, 502, { error: 'We could not reach secure checkout. Please try again.' });
  }
};
