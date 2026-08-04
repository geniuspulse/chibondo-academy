/**
 * /api/send-whatsapp — Send WhatsApp notification messages
 *
 * POST /api/send-whatsapp
 * Body: { to: string | string[], message: string, type?: 'text' | 'template', template?: {...} }
 *
 * Uses WhatsApp Business Cloud API (same credentials as OTP).
 *
 * 24-hour window handling:
 * - If type='text' (default), tries free-form text first. If it fails with error
 *   code 131047 (24h window expired), automatically retries with a template.
 * - If type='template', sends using the provided template config.
 * - Template format: { name: 'template_name', language: { code: 'en' }, components: [...] }
 *
 * For proactive notifications (payment reminders, lesson updates), use type='template'
 * with a pre-approved Meta template to bypass the 24-hour window.
 */

const WA_TOKEN    = process.env.WA_ACCESS_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
const GRAPH_VERSION = 'v18.0';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_BATCH = 50;

// Default template for payment reminders (pre-registered with Meta)
// This template should be approved in Meta Business Manager
const DEFAULT_REMINDER_TEMPLATE = {
  name: 'payment_reminder',
  language: { code: 'en' },
  components: [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: 'Student' },       // {{1}} student name
        { type: 'text', text: 'Monthly' },        // {{2}} plan
        { type: 'text', text: '7' },              // {{3}} days left
      ],
    },
  ],
};

function decodeJwt(token) {
  try {
    const part = token.split('.')[1];
    const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch { return null; }
}

async function isAuthorized(req) {
  // Internal secret (server-to-server)
  const secret = req.headers['x-internal-secret'];
  if (secret && secret === process.env.INTERNAL_API_SECRET) return true;

  // Admin JWT from browser
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return false;
  const claims = decodeJwt(token);
  if (!claims?.sub) return false;
  const jwtRole = claims?.app_metadata?.role || claims?.user_metadata?.role;
  if (jwtRole === 'admin' || jwtRole === 'teacher') return true;

  // DB lookup
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(claims.sub)}&select=role&limit=1`, {
      headers: { apikey: SUPABASE_SRK, Authorization: `Bearer ${SUPABASE_SRK}` },
    });
    const rows = await r.json();
    return rows?.[0]?.role === 'admin' || rows?.[0]?.role === 'teacher';
  } catch { return false; }
}

function normalizePhone(phone) {
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) cleanPhone = '265' + cleanPhone.slice(1);
  if (!cleanPhone.startsWith('265')) cleanPhone = '265' + cleanPhone;
  return cleanPhone;
}

async function sendTextMessage(phone, message) {
  const cleanPhone = normalizePhone(phone);
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: { body: message },
    }),
  });
  return { res, cleanPhone };
}

async function sendTemplateMessage(phone, template) {
  const cleanPhone = normalizePhone(phone);
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'template',
      template,
    }),
  });
  return { res, cleanPhone };
}

async function sendSingleWhatsApp(phone, message, opts = {}) {
  try {
    // If template is explicitly requested, use it directly
    if (opts.template) {
      const { res, cleanPhone } = await sendTemplateMessage(phone, opts.template);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('WhatsApp template send failed:', JSON.stringify(err));
        return { ok: false, phone: cleanPhone, error: err?.error?.message || 'Template failed' };
      }
      return { ok: true, phone: cleanPhone, method: 'template' };
    }

    // Try free-form text first (works within 24h window)
    const { res, cleanPhone } = await sendTextMessage(phone, message);

    if (res.ok) {
      return { ok: true, phone: cleanPhone, method: 'text' };
    }

    // Check if it failed due to 24h window expiry
    const err = await res.json().catch(() => ({}));
    const errorCode = err?.error?.code;
    const errorMsg = err?.error?.message || 'Failed';

    console.error('WhatsApp text send failed:', JSON.stringify(err));

    // Error 131047 = 24-hour window expired, or 131030 = re-engagement message
    if (errorCode === 131047 || errorCode === 131030 || errorMsg.includes('24-hour')) {
      console.log('24h window expired, falling back to template...');

      // Fall back to template
      const template = opts.fallbackTemplate || {
        name: 'payment_reminder',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: opts.studentName || 'Student' },
              { type: 'text', text: 'Monthly' },
              { type: 'text', text: '7' },
            ],
          },
        ],
      };

      const { res: tplRes, cleanPhone: tplPhone } = await sendTemplateMessage(phone, template);

      if (tplRes.ok) {
        return { ok: true, phone: tplPhone, method: 'template_fallback' };
      }

      const tplErr = await tplRes.json().catch(() => ({}));
      console.error('WhatsApp template fallback also failed:', JSON.stringify(tplErr));
      return {
        ok: false,
        phone: tplPhone,
        error: tplErr?.error?.message || errorMsg,
        window_expired: true,
        template_failed: true,
      };
    }

    return { ok: false, phone: cleanPhone, error: errorMsg };
  } catch (err) {
    console.error('WhatsApp send error:', err.message);
    return { ok: false, phone: normalizePhone(phone), error: err.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://chibondoacademy.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-internal-secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!WA_TOKEN || !WA_PHONE_ID) {
    return res.status(500).json({ error: 'WhatsApp credentials not configured' });
  }

  const { to, message, users, template, studentName } = req.body ?? {};

  const opts = {};
  if (template) opts.template = template;
  if (studentName) opts.studentName = studentName;

  // Mode 1: Direct phone numbers
  if (to && message) {
    const phones = Array.isArray(to) ? to : [to];
    const results = await Promise.all(phones.map(p => sendSingleWhatsApp(p, message, opts)));
    const sent = results.filter(r => r.ok).length;
    const method = results[0]?.method || 'text';
    return res.status(200).json({ ok: true, sent, total: phones.length, results, method });
  }

  // Mode 2: User IDs — fetch phone numbers from users table
  if (users && message) {
    const userIds = Array.isArray(users) ? users : [users];
    if (userIds.length === 0) return res.status(400).json({ error: 'No user IDs provided' });

    const headers = {
      apikey: SUPABASE_SRK,
      Authorization: `Bearer ${SUPABASE_SRK}`,
      'Content-Type': 'application/json',
    };

    // Fetch in batches
    let allUsers = [];
    for (let i = 0; i < userIds.length; i += MAX_BATCH) {
      const batch = userIds.slice(i, i + MAX_BATCH);
      const orFilter = `or=(${batch.map(id => `id.eq.${encodeURIComponent(id)}`).join(',')})`;
      const url = `${SUPABASE_URL}/rest/v1/users?${orFilter}&select=id,phone_number,phone,whatsapp,full_name&limit=${MAX_BATCH}`;
      const r = await fetch(url, { headers });
      if (r.ok) {
        const rows = await r.json();
        allUsers = allUsers.concat(rows);
      }
    }

    // Extract phone numbers and names
    const phoneMap = {};
    const nameMap = {};
    for (const u of allUsers) {
      const phone = u.phone_number || u.phone || u.whatsapp;
      if (phone && phone.replace(/\D/g, '').length >= 9) {
        phoneMap[u.id] = phone;
        nameMap[u.id] = u.full_name || 'Student';
      }
    }

    const phones = Object.values(phoneMap);
    if (phones.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, message: 'No users with valid phone numbers found' });
    }

    // Send messages (with small delay between batches to avoid rate limits)
    const results = [];
    for (let i = 0; i < phones.length; i += 5) {
      const batch = phones.slice(i, i + 5);
      const batchResults = await Promise.all(batch.map((p, idx) => {
        const userId = Object.keys(phoneMap).find(k => phoneMap[k] === p);
        return sendSingleWhatsApp(p, message, { ...opts, studentName: nameMap[userId] });
      }));
      results.push(...batchResults);
      if (i + 5 < phones.length) await new Promise(r => setTimeout(r, 500));
    }

    const sent = results.filter(r => r.ok).length;
    const usedFallback = results.some(r => r.method === 'template_fallback');
    return res.status(200).json({ ok: true, sent, total: phones.length, results, used_fallback: usedFallback });
  }

  return res.status(400).json({ error: 'Missing required fields: (to OR users) and message' });
}
