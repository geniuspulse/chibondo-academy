// Vercel serverless function — POST /api/paychangu-webhook
// Paychangu server-to-server webhook for mobile money payment events.
// Acts as a fallback: if the student closes the browser mid-poll,
// this webhook still activates the subscription.
//
// Paychangu sends a POST with the payment event payload. We verify
// the charge with Paychangu's API (don't trust the webhook body alone)
// and then run the same activation logic as /api/direct-charge?action=verify.
//
// Setup: Add this URL in Paychangu dashboard → Settings → Webhooks:
//   https://chibondoacademy.com/api/paychangu-webhook

const PAYCHANGU_SECRET = process.env.PAYCHANGU_SECRET_KEY;
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SRK     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WA_TOKEN         = process.env.WA_ACCESS_TOKEN;
const WA_PHONE_ID      = process.env.WA_PHONE_NUMBER_ID;

const PLAN_MONTHS = { monthly: 1, annual: 12, biannual: 24 };
const COMMISSION_AMOUNT = 10000; // MWK

// ── Supabase helpers (same as direct-charge.js) ───────────────────────────────
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

function normalisePhone(raw) {
  let p = String(raw).replace(/\D/g, '');
  if (p.startsWith('0')) p = '265' + p.slice(1);
  if (!p.startsWith('265')) p = '265' + p;
  return p;
}

// ── Subscription activation (shared logic with direct-charge.js) ─────────────
async function activateSubscription(uid, plan, amount, chargeRef) {
  const subId = `sub-${chargeRef}`;

  // Idempotency guard — prevent double-activation from concurrent
  // webhook + frontend poll arriving at the same time.
  const existing = await sbGet(`/subscriptions?id=eq.${encodeURIComponent(subId)}&limit=1`);
  if (Array.isArray(existing) && existing.length > 0) {
    return { expiresAt: existing[0].expires_at, alreadyActive: true };
  }

  const months = PLAN_MONTHS[plan] || 1;
  const now = new Date();
  const startsAt = now.toISOString();
  const expiresAt = new Date(new Date().setMonth(now.getMonth() + months)).toISOString();

  // Deactivate existing active subscriptions (excluding the new one)
  await sbPatch(
    `/subscriptions?student_id=eq.${encodeURIComponent(uid)}&status=eq.active&id=neq.${encodeURIComponent(subId)}`,
    { status: 'expired', updated_date: now.toISOString() }
  );

  // Create new subscription
  await sbPost('/subscriptions', {
    id: subId,
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
        notes: `Webhook confirmed: ${chargeRef}`, updated_date: now.toISOString(),
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
  } catch (err) { console.error('[paychangu-webhook] referral error:', err.message); }

  // Send WhatsApp confirmation
  try {
    const userRows = await sbGet(`/users?id=eq.${encodeURIComponent(uid)}&select=phone_number,full_name&limit=1`);
    const u = Array.isArray(userRows) ? userRows[0] : null;
    if (u?.phone_number && WA_TOKEN && WA_PHONE_ID) {
      const phone = normalisePhone(u.phone_number);
      const expiryStr = new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      await fetch(`https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp', recipient_type: 'individual', to: phone,
          type: 'template',
          template: {
            name: 'payment_confirmation',
            language: { code: 'en' },
            components: [{ type: 'body', parameters: [
              { type: 'text', text: plan },
              { type: 'text', text: amount.toLocaleString() },
              { type: 'text', text: expiryStr },
            ]}],
          },
        }),
      }).catch(() => {});
    }
  } catch (_) {}

  return { expiresAt, alreadyActive: false };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    console.log('[paychangu-webhook] received:', JSON.stringify(body).slice(0, 500));

    // Paychangu webhook payload typically includes:
    //   charge_id / tx_ref / reference — our internal charge ID
    //   status — 'success', 'failed', etc.
    // We don't trust the webhook body — we re-verify with Paychangu's API.

    const chargeId = body.charge_id || body.tx_ref || body.reference || body.data?.charge_id || body.data?.tx_ref;
    if (!chargeId) {
      console.error('[paychangu-webhook] no charge_id in payload');
      return res.status(400).json({ error: 'Missing charge_id' });
    }

    // Look up the payment record in Supabase to get user_id and plan
    const payments = await sbGet(`/payments?reference=eq.${encodeURIComponent(chargeId)}&limit=1`);
    const payment = Array.isArray(payments) ? payments[0] : null;
    if (!payment) {
      console.error('[paychangu-webhook] payment not found for charge:', chargeId);
      return res.status(404).json({ error: 'Payment record not found' });
    }

    // Skip if already completed
    if (payment.status === 'completed') {
      console.log('[paychangu-webhook] already completed, skipping');
      return res.status(200).json({ ok: true, alreadyCompleted: true });
    }

    const userId = payment.student_id;
    const plan = payment.description || 'monthly';

    // Re-verify with Paychangu (don't trust webhook body alone)
    const verifyRes = await fetch(
      `https://api.paychangu.com/mobile-money/payments/${encodeURIComponent(chargeId)}/verify`,
      { headers: { Authorization: `Bearer ${PAYCHANGU_SECRET}`, Accept: 'application/json' } }
    );
    const verifyData = await verifyRes.json();
    console.log('[paychangu-webhook] verify response:', verifyRes.status, JSON.stringify(verifyData).slice(0, 300));

    const dataStatus = verifyData?.data?.status;
    // Accept multiple success indicators — Paychangu may use 'success', 'completed', 'paid', etc.
    const isSuccess = verifyData?.status === 'success' && ['success', 'completed', 'paid', 'approved'].includes(dataStatus);
    const isFailed = ['failed', 'cancelled', 'rejected', 'expired'].includes(dataStatus);

    if (isFailed) {
      await sbPatch(`/payments?reference=eq.${encodeURIComponent(chargeId)}`,
        { status: 'failed', updated_date: new Date().toISOString() });
      return res.status(200).json({ ok: true, failed: true });
    }

    if (!isSuccess) {
      console.log('[paychangu-webhook] not yet confirmed, status:', dataStatus);
      return res.status(200).json({ ok: true, pending: true, status: dataStatus });
    }

    // Payment confirmed — activate subscription
    const amount = verifyData?.data?.amount || payment.amount || 0;
    const { expiresAt, alreadyActive } = await activateSubscription(userId, plan, amount, chargeId);

    console.log('[paychangu-webhook] subscription activated:', { userId, plan, expiresAt, alreadyActive });
    return res.status(200).json({ ok: true, activated: true, expires_at: expiresAt, already_active: alreadyActive });

  } catch (err) {
    console.error('[paychangu-webhook] error:', err.message);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
