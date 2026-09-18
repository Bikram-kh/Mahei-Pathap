import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const PLATFORM_FEE_PERCENT = 10;

export function calculateSaleSplit(amountPaise) {
  const amount = Math.round(Number(amountPaise));
  if (!Number.isInteger(amount) || amount < 500 || amount > 1_000_000) {
    throw new Error("The note price must be between ₹5 and ₹10,000.");
  }
  const platformFeePaise = Math.round((amount * PLATFORM_FEE_PERCENT) / 100);
  return { amountPaise: amount, platformFeePaise, sellerAmountPaise: amount - platformFeePaise };
}

export function purchaseDocumentId(buyerId, noteId) {
  const hash = createHash("sha256").update(`${buyerId}:${noteId}`).digest("hex");
  return `purchase_${hash.slice(0, 27)}`;
}

export function verifyRazorpaySignature(orderId, paymentId, signature, secret) {
  if (![orderId, paymentId, signature, secret].every((value) => typeof value === "string" && value)) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const supplied = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer);
}
