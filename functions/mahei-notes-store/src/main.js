import { calculateSaleSplit, purchaseDocumentId, verifyRazorpaySignature } from "./payment.js";

const jsonHeaders = { "Content-Type": "application/json" };
const permission = (action, role) => `${action}("${role}")`;

function parseBody(req) {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body || {};
}

function userIdFrom(req) {
  return String(req.headers?.["x-appwrite-user-id"] || req.headers?.["X-Appwrite-User-Id"] || "").trim();
}

function configFrom(req) {
  return {
    endpoint: String(process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT || "").replace(/\/$/, ""),
    projectId: process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID || "",
    apiKey: req.headers?.["x-appwrite-key"] || process.env.APPWRITE_FUNCTION_API_KEY || "",
    databaseId: process.env.APPWRITE_DATABASE_ID || "",
    notesCollectionId: process.env.NOTES_STORE_COLLECTION_ID || "notes-store",
    purchasesCollectionId: process.env.NOTES_STORE_PURCHASES_COLLECTION_ID || "notes-store-purchases",
    bucketId: process.env.NOTES_STORE_BUCKET_ID || "notes-store-files",
  };
}

async function appwrite(config, path, options = {}) {
  const response = await fetch(`${config.endpoint}${path}`, {
    ...options,
    headers: {
      ...jsonHeaders,
      "X-Appwrite-Project": config.projectId,
      "X-Appwrite-Key": config.apiKey,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = new Error(data.message || `Appwrite request failed (${response.status}).`);
    failure.status = response.status;
    throw failure;
  }
  return data;
}

const documentPath = (config, collectionId, documentId) =>
  `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(documentId)}`;

async function getDocument(config, collectionId, documentId) {
  return appwrite(config, documentPath(config, collectionId, documentId));
}

async function savePurchase(config, purchaseId, data, buyerId, exists) {
  const path = documentPath(config, config.purchasesCollectionId, purchaseId);
  if (exists) return appwrite(config, path, { method: "PATCH", body: JSON.stringify({ data }) });
  return appwrite(config, `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.purchasesCollectionId)}/documents`, {
    method: "POST",
    body: JSON.stringify({
      documentId: purchaseId,
      data,
      permissions: [permission("read", `user:${buyerId}`)],
    }),
  });
}

async function razorpay(path, options = {}) {
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  if (!keyId || !keySecret) throw new Error("Paid checkout is being configured. Free notes are available now.");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: {
      ...jsonHeaders,
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.description || "Razorpay rejected the payment request.");
  return data;
}

async function createOrder(config, buyerId, body) {
  const note = await getDocument(config, config.notesCollectionId, String(body.noteId || ""));
  if (note.status !== "approved" || note.isFree) throw new Error("This paid note is not available for purchase.");
  if (note.sellerId === buyerId) throw new Error("You already own these notes.");
  if (!String(note.sellerAccountId || "").startsWith("acc_")) throw new Error("The seller has not completed payment setup.");

  const split = calculateSaleSplit(note.pricePaise);
  const purchaseId = purchaseDocumentId(buyerId, note.$id);
  let existing = null;
  try { existing = await getDocument(config, config.purchasesCollectionId, purchaseId); }
  catch (err) { if (err.status !== 404) throw err; }
  if (existing?.status === "paid") throw new Error("These notes are already in your library.");

  const order = await razorpay("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: split.amountPaise,
      currency: "INR",
      receipt: purchaseId,
      notes: { noteId: note.$id, buyerId },
      transfers: [{
        account: note.sellerAccountId,
        amount: split.sellerAmountPaise,
        currency: "INR",
        on_hold: false,
      }],
    }),
  });

  await savePurchase(config, purchaseId, {
    buyerId,
    noteId: note.$id,
    sellerId: note.sellerId,
    ...split,
    status: "created",
    razorpayOrderId: order.id,
    razorpayPaymentId: "",
    createdAt: new Date().toISOString(),
  }, buyerId, Boolean(existing));

  return { keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amountPaise: split.amountPaise };
}

async function verifyPayment(config, buyerId, body) {
  const noteId = String(body.noteId || "");
  const orderId = String(body.razorpay_order_id || "");
  const paymentId = String(body.razorpay_payment_id || "");
  const signature = String(body.razorpay_signature || "");
  const purchaseId = purchaseDocumentId(buyerId, noteId);
  const purchase = await getDocument(config, config.purchasesCollectionId, purchaseId);
  if (purchase.buyerId !== buyerId || purchase.noteId !== noteId || purchase.razorpayOrderId !== orderId) {
    throw new Error("This payment does not match the purchase.");
  }
  if (!verifyRazorpaySignature(orderId, paymentId, signature, process.env.RAZORPAY_KEY_SECRET || "")) {
    throw new Error("Payment verification failed.");
  }
  const paymentData = await razorpay(`/payments/${encodeURIComponent(paymentId)}`);
  if (paymentData.order_id !== orderId || paymentData.amount !== purchase.amountPaise || paymentData.currency !== "INR") {
    throw new Error("The payment amount could not be verified.");
  }
  if (paymentData.status !== "captured") throw new Error("The payment has not been captured yet.");

  const note = await getDocument(config, config.notesCollectionId, noteId);
  const filePath = `/storage/buckets/${encodeURIComponent(config.bucketId)}/files/${encodeURIComponent(note.fileId)}`;
  const storedFile = await appwrite(config, filePath);
  const buyerRead = permission("read", `user:${buyerId}`);
  const permissions = Array.from(new Set([...(storedFile.$permissions || []), buyerRead]));
  await appwrite(config, filePath, { method: "PUT", body: JSON.stringify({ name: storedFile.name, permissions }) });
  await savePurchase(config, purchaseId, {
    status: "paid",
    razorpayPaymentId: paymentId,
    paidAt: new Date().toISOString(),
  }, buyerId, true);
  return { verified: true };
}

async function deleteListing(config, userId, body) {
  const noteId = String(body.noteId || "");
  const note = await getDocument(config, config.notesCollectionId, noteId);
  const admins = new Set(String(process.env.NOTES_STORE_ADMIN_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));
  if (note.sellerId !== userId && !admins.has(userId)) throw new Error("You can only delete your own uploads.");

  const search = new URLSearchParams();
  search.append("queries[]", JSON.stringify({ method: "equal", attribute: "noteId", values: [noteId] }));
  search.append("queries[]", JSON.stringify({ method: "equal", attribute: "status", values: ["paid"] }));
  search.append("queries[]", JSON.stringify({ method: "limit", values: [1] }));
  const purchases = await appwrite(
    config,
    `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(config.purchasesCollectionId)}/documents?${search}`,
  );
  if (purchases.total > 0) throw new Error("Purchased notes cannot be deleted because students need continued access.");

  await appwrite(config, `/storage/buckets/${encodeURIComponent(config.bucketId)}/files/${encodeURIComponent(note.fileId)}`, { method: "DELETE" });
  await appwrite(config, documentPath(config, config.notesCollectionId, noteId), { method: "DELETE" });
  return { deleted: true };
}

async function moderateNote(config, userId, body) {
  const admins = new Set(String(process.env.NOTES_STORE_ADMIN_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));
  if (!admins.has(userId)) throw new Error("Only an administrator can review notes.");
  const status = String(body.status || "");
  if (!new Set(["approved", "rejected"]).has(status)) throw new Error("Choose approved or rejected.");
  const noteId = String(body.noteId || "");
  const note = await getDocument(config, config.notesCollectionId, noteId);
  const permissions = status === "approved"
    ? [permission("read", "users")]
    : [permission("read", `user:${note.sellerId}`), permission("read", "team:admin")];
  if (status === "approved" && note.isFree) {
    const filePath = `/storage/buckets/${encodeURIComponent(config.bucketId)}/files/${encodeURIComponent(note.fileId)}`;
    const storedFile = await appwrite(config, filePath);
    const filePermissions = Array.from(new Set([...(storedFile.$permissions || []), permission("read", "users")]));
    await appwrite(config, filePath, { method: "PUT", body: JSON.stringify({ name: storedFile.name, permissions: filePermissions }) });
  }
  await appwrite(config, documentPath(config, config.notesCollectionId, noteId), {
    method: "PATCH",
    body: JSON.stringify({ data: { status, reviewedAt: new Date().toISOString() }, permissions }),
  });
  return { status };
}

export default async ({ req, res, error }) => {
  try {
    if (req.method !== "POST") return res.json({ success: false, error: "Only POST requests are allowed." }, 405);
    const userId = userIdFrom(req);
    if (!userId) return res.json({ success: false, error: "Sign in to use the Notes Store." }, 401);
    const config = configFrom(req);
    if (!config.endpoint || !config.projectId || !config.apiKey || !config.databaseId) {
      return res.json({ success: false, error: "Notes Store server configuration is incomplete." }, 500);
    }
    const body = parseBody(req);
    let result;
    if (body.action === "create_order") result = await createOrder(config, userId, body);
    else if (body.action === "verify_payment") result = await verifyPayment(config, userId, body);
    else if (body.action === "moderate_note") result = await moderateNote(config, userId, body);
    else if (body.action === "delete_listing") result = await deleteListing(config, userId, body);
    else return res.json({ success: false, error: "Unknown Notes Store action." }, 400);
    return res.json({ success: true, ...result });
  } catch (err) {
    error(`Notes Store error: ${err.message}`);
    return res.json({ success: false, error: err.message || "Notes Store request failed." }, 400);
  }
};
