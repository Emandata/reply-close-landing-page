const { listSignups } = require('../../lib/free-guide-leads');
const { json } = require('../../lib/paystack');

function tally(rows, key, fallback = 'Not answered') {
  return rows.reduce((counts, row) => {
    const value = row[key] || fallback;
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

module.exports = async (req, res) => {
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
      totals: {
        signups: rows.length,
        appUnlockClicks: clicked.length,
        appPaymentsConfirmed: clicked.length - awaitingPayment.length,
        appClicksAwaitingPayment: awaitingPayment.length,
      },
      businessTypes: tally(rows, 'business_type'),
      weeklyVolumes: tally(rows, 'weekly_message_volume'),
      declineReasons: tally(rows.filter(row => row.declined_reason), 'declined_reason'),
      followUps: awaitingPayment.map(row => ({
        email: row.email,
        whatsappNumber: row.whatsapp_number,
        businessType: row.business_type,
        weeklyMessageVolume: row.weekly_message_volume,
        clickedAt: row.app_unlock_clicked_at,
      })),
    });
  } catch (error) {
    console.error('Free Guide report failed.', { error: error && error.message });
    return json(res, 502, { error: 'Lead reporting is temporarily unavailable.' });
  }
};
