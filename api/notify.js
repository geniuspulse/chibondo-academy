/**
 * /api/notify — Unified notification sender
 * 
 * POST /api/notify?channel=push|sms|email
 * Routes to the appropriate notification backend based on channel param.
 * Consolidates send-push.js, send-sms.js, send-email.js into one function
 * to stay within Vercel Hobby plan's 12-function limit.
 */

import webpush from 'web-push';

const RESEND_API_KEY    = process.env.RESEND_API_KEY;
const INTERNAL_SECRET   = process.env.INTERNAL_API_SECRET;
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_SRK      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FROM_EMAIL         = 'noreply@chibondoacademy.com';
const MAX_BATCH         = 50;

// VAPID for push (initialised lazily so missing keys don't crash
// email/push-only requests at module load)
let _vapidReady = false;
function ensureVapid() {
  if (_vapidReady) return;
  webpush.setVapidDetails(
    'mailto:admin@chibondoacademy.com',
    process.env.VITE_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  _vapidReady = true;
}

function decodeJwt(token) {
  try {
    const part = token.split('.')[1];
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch { return null; }
}

async function isAdminCaller(req) {
  const secret = req.headers['x-internal-secret'];
  if (secret && secret === INTERNAL_SECRET) return true;
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return false;
  const claims = decodeJwt(token);
  if (!claims?.sub) return false;
  const jwtRole = claims?.app_metadata?.role || claims?.user_metadata?.role;
  if (jwtRole === 'admin') return true;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(claims.sub)}&select=role&limit=1`, {
      headers: { apikey: SUPABASE_SRK, Authorization: `Bearer ${SUPABASE_SRK}` },
    });
    const rows = await r.json();
    return rows?.[0]?.role === 'admin';
  } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://chibondoacademy.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-internal-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Parse channel from query param or body
  const url = new URL(req.url, 'http://localhost');
  const channel = url.searchParams.get('channel') || req.body?.channel || 'email';

  // ── AUTH ──
  const authorized = await isAdminCaller(req);
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body || {};

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANNEL: EMAIL
  // ═══════════════════════════════════════════════════════════════════════════
  if (channel === 'email') {
    const { to, subject, html, text, from_name = 'Chibondo Academy' } = body;
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html/text' });
    }
    const recipients = Array.isArray(to) ? to : [to];
    if (recipients.length === 0) return res.status(400).json({ error: 'No recipients' });
    const realRecipients = recipients.filter(e => e && !e.endsWith('@student.chibondoacademy.com'));
    if (realRecipients.length === 0) return res.status(400).json({ error: 'No valid recipients (all are placeholder addresses)' });

    try {
      const batches = [];
      for (let i = 0; i < realRecipients.length; i += MAX_BATCH) {
        batches.push(realRecipients.slice(i, i + MAX_BATCH));
      }
      let sent = 0;
      for (const batch of batches) {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: `${from_name} <${FROM_EMAIL}>`,
            to: batch,
            subject,
            html: html || undefined,
            text: text || undefined,
          }),
        });
        if (r.ok) sent += batch.length;
      }
      return res.status(200).json({ success: true, sent, count: realRecipients.length });
    } catch (err) {
      console.error('notify/email error:', err);
      return res.status(500).json({ error: 'Failed to send email' });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANNEL: PUSH
  // ═══════════════════════════════════════════════════════════════════════════
  if (channel === 'push') {
    ensureVapid();
    const { subscriptions, notification } = body;
    if (!subscriptions?.length || !notification) {
      return res.status(400).json({ error: 'Missing subscriptions or notification' });
    }
    const payload = JSON.stringify({
      title: notification.title || 'Chibondo Academy',
      body: notification.body || '',
      icon: notification.icon || '/icon-192.png',
      url: notification.url || '/',
      tag: notification.tag || 'chibondo',
      notificationId: notification.notificationId || null,
      requireInteraction: notification.requireInteraction || false,
    });
    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        webpush.sendNotification(typeof sub === 'string' ? JSON.parse(sub) : sub, payload, {
          urgency: notification.urgency || 'normal', TTL: notification.ttl || 86400,
        })
      )
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const expiredSubs = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const statusCode = r.reason?.statusCode;
        if (statusCode === 410 || statusCode === 404) expiredSubs.push(subscriptions[i]);
      }
    });
    return res.status(200).json({ message: `Sent to ${succeeded}/${subscriptions.length}`, succeeded, failed, expiredSubs });
  }

  return res.status(400).json({ error: `Unknown channel: ${channel}` });
}
