// Vercel serverless function — /api/direct-charge
// Paychangu Direct Charge Mobile Money — inline payment without redirect.
// The student stays on chibondoacademy.com the entire time.
//
// Actions:
//   GET  ?action=operators              → list supported MoMo operators
//   POST ?action=charge                → initiate a mobile money charge
//   POST ?action=verify                → poll a charge's status + activate subscription
//
// Auth: all actions require the caller to be logged-in (we trust the frontend
// for now — the secret key stays server-side).

const PAYCHANGU_SECRET = process.env.PAYCHANGU_SECRET_KEY;
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SRK     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WA_TOKEN         = process.env.WA_ACCESS_TOKEN;
const WA_PHONE_ID      = process.env.WA_PHONE_NUMBER_ID;

const PLAN_MONTHS = { monthly: 1, annual: 12, biannual: 24 };
const COMMISSION_AMOUNT = 10000; // MWK

// Operators are static (Paychangu supports TNM + Airtel in Malawi).
// We hard-code to avoid an extra round-trip; the GET endpoint refreshes from
// the live API as a fallback.
const OPERATORS = [
  { id: 1, name: 'TNM Mpamba',    ref_id: '27494cb5-ba9e-437f-a114-4e7a7686bcca', short_code: 'tnm' },
  { id: 2, name: 'Airtel Money',  ref_id: '20be6c20-adeb-4b5b-a7ba-0769820df4fb', short_code: 'airtel' },
];

function normalisePhone(raw) {
  let p = String(raw).replace(/\D/g, '');
  if (p.startsWith('0')) p = '265' + p.slice(1);
  if (!p.startsWith('265')) p = '265' + p;
  return p;
}

// PayChangu expects 9-digit phone numbers WITHOUT country code (e.g. 991234567)
function paychanguPhone(raw) {
  let p = String(raw).replace(/\D/g, '');
  if (p.startsWith('265')) p = p.slice(3);
  if (p.startsWith('0'))   p = p.slice(1);
  return p; // 9 digits, no country code
}

// Auto-detect mobile network from phone number prefix
// Malawi: 08* → TNM (088, 089, 081, etc.), 09* → Airtel (099, 098, 091, etc.)
function detectOperator(phoneStr) {
  let p = String(phoneStr).replace(/\D/g, '');
  if (p.startsWith('265')) p = p.slice(3);
  if (p.startsWith('0'))   p = p.slice(1);
  if (p.startsWith('8'))  return { name: 'TNM Mpamba',   ref_id: '27494cb5-ba9e-437f-a114-4e7a7686bcca' };
  if (p.startsWith('9'))  return { name: 'Airtel Money', ref_id: '20be6c20-adeb-4b5b-a7ba-0769820df4fb' };
  return null;
}

function generateChargeId(userId, plan) {
  const ts  = Date.now().toString(36).toUpperCase();
  const uid = (userId || 'ANON').slice(-6).toUpperCase();
  return `DC-${plan.toUpperCase().slice(0,3)}-${uid}-${ts}`;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: SUPABASE_SRK, Authorization: `Bearer ${SUPABASE_SRK}`, Accept: 'application/json' },
  });
  return r.json();
}
async function sbPost(path, body) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_SRK, Authorization: `Bearer ${SUPABASE_SRK}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(body),
  });
}
async function sbPatch(path, body) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'PATCH',
    headers: { apikey: SUPABASE_SRK, Authorization: `Bearer ${SUPABASE_SRK}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
}

// ── Pricing ───────────────────────────────────────────────────────────────────
async function getPricing() {
  try {
    const rows = await sbGet('/platform_settings?limit=50');
    const row = (Array.isArray(rows) ? rows : []).find(r => r.key === 'pricing');
    const cfg = row?.value;
    if (cfg?.monthly_price) return {
      monthly: cfg.monthly_price || 10000,
      annual: cfg.annual_price || 80000,
      biannual: cfg.biannual_price || 150000,
    };
  } catch (_) {}
  return { monthly: 10000, annual: 80000, biannual: 150000 };
}

// ── Subscription activation (shared with verify-payment.js logic) ─────────────
async function activateSubscription(uid, plan, amount, chargeRef) {
  const months = PLAN_MONTHS[plan] || 1;
  const now = new Date();
  const startsAt = now.toISOString();
  const expiresAt = new Date(new Date().setMonth(now.getMonth() + months)).toISOString();

  // Deactivate existing active subscriptions
  await sbPatch(`/subscriptions?student_id=eq.${encodeURIComponent(uid)}&status=eq.active`,
    { status: 'expired', updated_date: now.toISOString() });

  // Create new subscription
  await sbPost('/subscriptions', {
    id: `sub-${chargeRef}`,
    student_id: uid, plan, status: 'active', amount, currency: 'MWK',
    starts_at: startsAt, expires_at: expiresAt,
    created_date: now.toISOString(), updated_date: now.toISOString(),
  });

  // Mark payment completed
  await sbPatch(`/payments?reference=eq.${encodeURIComponent(chargeRef)}`,
    { status: 'completed', updated_date: now.toISOString() });

  // Process referral commission
  try {
    const refs = await sbGet(`/referrals?referred_user_id=eq.${encodeURIComponent(uid)}&status=neq.paid&limit=1`);
    const ref = Array.isArray(refs) ? refs[0] : null;
    if (ref) {
      const commissionAmt = ref.reward_amount || COMMISSION_AMOUNT;
      await sbPatch(`/referrals?id=eq.${encodeURIComponent(ref.id)}`, {
        status: 'paid', reward_status: 'earned', reward_amount: commissionAmt,
        notes: `Direct charge confirmed: ${chargeRef}`, updated_date: now.toISOString(),
      });
      try {
        await sbPost('/notifications', {
          user_id: ref.referrer_id, type: 'affiliate_commission',
          title: '💰 Commission Earned!',
          message: `${ref.referred_name || 'Your referral'} has subscribed. You earned MWK ${commissionAmt.toLocaleString()}!`,
          is_read: false, created_date: now.toISOString(), updated_date: now.toISOString(),
        });
      } catch (_) {}
    }
  } catch (err) { console.error('[direct-charge] referral error:', err.message); }

  // Send WhatsApp confirmation
  try {
    const userRows = await sbGet(`/users?id=eq.${encodeURIComponent(uid)}&select=phone_number,full_name&limit=1`);
    const u = Array.isArray(userRows) ? userRows[0] : null;
    if (u?.phone_number && WA_TOKEN && WA_PHONE_ID) {
      const phone = normalisePhone(u.phone_number);
      await fetch(`https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp', recipient_type: 'individual', to: phone,
          type: 'text',
          text: { body: `*Chibondo Academy*\n\n✅ Payment Confirmed!\n\nPlan: ${plan}\nAmount: MWK ${amount.toLocaleString()}\nStatus: Active\nExpires: ${new Date(expiresAt).toLocaleDateString('en-GB')}\n\nYour lessons are now unlocked. Login:\nchibondoacademy.com` },
        }),
      }).catch(() => {});
    }
  } catch (_) {}

  return { expiresAt };
}

// ─── Handlers ────────────────────────────────────────────────────────────────

// GET ?action=operators
async function getOperators(req, res) {
  // Try fetching from Paychangu live, fall back to hard-coded list
  try {
    const r = await fetch('https://api.paychangu.com/mobile-money', {
      headers: { Authorization: `Bearer ${PAYCHANGU_SECRET}`, Accept: 'application/json' },
    });
    if (r.ok) {
      const data = await r.json();
      if (data?.status === 'success' && Array.isArray(data.data)) {
        return res.status(200).json({ ok: true, operators: data.data });
      }
    }
  } catch (_) {}
  return res.status(200).json({ ok: true, operators: OPERATORS });
}

// POST ?action=charge  body: { plan, mobile, operator_ref_id, user_id, email, first_name, last_name }
async function chargeMobileMoney(req, res) {
  const { plan, mobile, operator_ref_id, user_id, email, first_name, last_name } = req.body || {};

  if (!plan || !PLAN_MONTHS[plan])
    return res.status(400).json({ error: 'Invalid plan' });
  if (!mobile)
    return res.status(400).json({ error: 'Phone number is required' });
  // Auto-detect operator if not explicitly provided
  let resolvedOperatorRefId = operator_ref_id;
  if (!resolvedOperatorRefId) {
    const detected = detectOperator(mobile);
    if (!detected)
      return res.status(400).json({ error: 'Could not detect the mobile network from this phone number. Please check and try again.' });
    resolvedOperatorRefId = detected.ref_id;
  }

  const cleanPhone = normalisePhone(mobile);
  if (cleanPhone.length < 12 || cleanPhone.length > 13)
    return res.status(400).json({ error: 'Invalid phone number. Please enter a valid Malawi number (e.g. 0991234567).' });

  const pricing = await getPricing();
  const amount  = pricing[plan] || 10000;
  const chargeId = generateChargeId(user_id, plan);

  // Store pending payment in Supabase
  if (user_id) {
    await sbPost('/payments', {
      id: chargeId,
      student_id: user_id,
      amount, currency: 'MWK', method: 'mobile_money',
      reference: chargeId, status: 'pending',
      description: plan,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    });
  }

  // Call Paychangu Direct Charge
  try {
    const chargeRes = await fetch('https://api.paychangu.com/mobile-money/payments/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAYCHANGU_SECRET}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        mobile: paychanguPhone(mobile),
        mobile_money_operator_ref_id: resolvedOperatorRefId,
        amount: String(amount),
        charge_id: chargeId,
        email: email || `${cleanPhone}@chibondoacademy.com`,
        first_name: first_name || 'Student',
        last_name: last_name || '',
      }),
    });

    const chargeData = await chargeRes.json();
    console.log('[direct-charge] Paychangu response:', chargeRes.status, JSON.stringify(chargeData).slice(0, 300));

    if (!chargeRes.ok || chargeData.status !== 'success') {
      console.error('[direct-charge] charge failed:', chargeData);
      // Mark payment as failed
      if (user_id) {
        await sbPatch(`/payments?reference=eq.${encodeURIComponent(chargeId)}`,
          { status: 'failed', updated_date: new Date().toISOString() });
      }
      return res.status(400).json({
        error: chargeData?.message || 'Failed to initiate mobile money payment. Please try again.',
      });
    }

    const paychanguChargeId = chargeData?.data?.charge_id; // Paychangu's internal ID for verification

    return res.status(200).json({
      ok: true,
      charge_id: chargeId,            // our reference
      paychangu_charge_id: paychanguChargeId, // Paychangu's ID for verify endpoint
      status: chargeData?.data?.status || 'pending',
      amount,
      operator: chargeData?.data?.mobile_money?.name || '',
      message: 'Payment initiated. Check your phone for a mobile money prompt.',
    });
  } catch (err) {
    console.error('[direct-charge] error:', err.message);
    return res.status(500).json({ error: 'Failed to initiate payment. Please try again.' });
  }
}

// POST ?action=verify  body: { charge_id, paychangu_charge_id, user_id, plan }
async function verifyCharge(req, res) {
  const { paychangu_charge_id, charge_id, user_id, plan } = req.body || {};
  if (!paychangu_charge_id)
    return res.status(400).json({ error: 'Missing charge ID' });

  try {
    const verifyRes = await fetch(
      `https://api.paychangu.com/mobile-money/payments/${encodeURIComponent(paychangu_charge_id)}/verify`,
      { headers: { Authorization: `Bearer ${PAYCHANGU_SECRET}`, Accept: 'application/json' } }
    );

    const verifyData = await verifyRes.json();
    console.log('[direct-charge] verify response:', verifyRes.status, JSON.stringify(verifyData).slice(0, 300));

    const dataStatus = verifyData?.data?.status;
    const isPaid   = verifyData?.status === 'success' && dataStatus === 'success';
    const isFailed = dataStatus === 'failed' || dataStatus === 'cancelled' || dataStatus === 'rejected';
    const isPending = !isPaid && !isFailed;

    if (isPending) {
      return res.status(200).json({ pending: true, status: dataStatus || 'pending' });
    }

    if (isFailed) {
      if (charge_id && user_id) {
        await sbPatch(`/payments?reference=eq.${encodeURIComponent(charge_id)}`,
          { status: 'failed', updated_date: new Date().toISOString() });
      }
      return res.status(200).json({ failed: true, status: dataStatus });
    }

    // Payment confirmed — activate subscription
    const amount = verifyData?.data?.amount || 0;
    const resolvedPlan = plan || 'monthly';
    const { expiresAt } = await activateSubscription(user_id, resolvedPlan, amount, charge_id);

    return res.status(200).json({
      success: true,
      plan: resolvedPlan,
      amount,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error('[direct-charge] verify error:', err.message);
    return res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
}

// ─── Router ────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://chibondoacademy.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || req.body?.action;

  if (action === 'operators') return getOperators(req, res);
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });
  if (action === 'charge')      return chargeMobileMoney(req, res);
  if (action === 'verify')      return verifyCharge(req, res);

  return res.status(400).json({ error: 'Invalid action. Use ?action=operators, ?action=charge, or ?action=verify' });
}
