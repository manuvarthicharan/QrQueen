// netlify/functions/create-order.js
//
// Creates a real Razorpay order using your Key ID + Key Secret.
// The secret is read from an environment variable (set in the Netlify
// dashboard: Site configuration > Environment variables) and never leaves
// this server-side function.
//
// Required environment variables:
//   RAZORPAY_KEY_ID      - your Razorpay Key ID (public)
//   RAZORPAY_KEY_SECRET  - your Razorpay Key Secret (private, server-only)

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    return new Response(
      JSON.stringify({ error: 'Server is missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET environment variables.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let amount = 900;   // paise (₹9.00) — sensible default, matches the Studio's HD unlock price
  let currency = 'INR';

  try {
    const body = await req.json();
    if (body && Number.isFinite(body.amount) && body.amount > 0) amount = Math.round(body.amount);
    if (body && typeof body.currency === 'string') currency = body.currency;
  } catch (_) {
    // No JSON body sent — fine, we use the defaults above.
  }

  try {
    const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');
    const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount,
        currency,
        receipt: `qrqueen_${Date.now()}`
      })
    });

    const data = await razorpayRes.json();

    if (!razorpayRes.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(
      JSON.stringify({
        order_id: data.id,
        amount: data.amount,
        currency: data.currency,
        key_id // returned so the frontend never has to hardcode it either
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Could not reach Razorpay.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
