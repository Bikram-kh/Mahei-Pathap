export const NOTES_STORE_PLATFORM_FEE_PERCENT = 10;
export const NOTES_STORE_MAX_FILE_BYTES = 25 * 1024 * 1024;

const text = (value, max) => String(value || "").trim().slice(0, max);

export function calculateNoteSale(amountPaise) {
  const amount = Math.max(0, Math.round(Number(amountPaise) || 0));
  const platformFeePaise = Math.round(amount * NOTES_STORE_PLATFORM_FEE_PERCENT / 100);
  return { amountPaise: amount, platformFeePaise, sellerAmountPaise: amount - platformFeePaise };
}

export function normalizeNoteListing(value = {}) {
  const title = text(value.title, 160);
  if (!title) throw new Error("Add a title for your notes.");
  const isFree = value.isFree !== false;
  const pricePaise = isFree ? 0 : Math.round(Number(value.priceRupees) * 100);
  if (!isFree && (!Number.isFinite(pricePaise) || pricePaise < 500)) {
    throw new Error("Paid notes must cost at least ₹5.");
  }
  if (pricePaise > 1000000) throw new Error("The maximum note price is ₹10,000.");
  return {
    title,
    description: text(value.description, 1200),
    subject: text(value.subject, 80) || "General",
    level: text(value.level, 80) || "All levels",
    isFree,
    pricePaise,
  };
}

export const formatNotePrice = (paise) => Number(paise) > 0
  ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(paise) / 100)
  : "Free";
