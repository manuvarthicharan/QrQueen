// netlify/functions/verify-payment.js
//
// Verifies a completed Razorpay payment by recomputing its HMAC-SHA256
// signature using your Key Secret and comparing it to what Razorpay sent
// back to the browser. This is the step that actually makes payment
// confirmation tamper-proof — it can only happen where the secret is safe,
// which is here, not in frontend JS.
//
// Required environment variable:
//   RAZORPAY_KEY_SECRET  - your Razorpay Key Secret (private, server-only)

import crypto from 'node:crypto';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ verified: false, error: 'Method not allowed' }), { status: 405 });
  }

  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_secret) {
    return new Response(
      JSON.stringify({ verified: false, error: 'Server is missing RAZORPAY_KEY_SECRET environment variable.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ verified: false, error: 'Invalid JSON body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return new Response(JSON.stringify({ verified: false, error: 'Missing required fields.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const expectedSignature = crypto
    .createHmac('sha256', key_secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  // Guard timingSafeEqual against length mismatches (it throws instead of
  // returning false if the buffers differ in length).
  let verified = false;
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const givenBuf = Buffer.from(String(razorpay_signature), 'utf8');
  if (expectedBuf.length === givenBuf.length) {
    verified = crypto.timingSafeEqual(expectedBuf, givenBuf);
  }

  return new Response(JSON.stringify({ verified }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
