// Vercel serverless function — POST /api/verify-payment
// Verifies a Paychangu payment by tx_ref and creates/activates a subscription.
// Also handles affiliate referral commission tracking.
// Body: { tx_ref, user_id }

const PAYCHANGU_SECRET = process.env.PAYCHANGU_SECRET_KEY;
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SRK     = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PLAN_MONTHS      = { monthly: 1, annual: 12, biannual: 24 };
const COMMISSION_AMOUNT = 10000; // MWK per paid referral

async function supabaseGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SUPABASE_SRK,
      Authorization: `Bearer ${SUPABASE_SRK}`,
      Accept: 'application/json',
    },
  });
  return r.json();
}

async function supabasePost(path, body) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SRK,
      Authorization: `Bearer ${SUPABASE_SRK}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=ignore-duplicates',
    },
    body: JSON.stringify(body),
  });
}

async function supabasePatch(path, body) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SRK,
      Authorization: `Bearer ${SUPABASE_SRK}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
}

// ── Referral commission logic ─────────────────────────────────────────────────
// Called after payment is confirmed. 
// Looks up whether uid was referred by someone, then marks the referral as 'paid'
// and sets the reward_amount so the affiliate dashboard shows live numbers.
async function processReferralCommission(uid, amount, txRef) {
  try {
    // 1. Find this user's record to get their referral_code (how they joined)
    const users = await supabaseGet(`/users?id=eq.${encodeURIComponent(uid)}&limit=1`);
    const user  = Array.isArray(users) ? users[0] : null;
    if (!user) { console.log('[referral] user not found:', uid); return; }

    // 2. Find open referral record for this user (status: registered or pending)
    const refs = await supabaseGet(
      `/referrals?referred_user_id=eq.${encodeURIComponent(uid)}&status=neq.paid&limit=1`
    );
    const ref = Array.isArray(refs) ? refs[0] : null;

    if (!ref) {
      console.log('[referral] no open referral found for user:', uid);
      return;
    }

    const commissionAmt = ref.reward_amount || COMMISSION_AMOUNT;
    const now = new Date().toISOString();

    // 3. Mark referral as paid + set reward_amount
    const patchRes = await supabasePatch(
      `/referrals?id=eq.${encodeURIComponent(ref.id)}`,
      {
        status:        'paid',
        reward_status: 'earned',
        reward_amount: commissionAmt,
        notes:         `Payment confirmed via tx_ref: ${txRef}`,
        updated_date:  now,
      }
    );
    console.log('[referral] marked as paid:', ref.id, 'status:', patchRes.status);

    // 4. Send notification to affiliate (best-effort)
    try {
      await supabasePost('/notifications', {
        user_id:    ref.referrer_id,
        type:       'affiliate_commission',
        title:      '💰 Commission Earned!',
        message:    `${ref.referred_name || 'Your referral'} has subscribed. You earned MWK ${commissionAmt.toLocaleString()}!`,
        is_read:    false,
        created_date: now,
        updated_date: now,
      });
    } catch (_) {}

  } catch (err) {
    console.error('[referral] processReferralCommission error:', err.message);
    // Non-fatal — don't let referral errors block subscription activation
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tx_ref, user_id } = req.body ?? {};
  if (!tx_ref) return res.status(400).json({ error: 'tx_ref is required' });

  try {
    // 1. Verify with Paychangu
    const pcRes = await fetch(`https://api.paychangu.com/verify-payment/${encodeURIComponent(tx_ref)}`, {
      headers: {
        Authorization: `Bearer ${PAYCHANGU_SECRET}`,
        Accept: 'application/json',
      },
    });
    const pcData = await pcRes.json();
    console.log('[verify-payment] Paychangu response:', JSON.stringify(pcData).slice(0, 300));

    const dataStatus = pcData?.data?.status;
    const isPaid     = pcData.status === 'success' && dataStatus === 'success';
    const isFailed   = (dataStatus === 'failed' || dataStatus === 'cancelled');
    const isPending  = !isPaid && !isFailed;

    if (isPending) {
      return res.status(200).json({ pending: true, status: dataStatus || 'pending' });
    }

    if (isFailed) {
      await supabasePatch(
        `/payments?reference=eq.${encodeURIComponent(tx_ref)}`,
        { status: 'failed', updated_date: new Date().toISOString() }
      );
      return res.status(200).json({ failed: true });
    }

    // ── Payment confirmed ─────────────────────────────────────────────────
    const meta       = pcData?.data?.meta || {};
    const planPrefix = tx_ref.split('-')[1]?.toUpperCase();
    const prefixMap  = { MON: 'monthly', ANN: 'annual', BIA: 'biannual' };
    const plan       = meta.plan || prefixMap[planPrefix] || 'monthly';
    const months     = PLAN_MONTHS[plan] || 1;
    const amount     = pcData?.data?.amount || 0;
    const uid        = user_id || meta.user_id;

    const now      = new Date();
    const startsAt = now.toISOString();
    const endsAt   = new Date(new Date().setMonth(new Date().getMonth() + months)).toISOString();

    if (uid) {
      // 2. Deactivate existing active subscriptions
      await supabasePatch(
        `/subscriptions?student_id=eq.${encodeURIComponent(uid)}&status=eq.active`,
        { status: 'expired', updated_date: new Date().toISOString() }
      );

      // 3. Create new subscription
      const subRes = await supabasePost('/subscriptions', {
        id:           `sub-${tx_ref}`,
        student_id:   uid,
        plan,
        status:       'active',
        amount,
        currency:     'MWK',
        starts_at:    startsAt,
        expires_at:   endsAt,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      });
      if (!subRes.ok) {
        const err = await subRes.text();
        console.error('[verify] subscription insert error:', err);
      }

      // 4. Mark payment as completed
      await supabasePatch(
        `/payments?reference=eq.${encodeURIComponent(tx_ref)}`,
        { status: 'completed', updated_date: new Date().toISOString() }
      );

      // 5. ✅ Process referral commission (new — was missing)
      await processReferralCommission(uid, amount, tx_ref);

      // 6. ✅ Send WhatsApp payment confirmation
      try {
        const userRes = await fetch(
          `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(uid)}&select=phone_number,phone,whatsapp,full_name&limit=1`,
          { headers: { apikey: SUPABASE_SRK, Authorization: `Bearer ${SUPABASE_SRK}` } }
        );
        if (userRes.ok) {
          const userRows = await userRes.json();
          const u = userRows[0];
          const phone = u?.phone_number || u?.phone || u?.whatsapp;
          if (phone) {
            let cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.startsWith('0')) cleanPhone = '265' + cleanPhone.slice(1);
            if (!cleanPhone.startsWith('265')) cleanPhone = '265' + cleanPhone;
            const WA_TOKEN = process.env.WA_ACCESS_TOKEN;
            const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
            await fetch(`https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messaging_product: 'whatsapp', recipient_type: 'individual',
                to: cleanPhone, type: 'template',
                template: {
                  name: 'payment_confirmation',
                  language: { code: 'en' },
                  components: [{ type: 'body', parameters: [
                    { type: 'text', text: plan },
                    { type: 'text', text: amount.toLocaleString() },
                    { type: 'text', text: new Date(endsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) },
                  ]}],
                },
              }),
            }).catch(() => {});
          }
        }
      } catch (_) {}
    }

    return res.status(200).json({ success: true, plan, ends_at: endsAt, amount });

  } catch (err) {
    console.error('verify-payment error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
