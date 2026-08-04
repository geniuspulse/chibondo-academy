/**
 * WhatsApp OTP — Combined Send + Verify (Vercel Serverless Function)
 *
 * POST /api/wa-otp  with  { action: "send", phone: "265991234567" }
 * POST /api/wa-otp  with  { action: "verify", phone, code?, token?, name? }
 *
 * Merged to stay under the Vercel Hobby plan's 12-function limit.
 */

const GRAPH_VERSION = 'v21.0';

function generateToken() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalisePhone(phone) {
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) clean = '265' + clean.slice(1);
  if (!clean.startsWith('265') && clean.length === 9) clean = '265' + clean;
  return clean;
}

/**
 * Returns an array of all phone variants to check in the DB.
 * Settings saves as +265..., OTP system stores as 265... — we must match both.
 */
function phoneVariants(cleanPhone) {
  const withPlus = '+' + cleanPhone;
  const withoutPlus = cleanPhone;
  return [withPlus, withoutPlus];
}

/**
 * Build a PostgREST OR filter that matches phone_number in any format.
 * e.g. or=(phone_number.eq.+265893454156,phone_number.eq.265893454156,email.eq....)
 */
function buildPhoneOrQuery(cleanPhone, extraFields = []) {
  const variants = phoneVariants(cleanPhone);
  const phoneConds = variants.map(v => `phone_number.eq.${encodeURIComponent(v)}`);
  const allConds = [...phoneConds, ...extraFields];
  return `or=(${allConds.join(',')})`;
}


// ─── SEND ────────────────────────────────────────────────────────────────────
// ─── SEND ────────────────────────────────────────────────────────────────────

async function sendOTP(req, res) {
  const { phone, mode } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  const cleanPhone = normalisePhone(phone);
  if (cleanPhone.length < 12 || cleanPhone.length > 13)
    return res.status(400).json({ error: 'Invalid phone number. Please enter a valid Malawi number (e.g. 0991234567).' });

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const WA_TOKEN = process.env.WA_ACCESS_TOKEN;
  const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
  const APP_URL = process.env.APP_URL || 'https://chibondoacademy.com';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)
    return res.status(500).json({ error: 'Server configuration error' });

  // For login mode: check if an account exists with this phone number
  if (mode === 'login') {
    try {
      const autoEmail = `${cleanPhone}@chibondoacademy.com`;
      const waPrefixEmail = `wa_${cleanPhone}@chibondoacademy.com`;
      const headers = {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      };

      // Check users table by phone_number (both +265... and 265... variants) or auto-generated emails
      const phoneQuery = buildPhoneOrQuery(cleanPhone, [`email.eq.${autoEmail}`, `email.eq.${waPrefixEmail}`]);
      const userRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?${phoneQuery}&limit=1`,
        { headers }
      );
      const userRows = userRes.ok ? await userRes.json() : [];

      if (!userRows.length) {
        // Also check auth.users by phone
        let authExists = false;
        try {
          const authListRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers });
          if (authListRes.ok) {
            const authData = await authListRes.json();
            const authUsers = authData.users || authData;
            authExists = authUsers.some(u => u.phone === `+${cleanPhone}` || u.phone === cleanPhone);
          }
        } catch (_) {}

        if (!authExists) {
          return res.status(404).json({
            error: 'No account found with this WhatsApp number.',
            needsRegistration: true,
          });
        }
      }
    } catch (e) {
      console.warn('User existence check failed:', e.message);
      // Non-fatal — continue with OTP send
    }
  }

  // Rate limit: 1 OTP per phone per 60s
  try {
    const recentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/otp_codes?phone=eq.${cleanPhone}&order=created_at.desc&limit=1`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    if (recentRes.ok) {
      const recent = await recentRes.json();
      if (recent.length > 0) {
        const ageSeconds = (Date.now() - new Date(recent[0].created_at).getTime()) / 1000;
        if (ageSeconds < 60)
          return res.status(429).json({ error: `Please wait ${Math.ceil(60 - ageSeconds)} seconds before requesting another code.` });
      }
    }
  } catch (_) {}

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const token = generateToken();
  const verifyLink = `${APP_URL}/verify-link?t=${token}`;

  // Store in otp_codes table (5-min expiry)
  try {
    const storeRes = await fetch(`${SUPABASE_URL}/rest/v1/otp_codes`, {
      method: 'POST',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ phone: cleanPhone, code, token, expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), used: false }),
    });
    if (!storeRes.ok) { console.error('Failed to store OTP:', await storeRes.text()); return res.status(500).json({ error: 'Failed to generate code' }); }
  } catch (err) { console.error('OTP store error:', err.message); return res.status(500).json({ error: 'Failed to generate code' }); }

  // Send via WhatsApp Business Cloud API
  try {
    const waRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanPhone,
        type: 'template', template: { name: 'otp_verification', language: { code: 'en_US' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }] },
      }),
    });

    if (!waRes.ok) {
      console.error('WhatsApp template send failed:', JSON.stringify(await waRes.json().catch(() => ({}))));
      const messageBody =
        `🔐 *Chibondo Academy*\n\n` +
        `Tap this link to verify your login:\n${verifyLink}\n\n` +
        `Or enter code: *${code}*\n\n` +
        `Expires in 5 minutes. Don't share it with anyone.`;

      const fallbackRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanPhone, type: 'text', text: { body: messageBody } }),
      });
      if (!fallbackRes.ok) {
        console.error('[wa-otp] All WhatsApp delivery methods failed, returning on-screen code');
        return res.status(200).json({ ok: true, phone: cleanPhone, message: 'Showing code on screen', delivery_method: 'onscreen', fallback_code: code });
      }
    }
  } catch (err) {
    console.error('WhatsApp send error:', err.message, '— returning on-screen code');
    return res.status(200).json({ ok: true, phone: cleanPhone, message: 'Showing code on screen', delivery_method: 'onscreen', fallback_code: code });
  }

  return res.status(200).json({ ok: true, phone: cleanPhone, message: 'Verification code sent via WhatsApp', delivery_method: 'whatsapp' });
}

// ─── VERIFY ──────────────────────────────────────────────────────────────────

async function derivePassword(phone, secret) {
  const data = new TextEncoder().encode(`${phone}:${secret}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function verifyOTP(req, res) {
  const { phone, code, token, name, mode } = req.body || {};
  if (!code && !token) return res.status(400).json({ error: 'Verification code or token is required' });

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const OTP_SECRET = process.env.OTP_SECRET || 'chibondo-wa-otp-2026';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Server configuration error' });

  let cleanPhone = phone ? normalisePhone(phone) : '';

  // 1. Verify the OTP code or token
  try {
    let verifyRes;
    if (token) {
      verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/otp_codes?token=eq.${token}&used=eq.false&order=created_at.desc&limit=1`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } });
    } else {
      verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/otp_codes?phone=eq.${cleanPhone}&used=eq.false&order=created_at.desc&limit=5`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } });
    }

    if (!verifyRes.ok) { console.error('OTP lookup failed:', await verifyRes.text()); return res.status(500).json({ error: 'Verification failed' }); }

    const otpRecords = await verifyRes.json();
    const now = new Date();
    let validOtp;
    if (token) {
      validOtp = otpRecords.find(r => !r.used && new Date(r.expires_at) > now);
      if (validOtp) cleanPhone = validOtp.phone;
    } else {
      validOtp = otpRecords.find(r => r.code === String(code) && !r.used && new Date(r.expires_at) > now);
    }

    if (!validOtp) return res.status(400).json({ error: 'Invalid or expired verification. Please try again.' });

    // Mark as used
    await fetch(`${SUPABASE_URL}/rest/v1/otp_codes?id=eq.${validOtp.id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ used: true }),
    });
  } catch (err) { console.error('OTP verify error:', err.message); return res.status(500).json({ error: 'Verification failed' }); }

  // 2. Find or create user
  try {
    const autoEmail = `${cleanPhone}@chibondoacademy.com`;
    const waPrefixEmail = `wa_${cleanPhone}@chibondoacademy.com`;
    const password = await derivePassword(cleanPhone, OTP_SECRET);

    const headers = {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    };

    // Look up by phone_number (both +265... and 265... formats) OR auto-generated emails
    // Settings saves phone as +265..., OTP system uses 265... — must check both
    const phoneQuery = buildPhoneOrQuery(cleanPhone, [`email.eq.${autoEmail}`, `email.eq.${waPrefixEmail}`]);
    const userRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?${phoneQuery}&limit=1`,
      { headers }
    );
    const userRows = userRes.ok ? await userRes.json() : [];
    const existingUser = userRows[0];

    // Also check auth.users by phone (catches users created by wa-register.js)
    let authUserId = null;
    if (!existingUser) {
      try {
        const authListRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers });
        if (authListRes.ok) {
          const authData = await authListRes.json();
          const authUsers = authData.users || authData;
          const match = authUsers.find(u => u.phone === `+${cleanPhone}` || u.phone === cleanPhone);
          if (match) {
            authUserId = match.id;
            console.log(`Found existing auth user ${authUserId} for phone ${cleanPhone}, email: ${match.email}`);
          }
        }
      } catch (e) { console.warn('Auth lookup failed:', e.message); }
    }

    if (!existingUser) {
      // Login mode: don't create a new account
      if (mode === 'login') {
        return res.status(404).json({
          error: 'No account found with this number. Please register first.',
          needsRegistration: true,
        });
      }
      // Create auth user — only if one doesn't already exist
      if (!authUserId) {
        const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: autoEmail, password, email_confirm: true, phone: `+${cleanPhone}`,
            user_metadata: { phone_number: cleanPhone, full_name: name || '', auth_method: 'whatsapp_otp' },
          }),
        });

        // Read the body ONCE and store it
        const createBody = await createRes.json().catch(() => ({}));

        if (!createRes.ok) {
          const errMsg = createBody?.msg || '';
          if (!errMsg.toLowerCase().includes('already')) {
            console.error('User creation failed:', JSON.stringify(createBody));
            return res.status(500).json({ error: 'Failed to create account' });
          }
          // "already exists" — try to find the existing auth user by email
          console.log('Auth user already exists, attempting lookup...');
        } else {
          authUserId = createBody.id;
        }
      }

      // Generate a UUID for the users table row
      const usersTableId = authUserId || crypto.randomUUID();

      // Generate a unique referral code for the new user
      const referralCode = await generateUniqueReferralCode(SUPABASE_URL, headers, name || cleanPhone);

      // Create the users table row with a guaranteed non-null id
      const newUserRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          id: usersTableId,
          email: autoEmail,
          full_name: name || '',
          role: 'user',
          phone_number: cleanPhone,
          referral_code: referralCode,
          whatsapp_notifications: true,
          email_notifications: true,
          inapp_notifications: true,
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        }),
      });

      if (!newUserRes.ok) {
        const errText = await newUserRes.text();
        console.error('users table insert failed:', errText);
        // Non-fatal — the auth user exists, sign-in can still work
      } else {
        console.log(`Created users table row for ${cleanPhone} (id: ${usersTableId})`);
      }
    } else {
      // ── Update phone_number and name for existing users ──
      const updates = {};
      const storedPhone = existingUser.phone_number || '';
      const storedPhoneClean = storedPhone.replace(/^\+/, '');
      if (!storedPhone || storedPhoneClean !== cleanPhone) updates.phone_number = '+' + cleanPhone;
      if (name && !existingUser.full_name) updates.full_name = name;
      if (Object.keys(updates).length > 0) {
        updates.updated_date = new Date().toISOString();
        await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${existingUser.id}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify(updates),
        });
        console.log(`Updated ${Object.keys(updates).join(', ')} for existing user ${existingUser.id}`);
      }
    }

    // ── 3. Sign in ──────────────────────────────────────────────────────────
    //
    // Two strategies depending on how the user registered:
    //
    // A) Email-registered user (has a real email, not a phone-derived placeholder):
    //    Their auth password was set by THEM at registration. We must NOT change it.
    //    Instead, use the admin API to generate a magic link for their account,
    //    then exchange it for a session — no password needed, no password changed.
    //    Their email password keeps working as before.
    //
    // B) WhatsApp-registered user (phone-derived placeholder email):
    //    Their auth password was set by our derivePassword() function at registration.
    //    Sign in with the derived password directly.

    const isEmailRegistered = existingUser?.email && !isPlaceholderEmail(existingUser.email);

    if (existingUser && isEmailRegistered) {
      // ── Strategy A: Magic link for email-registered users ──
      try {
        // Step 1: Generate a magic link via admin API
        const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ type: 'magiclink', email: existingUser.email }),
        });

        if (!linkRes.ok) {
          console.error('Magic link generation failed:', await linkRes.text());
          throw new Error('Magic link generation failed');
        }

        const linkData = await linkRes.json();
        const actionLink = linkData.action_link;
        if (!actionLink) throw new Error('No action_link in response');

        // Step 2: Follow the verify URL to get session tokens
        // The verify endpoint returns a 303 redirect with tokens in the URL fragment
        const verifyUrl = new URL(actionLink);
        const verifyResp = await fetch(verifyUrl, {
          method: 'GET',
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
          redirect: 'manual', // Don't follow the redirect — we want the Location header
        });

        // The redirect Location contains the tokens in a URL fragment: #access_token=...&refresh_token=...
        const location = verifyResp.headers.get('location') || '';
        if (!location || !location.includes('access_token=')) {
          // Some Supabase versions return the tokens in the body instead
          const body = await verifyResp.text();
          const match = body.match(/access_token=([^&"']+)/);
          if (!match) throw new Error('No access_token in verify response');
          const accessToken = decodeURIComponent(match[1]);
          const refreshMatch = body.match(/refresh_token=([^&"']+)/);
          const refreshToken = refreshMatch ? decodeURIComponent(refreshMatch[1]) : undefined;

          console.log(`Magic link sign-in successful for ${cleanPhone} via ${existingUser.email}`);
          return res.status(200).json({
            ok: true,
            access_token: accessToken,
            refresh_token: refreshToken,
            user: { phone: cleanPhone, isNew: false },
          });
        }

        // Parse tokens from the Location header fragment
        const fragment = location.split('#')[1] || '';
        const params = new URLSearchParams(fragment);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (!accessToken) throw new Error('No access_token in redirect');

        console.log(`Magic link sign-in successful for ${cleanPhone} via ${existingUser.email}`);
        return res.status(200).json({
          ok: true,
          access_token: accessToken,
          refresh_token: refreshToken,
          user: { phone: cleanPhone, isNew: false },
        });
      } catch (magicErr) {
        console.error('Magic link sign-in failed:', magicErr.message);
        // Fall through to password-based sign-in as fallback
      }
    }

    // ── Strategy B: Password-based sign-in (for WA-registered users) ──
    const emailsToTry = [];
    // WA-registered users have phone-derived emails
    if (!emailsToTry.includes(autoEmail)) emailsToTry.push(autoEmail);
    if (!emailsToTry.includes(waPrefixEmail)) emailsToTry.push(waPrefixEmail);
    // Also try existing user's email (might be a placeholder we can still use)
    if (existingUser?.email && !emailsToTry.includes(existingUser.email)) emailsToTry.push(existingUser.email);

    for (const tryEmail of emailsToTry) {
      const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tryEmail, password }),
      });

      if (signInRes.ok) {
        const authData = await signInRes.json();
        console.log(`Signed in ${cleanPhone} via email: ${tryEmail}`);
        return res.status(200).json({
          ok: true,
          access_token: authData.access_token,
          refresh_token: authData.refresh_token,
          user: { phone: cleanPhone, isNew: !existingUser },
        });
      }
      console.log(`Sign-in attempt failed for ${tryEmail}`);
    }

    // All sign-in attempts failed
    console.error('All sign-in attempts failed for phone:', cleanPhone);
    return res.status(500).json({ error: 'Authentication failed. Please try again.' });
  } catch (err) {
    console.error('Auth flow error:', err.message);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}


// ─── Generate a unique referral code from a user's name ────────────────────────
function isPlaceholderEmail(email) {
  if (!email) return true;
  return (
    email.includes('@student.chibondoacademy.com') ||
    /^\d+@chibondoacademy\.com$/.test(email) ||
    /^wa_\d+@chibondoacademy\.com$/.test(email)
  );
}

async function generateUniqueReferralCode(SUPABASE_URL, headers, fullName) {
  // Extract first 4 letters of first name (alpha only)
  const base = (fullName || 'USER')
    .trim()
    .split(/\s+/)[0]
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X'); // pad if name is too short

  // Try up to 10 times with different random suffixes
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    const code = `${base}${suffix}`;

    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?referral_code=eq.${encodeURIComponent(code)}&select=id&limit=1`,
      { headers }
    );
    const checkData = await checkRes.json().catch(() => []);
    if (!checkData || checkData.length === 0) return code; // available!
  }

  // Fallback: use a longer random code
  return `USER${Date.now().toString().slice(-6)}`;
}

// ─── Check uniqueness (phone, email, referral code) ────────────────────────────
async function checkUniqueness(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
  };

  const { phone, email, referralCode, excludeUserId } = req.query;
  const result = { phoneAvailable: true, emailAvailable: true, referralCodeAvailable: true };

  try {
    // Check phone uniqueness (try both with and without + prefix)
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const phoneVariants = [cleanPhone, `+${cleanPhone}`];
      let found = false;
      for (const p of phoneVariants) {
        let query = `phone_number=eq.${encodeURIComponent(p)}`;
        if (excludeUserId) query += `&id=neq.${excludeUserId}`;
        const res = await fetch(`${SUPABASE_URL}/rest/v1/users?${query}&select=id&limit=1`, { headers });
        const data = await res.json().catch(() => []);
        if (data && data.length > 0) { found = true; break; }
      }
      result.phoneAvailable = !found;
    }

    // Check email uniqueness
    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      let query = `email=eq.${encodeURIComponent(cleanEmail)}`;
      if (excludeUserId) query += `&id=neq.${excludeUserId}`;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/users?${query}&select=id&limit=1`, { headers });
      const data = await res.json().catch(() => []);
      result.emailAvailable = !data || data.length === 0;
    }

    // Check referral code uniqueness
    if (referralCode) {
      const cleanCode = referralCode.trim().toUpperCase();
      let query = `referral_code=eq.${encodeURIComponent(cleanCode)}`;
      if (excludeUserId) query += `&id=neq.${excludeUserId}`;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/users?${query}&select=id&limit=1`, { headers });
      const data = await res.json().catch(() => []);
      result.referralCodeAvailable = !data || data.length === 0;
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('[check-uniqueness] Error:', err.message);
    return res.status(500).json({ error: 'Uniqueness check failed' });
  }
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;

  // check-uniqueness is a GET endpoint
  if (action === 'check-uniqueness') return checkUniqueness(req, res);

  // All other actions require POST
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (action === 'send') return sendOTP(req, res);
  if (action === 'verify') return verifyOTP(req, res);

  return res.status(400).json({ error: 'Invalid action. Use ?action=send, ?action=verify, or ?action=check-uniqueness' });
}
