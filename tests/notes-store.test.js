import test from "node:test";
import assert from "node:assert/strict";
import { calculateNoteSale, normalizeNoteListing } from "../src/lib/notesStore.js";

test("note sales keep a ten percent platform fee", () => {
  assert.deepEqual(calculateNoteSale(19900), {
    amountPaise: 19900,
    platformFeePaise: 1990,
    sellerAmountPaise: 17910,
  });
});

test("free and paid note listings are normalized safely", () => {
  const free = normalizeNoteListing({ title: "  Algebra  ", isFree: true, priceRupees: 99 });
  assert.equal(free.title, "Algebra");
  assert.equal(free.pricePaise, 0);
  const paid = normalizeNoteListing({ title: "Physics", isFree: false, priceRupees: 49.5, subject: "Science" });
  assert.equal(paid.pricePaise, 4950);
  assert.equal(paid.subject, "Science");
});

test("paid notes require a valid minimum price", () => {
  assert.throws(() => normalizeNoteListing({ title: "Notes", isFree: false, priceRupees: 2 }), /at least/);
  assert.throws(() => normalizeNoteListing({ title: "", isFree: true }), /title/);
});
