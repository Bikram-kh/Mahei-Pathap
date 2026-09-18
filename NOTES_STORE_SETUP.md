# Notes Store setup

The Notes Store collections, secure PDF bucket, and `mahei-notes-store` function are already deployed to the current Appwrite project.

## Enable paid notes

Free uploads work without payment credentials. To enable Razorpay Route checkout:

1. Activate Razorpay Route and create/approve a Linked Account for each seller.
2. In Appwrite Console, open **Functions → Mahei Notes Store → Variables**.
3. Add `RAZORPAY_KEY_ID`.
4. Add `RAZORPAY_KEY_SECRET` as a secret variable.
5. Redeploy the function if Appwrite requests it.
6. Give the seller their Route Linked Account ID (`acc_...`). They enter it when publishing a paid note.

The server creates the order and transfer. It sends 90% to the seller's linked account and retains a 10% Mahei-Pathap platform fee. The browser never receives the Razorpay secret and cannot choose the split.

## Security model

- Uploads accept PDF files only, up to 25 MB.
- Pending listings and files are readable only by the seller and the `admin` team.
- Approval makes listing metadata visible to signed-in users. Free PDFs become readable at upload; paid PDFs remain private.
- A buyer receives file access only after the server verifies Razorpay's signature, payment amount, currency, order, and captured status.
- Listings with a completed purchase cannot be deleted, preserving buyers' access.
