// api/wa-register.js  [Chibondo Academy]
// Receives a register_student tool call from the AI agent.
// Creates a Supabase auth user + public.users row, then sends a WhatsApp
// verification link to the student's phone for one-tap login.
// No email or password is shared with the student — authentication is WhatsApp-based.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL || 'https://nckjjfxlmmsnmnexcgzg.supabase.co';
const SERVICE_KEY   = process.env.CHIBONDO_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SHARED_SECRET = process.env.WA_REGISTER_SECRET;
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

async function sendWhatsAppOTP(phone, name) {
  const cleanPhone = normalisePhone(phone);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const token = generateToken();
  const verifyLink = `${APP_URL}/verify-link?t=${token}`;

  // Store OTP in otp_codes table (5-min expiry)
  const storeRes = await fetch(`${SUPABASE_URL}/rest/v1/otp_codes`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      phone: cleanPhone,
      code,
      token,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      used: false,
    }),
  });

  if (!storeRes.ok) {
    console.error('[wa-register] OTP store failed:', await storeRes.text());
    return { ok: false, error: 'Failed to generate verification link' };
  }

  // Send WhatsApp message with verification link + code
  const firstName = name ? name.split(' ')[0] : '';
  const greeting = firstName ? `Hi ${firstName}! ` : '';

  const messageBody =
    `${greeting}Welcome to *Chibondo Academy*! 🎉\n\n` +
    `Tap this link to verify and log in:\n${verifyLink}\n\n` +
    `Or enter code: *${code}*\n\n` +
    `Expires in 5 minutes. Don't share it with anyone.`;

  // Try template first, fall back to text
  try {
    // Use login_verification template (code in body + magic link as URL button)
    // Template body: "Your verification code is: {{1}}..."
    // Template button: "Verify Login" → https://chibondoacademy.com/verify-link?t={{2}}
    const templateRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'template',
        template: {
          name: 'login_verification',
          language: { code: 'en' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: token }] },
          ],
        },
      }),
    });

    if (!templateRes.ok) {
      console.warn('[wa-register] login_verification template failed, trying otp_verification fallback');
      // Fallback: try old otp_verification template (code only)
      const otpRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'template',
          template: {
            name: 'otp_verification',
            language: { code: 'en_US' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }],
          },
        }),
      });

      if (!otpRes.ok) {
        console.error('[wa-register] All template sends failed, returning on-screen code');
        return { ok: true, verifyLink, code, delivery_method: 'fallback' };
      }
    }
  } catch (err) {
    console.error('[wa-register] WhatsApp send error:', err.message);
    // Try SMS fallback
    const smsResult = await sendSMSOTP(phone, code);
    if (smsResult.ok) return { ok: true, verifyLink, code, delivery_method: 'sms' };
    return { ok: true, verifyLink, code, delivery_method: 'fallback' };
  }

  return { ok: true, verifyLink };
}



// ─── SMS Fallback via Africa's Talking ─────────────────────────────────────────
async function sendSMSOTP(phone, code) {
  const AT_KEY      = process.env.AT_API_KEY;
  const AT_USERNAME = process.env.AT_USERNAME;
  const AT_SENDER   = process.env.AT_SENDER_ID || 'CHIBONDO';
  if (!AT_KEY || !AT_USERNAME) return { ok: false };

  try {
    const body = new URLSearchParams({
      username: AT_USERNAME,
      to: `+${phone}`,
      message: `Chibondo Academy: Your verification code is ${code}. It expires in 5 minutes.`,
      from: AT_SENDER,
    });
    const smsRes = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: { apiKey: AT_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return { ok: smsRes.ok };
  } catch { return { ok: false }; }
}

// ─── Free Trial Auto-Activation ──────────────────────────────────────────────
async function maybeCreateTrialSubscription(sb, userId, fullName) {
  try {
    const { data: settings } = await sb.from('platform_settings').select('value').eq('key', 'pricing').maybeSingle();
    if (!settings?.value?.trial_enabled) return;

    const trialDays = Math.max(1, Math.min(30, settings.value.trial_days || 7));
    const now = new Date();
    const expires = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    // Check for existing subscription
    const { data: existing } = await sb.from('subscriptions')
      .select('id').eq('student_id', userId).limit(1);
    if (existing?.length > 0) return;

    const { error } = await sb.from('subscriptions').insert({
      student_id: userId,
      student_name: fullName || '',
      plan: 'trial',
      status: 'active',
      amount: 0,
      currency: settings.value.currency || 'MWK',
      starts_at: now.toISOString(),
      expires_at: expires.toISOString(),
      pachangu_ref: 'TRIAL',
      created_by: userId,
      created_date: now.toISOString(),
      updated_date: now.toISOString(),
    });

    if (error) {
      console.error('[wa-register] Trial subscription failed:', error);
    } else {
      console.log(`[wa-register] Created ${trialDays}-day trial for ${userId}`);
    }
  } catch (err) {
    console.error('[wa-register] Trial error:', err.message);
  }
}


// ─── Affiliate Referral Tracking ─────────────────────────────────────────────

// ─── Generate a unique referral code from a user's name ────────────────────────
async function generateUniqueReferralCode(sb, fullName) {
  const base = (fullName || 'USER')
    .trim()
    .split(/\s+/)[0]
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');

  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    const code = `${base}${suffix}`;

    const { data } = await sb.from('users')
      .select('id')
      .eq('referral_code', code)
      .limit(1);
    if (!data || data.length === 0) return code;
  }

  return `USER${Date.now().toString().slice(-6)}`;
}

async function maybeTrackReferral(sb, newUser, referralCode) {
  try {
    if (!referralCode || !newUser?.id) return;
    const code = String(referralCode).trim().toUpperCase();

    const { data: referrer } = await sb.from('users')
      .select('id, full_name')
      .eq('referral_code', code)
      .maybeSingle();

    if (!referrer) { console.log('[wa-register] No referrer for code:', code); return; }
    if (referrer.id === newUser.id) { console.log('[wa-register] Self-referral skipped'); return; }

    // Check existing referral
    const { data: existing } = await sb.from('referrals')
      .select('id')
      .eq('referrer_id', referrer.id)
      .eq('referred_user_id', newUser.id)
      .limit(1);
    if (existing?.length > 0) { console.log('[wa-register] Referral already exists'); return; }

    // Get commission settings
    let rewardAmount = 5000;
    const { data: affSettings } = await sb.from('platform_settings')
      .select('value').eq('key', 'affiliate_commission').maybeSingle();
    if (affSettings?.value) {
      if (affSettings.value.commission_type === 'fixed') {
        rewardAmount = affSettings.value.fixed_amount || affSettings.value.commission_amount || 5000;
      }
    }

    const { error } = await sb.from('referrals').insert({
      referrer_id: referrer.id,
      referrer_name: referrer.full_name || '',
      referred_user_id: newUser.id,
      referred_name: newUser.full_name || '',
      referred_email: newUser.email || '',
      referral_code: code,
      status: 'pending',
      reward_amount: rewardAmount,
      reward_status: 'pending',
      recurring_reward_amount: affSettings?.value?.recurring_commission ? rewardAmount : 0,
      recurring_count: 0,
      created_by: newUser.id,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    });

    if (error) {
      console.error('[wa-register] Referral creation failed:', error);
    } else {
      console.log(`[wa-register] Created referral: ${referrer.full_name} (${code}) -> ${newUser.full_name || newUser.id}`);
    }
  } catch (err) {
    console.error('[wa-register] Referral tracking error:', err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!SHARED_SECRET || token !== SHARED_SECRET) {
    console.warn('[wa-register] Unauthorized');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { tool, args } = req.body || {};
  if (tool !== 'register_student') {
    return res.status(400).json({ error: 'Unknown tool: ' + tool });
  }

  const { full_name, phone } = args || {};

  if (!full_name || !phone) {
    return res.status(400).json({ error: 'Missing required fields: full_name, phone' });
  }

  const normPhone = normalisePhone(phone);
  const autoEmail = `${normPhone}@chibondoacademy.com`;

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if user already exists by phone or email
    let existingRow = null;

    const { data: byEmail } = await sb
      .from('users')
      .select('id, full_name, phone_number')
      .eq('email', autoEmail)
      .maybeSingle();

    if (byEmail) {
      existingRow = byEmail;
    } else {
      const { data: byPhone } = await sb
        .from('users')
        .select('id, full_name, phone_number')
        .or(`phone_number.eq.${normPhone},phone.eq.${normPhone}`)
        .maybeSingle();
      if (byPhone) existingRow = byPhone;
    }

    if (existingRow) {
      // Existing account — send WhatsApp verification link
      const waResult = await sendWhatsAppOTP(normPhone, existingRow.full_name || full_name);
      if (waResult.ok) {
        const deliveryMsg = waResult.delivery_method === 'sms'
          ? `Welcome back, ${existingRow.full_name || full_name}! I've sent a verification code to your phone via SMS. Use it to log in here: ${APP_URL}/login?ref=AGENT`
          : waResult.delivery_method === 'fallback'
            ? `Welcome back, ${existingRow.full_name || full_name}! Your verification code is *${waResult.code}*. Enter it here to log in: ${APP_URL}/verify-otp?ref=AGENT`
            : `Welcome back, ${existingRow.full_name || full_name}! I've sent a login link to your WhatsApp. Check your messages and tap the link to log in. 📲`;
        return res.status(200).json({
          ok: true,
          already_registered: true,
          message: deliveryMsg,
        });
      }
      // Fallback: direct them to login page
      return res.status(200).json({
        ok: true,
        already_registered: true,
        message: `Welcome back, ${existingRow.full_name || full_name}! You already have an account. Log in here: ${APP_URL}/login?ref=AGENT — just enter your phone number.`,
      });
    }

    // Create new auth user
    const password = normPhone + '_chibondo_2026';
    const { data: authData, error: signUpErr } = await sb.auth.admin.createUser({
      email: autoEmail,
      password,
      email_confirm: true,
      phone: `+${normPhone}`,
      phone_confirm: true,
      user_metadata: {
        full_name,
        source: 'whatsapp_registration',
        auth_method: 'whatsapp_otp',
      },
    });

    if (signUpErr) {
      console.error('[wa-register] createUser failed:', signUpErr);
      return res.status(500).json({ error: signUpErr.message });
    }

    const userId = authData.user.id;

    // Insert into public.users
    const { error: userInsertErr } = await sb.from('users').insert({
      id:            userId,
      full_name,
      email:         autoEmail,
      phone_number:  normPhone,
      role:          'user',
      created_by:    userId,
      referral_code: args?.referral_code || 'AGENT',
      whatsapp_notifications: true,
      email_notifications: true,
      inapp_notifications: true,
    });

    if (userInsertErr) {
      console.error('[wa-register] users insert failed:', userInsertErr);
    }

    // Create student_profiles row
    const { error: profileErr } = await sb.from('student_profiles').upsert({
      user_id:      userId,
      full_name,
      phone_number: normPhone,
    }, { onConflict: 'user_id' });

    if (profileErr) {
      console.error('[wa-register] student_profiles upsert failed:', profileErr);
    }

    // Auto-create free trial subscription
    await maybeCreateTrialSubscription(sb, userId, full_name);

    // Track affiliate referral
    await maybeTrackReferral(sb, { id: userId, full_name, email: autoEmail }, args?.referral_code);

    // Send WhatsApp verification link to the student
    const waResult = await sendWhatsAppOTP(normPhone, full_name);

    if (waResult.ok) {
      const deliveryMsg = waResult.delivery_method === 'sms'
        ? `You're now a student at *The Chibondo Academy*! 🎉\n\nI've sent a verification code to your phone via SMS. Enter it here to log in: ${APP_URL}/verify-otp?ref=AGENT\n\nAfter logging in, choose a plan to unlock your lessons — fees start at *MK10,000 per month*. Welcome aboard! 📲`
        : waResult.delivery_method === 'fallback'
          ? `You're now a student at *The Chibondo Academy*! 🎉\n\nYour verification code is *${waResult.code}*. Enter it here to log in: ${APP_URL}/verify-otp?ref=AGENT\n\nAfter logging in, choose a plan to unlock your lessons — fees start at *MK10,000 per month*. Welcome aboard! 📲`
          : `You're now a student at *The Chibondo Academy*! 🎉\n\nI've sent a verification link to your WhatsApp. Tap it to log in — no password needed!\n\nAfter logging in, choose a plan to unlock your lessons — fees start at *MK10,000 per month*. Welcome aboard! 📲`;
      return res.status(200).json({
        ok: true,
        already_registered: false,
        message: deliveryMsg,
      });
    }

    // Fallback if WhatsApp send failed
    return res.status(200).json({
      ok: true,
      already_registered: false,
      message: `You're now a student at *The Chibondo Academy*! 🎉\n\nLog in here: ${APP_URL}/login?ref=AGENT — enter your phone number.\n\nAfter logging in, choose a plan to unlock your lessons. Welcome aboard!`,
    });

  } catch (err) {
    console.error('[wa-register] unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
}
