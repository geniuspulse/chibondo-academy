// api/broadcast-wa.js  [Chibondo Academy]
// One-time broadcast: send WhatsApp login-link messages to a list of phone numbers.
// Also fixes auth passwords for existing WhatsApp-registered users whose password
// was set with the old hardcoded method (before the derivePassword fix).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL || 'https://nckjjfxlmmsnmnexcgzg.supabase.co';
const SERVICE_KEY   = process.env.CHIBONDO_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SHARED_SECRET = process.env.WA_REGISTER_SECRET || process.env.OTP_SECRET;
const OTP_SECRET    = process.env.OTP_SECRET || 'chibondo-wa-otp-2026';
const APP_URL       = process.env.VITE_APP_URL || process.env.APP_URL || 'https://chibondoacademy.com';
const WA_TOKEN      = process.env.WA_ACCESS_TOKEN;
const WA_PHONE_ID   = process.env.WA_PHONE_NUMBER_ID;
const GRAPH_VERSION  = 'v21.0';

function normalisePhone(raw) {
  let p = String(raw).replace(/\D/g, '');
  if (p.startsWith('0')) p = '265' + p.slice(1);
  if (!p.startsWith('265')) p = '265' + p;
  return p;
}

function generateToken() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function derivePassword(phone, secret) {
  const data = new TextEncoder().encode(`${phone}:${secret}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

function isPlaceholderEmail(email) {
  if (!email) return true;
  const e = email.toLowerCase();
  return e.endsWith('@chibondoacademy.com') || e.startsWith('wa_');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!SHARED_SECRET || token !== SHARED_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { phones, message_template } = req.body || {};
  if (!Array.isArray(phones) || phones.length === 0) {
    return res.status(400).json({ error: 'phones array is required' });
  }

  if (!WA_TOKEN || !WA_PHONE_ID) {
    return res.status(500).json({ error: 'WhatsApp credentials not configured' });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results = [];

  for (const rawPhone of phones) {
    const normPhone = normalisePhone(rawPhone);
    const autoEmail = `${normPhone}@chibondoacademy.com`;
    const waNumber = `+${normPhone}`;

    try {
      // 1. Check if user exists
      const { data: userRow } = await sb
        .from('users')
        .select('id, full_name, email, phone_number')
        .eq('email', autoEmail)
        .maybeSingle();

      let userExists = !!userRow;
      let fullName = userRow?.full_name || '';

      // 2. Fix auth password for existing WhatsApp-registered users
      if (userExists) {
        const correctPassword = await derivePassword(normPhone, OTP_SECRET);
        const { error: pwErr } = await sb.auth.admin.updateUserById(userRow.id, {
          password: correctPassword,
        });
        if (pwErr) {
          console.error(`[broadcast] Password fix failed for ${normPhone}:`, pwErr.message);
        } else {
          console.log(`[broadcast] Fixed auth password for ${normPhone}`);
        }
      }

      // 3. Generate a magic-link token
      const token = generateToken();
      const verifyLink = `${APP_URL}/verify-link?t=${token}`;

      const { error: otpErr } = await sb.from('otp_codes').insert({
        phone: normPhone,
        code: String(Math.floor(100000 + Math.random() * 900000)),
        token,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry for broadcast
        used: false,
      });

      if (otpErr) {
        console.error(`[broadcast] OTP insert failed for ${normPhone}:`, otpErr);
        results.push({ phone: normPhone, ok: false, error: 'Failed to generate login link' });
        continue;
      }

      // 4. Build the WhatsApp message
      const greeting = fullName ? `Hi ${fullName}!` : 'Hi!';
      const messageText = message_template
        .replace('{greeting}', greeting)
        .replace('{login_link}', verifyLink);

      // 5. Send via WhatsApp text message (works within 24h customer service window)
      const sendRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: normPhone,
          type: 'text',
          text: { body: messageText },
        }),
      });

      const sendBody = await sendRes.json().catch(() => ({}));

      if (sendRes.ok) {
        console.log(`[broadcast] Sent to ${normPhone} ✓`);
        results.push({ phone: normPhone, ok: true, user_exists: userExists, link: verifyLink });
      } else {
        // Text failed — likely outside 24h window. Try template fallback.
        console.warn(`[broadcast] Text failed for ${normPhone}:`, JSON.stringify(sendBody).slice(0, 200));

        // Try login_verification template as fallback (Authentication category)
        const code = String(Math.floor(100000 + Math.random() * 900000));
        // Update the OTP code field to match the template code
        await sb.from('otp_codes').update({ code }).eq('token', token);

        const tmplRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: normPhone,
            type: 'template',
            template: {
              name: 'login_verification',
              language: { code: 'en_US' },
              components: [
                { type: 'body', parameters: [{ type: 'text', text: code }] },
                { type: 'button', sub_type: 'copy_code', index: '0', parameters: [{ type: 'coupon_code', coupon_code: code }] },
              ],
            },
          }),
        });

        const tmplBody = await tmplRes.json().catch(() => ({}));

        if (tmplRes.ok) {
          console.log(`[broadcast] Template sent to ${normPhone} ✓ (fallback)`);
          results.push({ phone: normPhone, ok: true, user_exists: userExists, link: verifyLink, delivery: 'template_fallback' });
        } else {
          console.error(`[broadcast] Both sends failed for ${normPhone}:`, JSON.stringify(tmplBody).slice(0, 200));
          results.push({ phone: normPhone, ok: false, error: sendBody?.error?.message || 'Send failed (outside 24h window)', link: verifyLink });
        }
      }
    } catch (err) {
      console.error(`[broadcast] Error for ${normPhone}:`, err.message);
      results.push({ phone: normPhone, ok: false, error: err.message });
    }

    // Small delay between sends to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  const sent = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  return res.status(200).json({
    ok: true,
    total: results.length,
    sent,
    failed,
    results,
  });
}
