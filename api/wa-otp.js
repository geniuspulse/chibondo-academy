/**
 * redeploy trigger: 2026-08-05
 * WhatsApp OTP & Webhook — Combined Serverless Function
 *
 * GET  /api/wa-otp?action=check-uniqueness   — phone/email uniqueness check
 * POST /api/wa-otp  { action: "send", phone } — generate & send OTP (templates)
 * POST /api/wa-otp  { action: "verify", ... }  — verify code/token, issue session
 * POST /api/wa-otp  { action: "generate-link", phone } — generate magic link (for AI agent)
 * GET  /api/wa-otp?hub.mode=subscribe&...     — Meta webhook verification
 * POST /api/wa-otp  { entry: [...] }          — Meta incoming message webhook
 *
 * Incoming messages with body "login" trigger a magic-link reply (free-form
 * text within the 24h customer service window — no template approval needed).
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
  // Delivery priority:
  //   1. login_verification template (Authentication, Copy-code button) — needs template approval
  //   2. otp_verification template (code only) — needs template approval
  //   3. Free-form text message — works WITHOUT template approval, but ONLY if the
  //      user has messaged our business number within the last 24 hours ( Meta's
  //      24-hour customer service window). This is the secure fallback: the code
  //      goes to the user's actual WhatsApp on their phone, not a browser screen.
  //   4. If all three fail → return an error telling the user to message the
  //      business number first so the 24h window opens.
  try {
    // Attempt 1: login_verification template
    const waRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanPhone,
        type: 'template', template: { name: 'login_verification', language: { code: 'en_US' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'copy_code', index: '0', parameters: [{ type: 'coupon_code', coupon_code: code }] },
          ]},
      }),
    });

    if (waRes.ok) {
      return res.status(200).json({ ok: true, phone: cleanPhone, message: 'Verification code sent via WhatsApp', delivery_method: 'whatsapp' });
    }
    console.error('[wa-otp] login_verification template failed:', JSON.stringify(await waRes.json().catch(() => ({}))));

    // Attempt 2: otp_verification template
    const otpRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanPhone,
        type: 'template', template: { name: 'otp_verification', language: { code: 'en_US' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }] },
      }),
    });

    if (otpRes.ok) {
      return res.status(200).json({ ok: true, phone: cleanPhone, message: 'Verification code sent via WhatsApp', delivery_method: 'whatsapp' });
    }
    console.error('[wa-otp] otp_verification template failed:', JSON.stringify(await otpRes.json().catch(() => ({}))));

    // Attempt 3: Free-form text message (works within 24h customer service window)
    const messageBody =
      `*Chibondo Academy*\n\n` +
      `Your verification code is: *${code}*\n\n` +
      `Or tap to verify: ${verifyLink}\n\n` +
      `Expires in 5 minutes. Do not share it with anyone.`;

    const textRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanPhone, type: 'text', text: { body: messageBody } }),
    });

    if (textRes.ok) {
      return res.status(200).json({ ok: true, phone: cleanPhone, message: 'Verification code sent via WhatsApp', delivery_method: 'whatsapp' });
    }
    console.error('[wa-otp] free-form text also failed:', JSON.stringify(await textRes.json().catch(() => ({}))));

    // All delivery methods failed — user likely hasn't messaged the business
    // number recently, so the 24h window is closed AND templates aren't approved.
    // Do NOT show the code on screen (security risk). Instead instruct the user.
    return res.status(200).json({
      ok: true, phone: cleanPhone,
      message: 'Could not deliver code via WhatsApp.',
      delivery_method: 'initiate_required',
      verify_link: verifyLink,
    });

  } catch (err) {
    console.error('WhatsApp send error:', err.message);
    return res.status(200).json({
      ok: true, phone: cleanPhone,
      message: 'Could not deliver code via WhatsApp.',
      delivery_method: 'initiate_required',
      verify_link: verifyLink,
    });
  }
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



// ─── GENERATE LINK (for Nyasadesk AI agent) ─────────────────────────────────
// POST /api/wa-otp  { action: "generate-link", phone: "265..." }
//
// Called by the Nyasadesk AI agent when a student in the WhatsApp chat wants
// to start learning. Generates a magic-link token and returns the verify URL
// so the agent can include it directly in its chat reply — no separate
// WhatsApp message needed, since the student is already in the conversation.
//
// Security: requires a shared secret (OTP_SECRET) in the Authorization header
// so only the Nyasadesk backend (or Chibondo's own frontend) can call it.

async function generateLink(req, res) {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  const cleanPhone = normalisePhone(phone);
  if (cleanPhone.length < 12 || cleanPhone.length > 13)
    return res.status(400).json({ error: 'Invalid phone number' });

  // Verify the shared secret
  const OTP_SECRET = process.env.OTP_SECRET || 'chibondo-wa-otp-2026';
  const authHeader = req.headers.authorization || '';
  const providedSecret = authHeader.replace(/^Bearer\s+/i, '');
  if (providedSecret !== OTP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const APP_URL = process.env.APP_URL || 'https://chibondoacademy.com';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)
    return res.status(500).json({ error: 'Server configuration error' });

  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  };

  // Check if user exists
  const autoEmail = `${cleanPhone}@chibondoacademy.com`;
  const waPrefixEmail = `wa_${cleanPhone}@chibondoacademy.com`;
  const phoneQuery = buildPhoneOrQuery(cleanPhone, [`email.eq.${autoEmail}`, `email.eq.${waPrefixEmail}`]);
  const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?${phoneQuery}&limit=1`, { headers });
  const userRows = userRes.ok ? await userRes.json() : [];
  const userExists = userRows.length > 0;

  // Rate limit: 1 link per phone per 60s
  const recentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/otp_codes?phone=eq.${cleanPhone}&order=created_at.desc&limit=1`,
    { headers }
  );
  if (recentRes.ok) {
    const recent = await recentRes.json();
    if (recent.length > 0) {
      const ageSeconds = (Date.now() - new Date(recent[0].created_at).getTime()) / 1000;
      if (ageSeconds < 60) {
        // Return the existing valid link if it's still active
        const existingToken = recent[0].token;
        if (existingToken && !recent[0].used && new Date(recent[0].expires_at) > new Date()) {
          const link = `${APP_URL}/verify-link?t=${existingToken}`;
          return res.status(200).json({
            ok: true,
            link,
            phone: cleanPhone,
            registered: userExists,
            name: userRows[0]?.full_name || null,
            reused: true,
          });
        }
        return res.status(429).json({ error: `Please wait ${Math.ceil(60 - ageSeconds)} seconds` });
      }
    }
  }

  // Generate new token
  const token = generateToken();
  const code  = String(Math.floor(100000 + Math.random() * 900000));
  const link  = `${APP_URL}/verify-link?t=${token}`;

  // Store in otp_codes
  const storeRes = await fetch(`${SUPABASE_URL}/rest/v1/otp_codes`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      phone: cleanPhone, code, token,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      used: false,
    }),
  });

  if (!storeRes.ok) {
    const errText = await storeRes.text().catch(() => '');
    console.error('[wa-otp/generate-link] store failed:', storeRes.status, errText.slice(0, 300));
    return res.status(500).json({ error: 'Failed to generate link' });
  }

  console.log(`[wa-otp/generate-link] generated for ${cleanPhone}, registered=${userExists}`);

  return res.status(200).json({
    ok: true,
    link,
    phone: cleanPhone,
    registered: userExists,
    name: userRows[0]?.full_name || null,
    expires_in_seconds: 300,
  });
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

// ─── WEBHOOK: Incoming WhatsApp Messages ───────────────────────────────────
// Meta sends a GET for webhook subscription verification, then POST events
// when users message the business number.  When a user sends "login" (or
// similar), we reply with a one-tap magic link — free-form text within the
// 24-hour customer service window, so no template approval is needed.

async function handleWebhookVerification(req, res) {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const VERIFY_TOKEN = process.env.WA_WEBHOOK_VERIFY_TOKEN || 'chibondo_webhook_2026';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[wa-otp/webhook] verification OK');
    return res.status(200).send(challenge);
  }
  console.error('[wa-otp/webhook] verification failed', { mode, hasToken: !!token });
  return res.status(403).json({ error: 'Webhook verification failed' });
}

async function handleIncomingMessage(req, res) {
  // IMPORTANT: do NOT send the response before processing finishes.
  // Vercel serverless functions can freeze/tear down the execution
  // context as soon as the HTTP response is flushed — any awaited work
  // still in flight after that point gets silently killed. That was
  // causing magic-link generation + WhatsApp replies to never actually
  // fire, even though Meta got a 200 immediately. We now do all the work
  // FIRST and respond 200 at the very end (see bottom of this function).
  // Meta tolerates this fine — it only retries on non-2xx or real timeout
  // (well under its ~20s window for our few Supabase/Graph API calls).

  const body = req.body;
  if (!body?.entry) return res.status(200).json({ received: true });

  const WA_TOKEN   = process.env.WA_ACCESS_TOKEN;
  const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
  const APP_URL    = process.env.APP_URL || 'https://chibondoacademy.com';
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!WA_TOKEN || !WA_PHONE_ID || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[wa-otp/webhook] missing env vars');
    return res.status(200).json({ received: true });
  }

  try {
    for (const entry of body.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const messages = change?.value?.messages;
        if (!messages?.length) continue;

        for (const msg of messages) {
          const fromPhone = msg.from;           // e.g. "265991234567"
          const text     = msg.text?.body?.trim() || '';
          const lower     = text.toLowerCase();

          // Respond to login and registration requests
          const isRegister = lower.startsWith('register');
          const isReset = lower.startsWith('reset') || lower.includes('forgot');
          const isLogin = lower.includes('login') || lower.includes('verify') || lower.includes('hi') || lower.includes('hello') || lower.includes('start');
          if (!isLogin && !isRegister && !isReset) {
            console.log('[wa-otp/webhook] ignoring message:', text.slice(0, 50));
            continue;
          }

          console.log('[wa-otp/webhook] login request from', fromPhone, ':', text.slice(0, 80));

          // Look up the user by phone number
          const autoEmail      = `${fromPhone}@chibondoacademy.com`;
          const waPrefixEmail   = `wa_${fromPhone}@chibondoacademy.com`;
          const headers = {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          };

          // Use the shared helper (same as sendOTP) — it properly
          // percent-encodes the "+" as %2B. Building this string by hand
          // with a raw "+" was silently broken: in a URL query string an
          // unencoded "+" means "space", so phone_number.eq.+265... was
          // actually querying for phone_number.eq.<space>265... and never
          // matched numbers stored with a "+" prefix (e.g. "+265893454156"),
          // making registered admin/student numbers look unregistered.
          const phoneQuery = buildPhoneOrQuery(fromPhone, [`email.eq.${autoEmail}`, `email.eq.${waPrefixEmail}`]);
          const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?${phoneQuery}&limit=1`, { headers });
          const userRows = userRes.ok ? await userRes.json() : [];

          // Rate limit: check last OTP for this phone
          const recentRes = await fetch(
            `${SUPABASE_URL}/rest/v1/otp_codes?phone=eq.${fromPhone}&order=created_at.desc&limit=1`,
            { headers }
          );
          if (recentRes.ok) {
            const recent = await recentRes.json();
            if (recent.length > 0) {
              const ageSeconds = (Date.now() - new Date(recent[0].created_at).getTime()) / 1000;
              if (ageSeconds < 60) {
                await sendTextReply(fromPhone, `Please wait ${Math.ceil(60 - ageSeconds)}s before requesting another link.`);
                continue;
              }
            }
          }

          // Generate magic link token (and a code — the otp_codes table has
          // a NOT NULL constraint on code, even though handleIncomingMessage
          // only uses the token for magic-link verification)
          const token = generateToken();
          const code  = String(Math.floor(100000 + Math.random() * 900000));
          const linkSuffix = isReset ? '&reset=true' : '';
          const verifyLink = `${APP_URL}/verify-link?t=${token}${linkSuffix}`;

          // Store in otp_codes (5-min expiry) — check for errors so failures
          // are visible instead of silently swallowed
          const otpStoreRes = await fetch(`${SUPABASE_URL}/rest/v1/otp_codes`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
            body: JSON.stringify({
              phone: fromPhone, code, token,
              expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
              used: false,
            }),
          });
          if (!otpStoreRes.ok) {
            const errText = await otpStoreRes.text().catch(() => '');
            console.error('[wa-otp/webhook] OTP store failed:', otpStoreRes.status, errText.slice(0, 300));
            await sendTextReply(fromPhone, 'Sorry, something went wrong. Please try again in a moment.');
            continue;
          }

          // Reply with magic link (free-form text — within 24h window)
          if (isReset) {
            const name = userRows.length > 0 ? (userRows[0].full_name || 'there') : 'there';
            await sendTextReply(fromPhone,
              `Hi ${name}! 🔒\n\n` +
              `Tap here to set a new password:\n${verifyLink}\n\n` +
              `Link expires in 5 minutes. Do not share it with anyone.`
            );
            continue;
          }

          if (isRegister) {
            // Registration flow — create the account via wa-register endpoint
            const parts = text.split(/\s+/);
            const regPhone = parts[1] || fromPhone;
            const regName  = parts.slice(2).join(' ') || 'Student';
            try {
              const regRes = await fetch(`${APP_URL}/api/wa-register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: regPhone, full_name: regName }),
              });
              const regData = await regRes.json().catch(() => ({}));
              if (regRes.ok && regData.ok) {
                await sendTextReply(fromPhone,
                  `Welcome to Chibondo Academy, ${regName}! 🎉\n\n` +
                  `Tap here to verify and log in:\n${verifyLink}\n\n` +
                  `Link expires in 5 minutes.`
                );
              } else {
                await sendTextReply(fromPhone,
                  `Hi ${regName}! 👋\n\n` +
                  `Tap here to verify your number:\n${verifyLink}\n\n` +
                  `Link expires in 5 minutes.`
                );
              }
            } catch (regErr) {
              console.error('[wa-otp/webhook] register call failed:', regErr.message);
              await sendTextReply(fromPhone,
                `Welcome! 🎓\n\nTap here to verify:\n${verifyLink}\n\n` +
                `Expires in 5 minutes.`
              );
            }
          } else if (userRows.length > 0) {
            const name = userRows[0].full_name || 'there';
            await sendTextReply(fromPhone,
              `Hi ${name}! 👋\n\n` +
              `Tap here to log in to Chibondo Academy:\n${verifyLink}\n\n` +
              `Link expires in 5 minutes. Do not share it with anyone.`
            );
          } else {
            await sendTextReply(fromPhone,
              `Welcome to Chibondo Academy! 🎓\n\n` +
              `We don't have an account for this number yet.\n` +
              `Register here: ${APP_URL}/register\n\n` +
              `Or tap: ${verifyLink} to verify your number first.`
            );
          }
        }
      }
    }
  } catch (err) {
    console.error('[wa-otp/webhook] error:', err.message);
  }

  // Respond to Meta only now that all processing (and the WhatsApp reply
  // send) has actually completed — see note at top of this function.
  return res.status(200).json({ received: true });
}

async function sendTextReply(to, message) {
  const WA_TOKEN    = process.env.WA_ACCESS_TOKEN;
  const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
  try {
    const r = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', recipient_type: 'individual',
        to, type: 'text', text: { body: message },
      }),
    });
    if (!r.ok) {
      const errBody = await r.text().catch(() => '');
      console.error('[wa-otp/webhook] Graph API send failed:', r.status, errBody.slice(0, 300));
    }
  } catch (err) {
    console.error('[wa-otp/webhook] reply failed:', err.message);
  }
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────


// ─── BROADCAST (send login-link messages to a list of numbers) ─────────────
async function handleBroadcast(req, res) {
  const { phones, message_template } = req.body || {};
  if (!Array.isArray(phones) || phones.length === 0) {
    return res.status(400).json({ error: 'phones array is required' });
  }

  const SUPABASE_URL   = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const OTP_SECRET     = process.env.OTP_SECRET || 'chibondo-wa-otp-2026';
  const APP_URL        = process.env.VITE_APP_URL || process.env.APP_URL || 'https://chibondoacademy.com';
  const WA_TOKEN       = process.env.WA_ACCESS_TOKEN;
  const WA_PHONE_ID    = process.env.WA_PHONE_NUMBER_ID;

  if (!WA_TOKEN || !WA_PHONE_ID) {
    return res.status(500).json({ error: 'WhatsApp credentials not configured' });
  }

  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  const results = [];

  for (const rawPhone of phones) {
    const normPhone = normalisePhone(rawPhone);
    const autoEmail = `${normPhone}@chibondoacademy.com`;

    try {
      // 1. Check if user exists
      const phoneQuery = buildPhoneOrQuery(normPhone, [`email.eq.${autoEmail}`]);
      const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?${phoneQuery}&limit=1`, { headers });
      const userRows = userRes.ok ? await userRes.json() : [];
      const userRow = userRows[0];
      let userExists = !!userRow;
      let fullName = userRow?.full_name || '';

      // 2. Fix auth password for existing WhatsApp-registered users
      if (userRow?.id) {
        const correctPassword = await derivePassword(normPhone, OTP_SECRET);
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userRow.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ password: correctPassword }),
        });
        console.log(`[broadcast] Fixed auth password for ${normPhone}`);
      }

      // 3. Generate magic-link token
      const token = generateToken();
      const verifyLink = `${APP_URL}/verify-link?t=${token}`;

      const otpInsertRes = await fetch(`${SUPABASE_URL}/rest/v1/otp_codes`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          phone: normPhone,
          code: String(Math.floor(100000 + Math.random() * 900000)),
          token,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          used: false,
        }),
      });

      if (!otpInsertRes.ok) {
        console.error(`[broadcast] OTP insert failed for ${normPhone}`);
        results.push({ phone: normPhone, ok: false, error: 'Failed to generate login link' });
        continue;
      }

      // 4. Build message
      const greeting = fullName ? `Hi ${fullName}!` : 'Hi!';
      const messageText = (message_template || 'Hi!\n\nUse this link to log in:\n{login_link}')
        .replace('{greeting}', greeting)
        .replace('{login_link}', verifyLink);

      // 5. Send WhatsApp text message
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
        console.warn(`[broadcast] Text failed for ${normPhone}, trying template`);

        const code = String(Math.floor(100000 + Math.random() * 900000));
        await fetch(`${SUPABASE_URL}/rest/v1/otp_codes?token=eq.${token}`, {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({ code }),
        });

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

        if (tmplRes.ok) {
          console.log(`[broadcast] Template sent to ${normPhone} ✓ (fallback)`);
          results.push({ phone: normPhone, ok: true, user_exists: userExists, link: verifyLink, delivery: 'template_fallback' });
        } else {
          console.error(`[broadcast] Both sends failed for ${normPhone}`);
          results.push({ phone: normPhone, ok: false, error: 'Send failed (outside 24h window)', link: verifyLink });
        }
      }
    } catch (err) {
      console.error(`[broadcast] Error for ${normPhone}:`, err.message);
      results.push({ phone: normPhone, ok: false, error: err.message });
    }

    await new Promise(r => setTimeout(r, 500));
  }

  const sent = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  return res.status(200).json({ ok: true, total: results.length, sent, failed, results });
}


export default async function handler(req, res) {
  // Meta webhook verification (GET)
  if (req.method === 'GET') {
    const action = req.query.action;
    if (action === 'check-uniqueness') return checkUniqueness(req, res);
    // If hub.mode is present, it's Meta webhook verification
    if (req.query['hub.mode']) return handleWebhookVerification(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // POST requests
  if (req.method === 'POST') {
    // Meta incoming message webhook (has entry array, no action field)
    if (req.body?.entry && !req.body?.action && !req.query.action) {
      return handleIncomingMessage(req, res);
    }
    const action = req.query.action || req.body?.action;
    if (action === 'send')           return sendOTP(req, res);
    if (action === 'verify')        return verifyOTP(req, res);
  if (action === 'broadcast')      return handleBroadcast(req, res);
    if (action === 'generate-link') return generateLink(req, res);
    return res.status(400).json({ error: 'Invalid action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
