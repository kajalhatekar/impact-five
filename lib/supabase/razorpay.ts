import "server-only";

import Razorpay from "razorpay";

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay environment variables are missing.");
  }

  return { keyId, keySecret };
}

export function createRazorpayClient() {
  const { keyId, keySecret } = getRazorpayCredentials();

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export function getRazorpayKeyId() {
  return getRazorpayCredentials().keyId;
}

export function getRazorpayKeySecret() {
  return getRazorpayCredentials().keySecret;
}