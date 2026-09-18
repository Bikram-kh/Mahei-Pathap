import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { calculateSaleSplit, purchaseDocumentId, verifyRazorpaySignature } from "../functions/mahei-notes-store/src/payment.js";

test("server computes the same immutable ten percent sale split", () => {
  assert.deepEqual(calculateSaleSplit(4999), { amountPaise: 4999, platformFeePaise: 500, sellerAmountPaise: 4499 });
});

test("purchase IDs are stable per buyer and note", () => {
  assert.equal(purchaseDocumentId("buyer", "note"), purchaseDocumentId("buyer", "note"));
  assert.notEqual(purchaseDocumentId("buyer", "note"), purchaseDocumentId("buyer2", "note"));
  assert.ok(purchaseDocumentId("buyer", "note").length <= 36);
});

test("Razorpay signatures are verified without trusting the client", () => {
  const signature = createHmac("sha256", "secret").update("order_1|pay_1").digest("hex");
  assert.equal(verifyRazorpaySignature("order_1", "pay_1", signature, "secret"), true);
  assert.equal(verifyRazorpaySignature("order_1", "pay_2", signature, "secret"), false);
});
