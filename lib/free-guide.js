const crypto = require('crypto');

const GUIDE_FILE_NAME = 'The-24-7-Sales-Engine-Guide-and-Workbook.zip';

function secret() {
  return process.env.FREE_GUIDE_TOKEN_SECRET || '';
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(a || '');
  const right = Buffer.from(b || '');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function createGuideToken(email, claimId) {
  if (!secret()) return null;
  const payload = encode({
    email: String(email).trim().toLowerCase(),
    claimId: String(claimId || ''),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  });
  return `${payload}.${sign(payload)}`;
}

function verifyGuideToken(token) {
  if (!secret() || typeof token !== 'string') return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra || !timingSafeEqual(sign(payload), signature)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const email = String(data.email || '').trim().toLowerCase();
    const candidateClaimId = String(data.claimId || '');
    const claimId = /^[0-9a-f-]{36}$/i.test(candidateClaimId) ? candidateClaimId : null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !Number.isFinite(data.exp) || data.exp < Date.now()) return null;
    return { email, claimId, expiresAt: data.exp };
  } catch {
    return null;
  }
}

async function sendGuideEmail({ email, accessUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, configurationError: true };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Your 24/7 Sales Engine Guide + Workbook',
      html: `<p>Hi,</p><p>Your free <strong>24/7 Sales Engine Guide + Interactive Workbook</strong> is ready.</p><p><a href="${accessUrl}">Download your Guide + Workbook</a></p><p>Save this email so you can come back to your files. The download link is valid for 30 days.</p><p>— Reply &amp; Close</p>`,
    }),
  });
  if (!response.ok) return { ok: false, status: response.status, body: (await response.text()).slice(0, 500) };
  return { ok: true };
}

module.exports = { GUIDE_FILE_NAME, createGuideToken, verifyGuideToken, sendGuideEmail };
