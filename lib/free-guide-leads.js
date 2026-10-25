const crypto = require('crypto');

function config() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  return url && key ? { url, key } : null;
}

async function request(path, options = {}) {
  const settings = config();
  if (!settings) return { ok: false, configurationError: true };
  const response = await fetch(`${settings.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: settings.key,
      Authorization: `Bearer ${settings.key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    console.error('Free Guide lead storage failed.', { status: response.status, body: body.slice(0, 500) });
  }
  return { ok: response.ok, configurationError: false, response };
}

function claimId() {
  return crypto.randomUUID();
}

async function createSignup(record) {
  return request('free_guide_signups', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(record),
  });
}

async function updateSignup(id, fields) {
  return request(`free_guide_signups?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(fields),
  });
}

async function listSignups() {
  const result = await request('free_guide_signups?select=id,email,business_type,weekly_message_volume,whatsapp_number,whatsapp_contact_consent,declined_reason,declined_other_text,declined_at,app_unlock_clicked_at,app_payment_confirmed_at,created_at&order=created_at.desc');
  if (!result.ok) return result;
  return { ...result, rows: await result.response.json() };
}

async function findAwaitingAppPaymentByEmail(email) {
  const safeEmail = encodeURIComponent(String(email || '').trim().toLowerCase());
  const result = await request(`free_guide_signups?select=id&email=eq.${safeEmail}&app_unlock_clicked_at=not.is.null&app_payment_confirmed_at=is.null&order=app_unlock_clicked_at.desc&limit=1`);
  if (!result.ok) return result;
  const rows = await result.response.json();
  return { ...result, row: rows[0] || null };
}

async function markAppPaymentConfirmed({ claimId: signupId, email, confirmedAt }) {
  if (signupId) {
    return updateSignup(signupId, { app_payment_confirmed_at: confirmedAt || new Date().toISOString() });
  }
  const signup = await findAwaitingAppPaymentByEmail(email);
  if (!signup.ok || !signup.row) return signup;
  return updateSignup(signup.row.id, { app_payment_confirmed_at: confirmedAt || new Date().toISOString() });
}

module.exports = { claimId, createSignup, updateSignup, listSignups, findAwaitingAppPaymentByEmail, markAppPaymentConfirmed };
