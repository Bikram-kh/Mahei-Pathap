import React, { useEffect, useMemo, useState } from "react";
import { Download, FileText, Search, ShieldCheck, ShoppingBag, Store, Trash2, Upload } from "lucide-react";
import { ID, Permission, Role } from "appwrite";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_NOTES_STORE_BUCKET_ID,
  APPWRITE_NOTES_STORE_COLLECTION_ID,
  APPWRITE_NOTES_STORE_PURCHASES_COLLECTION_ID,
  databases,
  notesStoreRequest,
  Query,
  storage,
} from "../lib/appwrite";
import { formatNotePrice, normalizeNoteListing, NOTES_STORE_MAX_FILE_BYTES } from "../lib/notesStore";
import "./NotesStorePage.css";

const emptyDraft = { title: "", description: "", subject: "", level: "", isFree: true, priceRupees: "", sellerAccountId: "" };
const mapNote = (doc) => ({ id: doc.$id, ...doc });

export default function NotesStorePage({ authUser, userName, studentProfile, isAdmin }) {
  const [tab, setTab] = useState("store");
  const [notes, setNotes] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [library, setLibrary] = useState([]);
  const [pending, setPending] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [file, setFile] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const configured = Boolean(APPWRITE_NOTES_STORE_COLLECTION_ID && APPWRITE_NOTES_STORE_BUCKET_ID);

  async function loadStore() {
    if (!configured || !authUser) return;
    setLoading(true);
    setError("");
    try {
      const requests = [
        databases.listDocuments(APPWRITE_DATABASE_ID, APPWRITE_NOTES_STORE_COLLECTION_ID, [Query.equal("status", "approved"), Query.limit(100)]),
        databases.listDocuments(APPWRITE_DATABASE_ID, APPWRITE_NOTES_STORE_COLLECTION_ID, [Query.equal("sellerId", authUser.$id), Query.limit(100)]),
        APPWRITE_NOTES_STORE_PURCHASES_COLLECTION_ID
          ? databases.listDocuments(APPWRITE_DATABASE_ID, APPWRITE_NOTES_STORE_PURCHASES_COLLECTION_ID, [Query.equal("buyerId", authUser.$id), Query.equal("status", "paid"), Query.limit(100)])
          : Promise.resolve({ documents: [] }),
        isAdmin
          ? databases.listDocuments(APPWRITE_DATABASE_ID, APPWRITE_NOTES_STORE_COLLECTION_ID, [Query.equal("status", "pending"), Query.limit(100)])
          : Promise.resolve({ documents: [] }),
      ];
      const [storeResult, uploadResult, purchaseResult, pendingResult] = await Promise.all(requests);
      const approved = storeResult.documents.map(mapNote);
      setNotes(approved);
      setUploads(uploadResult.documents.map(mapNote));
      setPending(pendingResult.documents.map(mapNote));
      const purchasedIds = new Set(purchaseResult.documents.map((item) => item.noteId));
      setLibrary(approved.filter((item) => item.isFree || purchasedIds.has(item.id)));
    } catch (loadError) {
      setError(loadError.message || "The Notes Store could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStore(); }, [authUser?.$id, isAdmin]);

  const visibleNotes = useMemo(() => notes.filter((note) => {
    const text = `${note.title} ${note.subject} ${note.level} ${note.description}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (filter === "all" || (filter === "free" ? note.isFree : !note.isFree));
  }), [notes, query, filter]);

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function uploadNote(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!file) return setError("Choose a PDF file to upload.");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setError("Only PDF notes are supported.");
    if (file.size > NOTES_STORE_MAX_FILE_BYTES) return setError("The PDF must be 25 MB or smaller.");
    let listing;
    try { listing = normalizeNoteListing(draft); } catch (validationError) { return setError(validationError.message); }
    if (!listing.isFree && !draft.sellerAccountId.trim().startsWith("acc_")) return setError("Enter a valid Razorpay Route linked account ID beginning with acc_.");
    setBusy(true);
    let uploadedFile = null;
    try {
      const owner = Role.user(authUser.$id);
      uploadedFile = await storage.createFile(
        APPWRITE_NOTES_STORE_BUCKET_ID,
        ID.unique(),
        file,
        [Permission.read(owner), Permission.read(Role.team("admin")), ...(listing.isFree && isAdmin ? [Permission.read(Role.users())] : [])],
      );
      await databases.createDocument(
        APPWRITE_DATABASE_ID,
        APPWRITE_NOTES_STORE_COLLECTION_ID,
        ID.unique(),
        {
          ...listing,
          sellerId: authUser.$id,
          sellerName: userName,
          sellerAccountId: draft.sellerAccountId.trim(),
          fileId: uploadedFile.$id,
          fileName: file.name.slice(0, 240),
          fileSize: file.size,
          status: isAdmin ? "approved" : "pending",
          createdAt: new Date().toISOString(),
          downloadCount: 0,
        },
        isAdmin
          ? [Permission.read(Role.users())]
          : [Permission.read(owner), Permission.read(Role.team("admin"))],
      );
      setDraft({ ...emptyDraft, level: studentProfile.level || "" });
      setFile(null);
      setMessage(isAdmin ? "Your notes are now available in the store." : "Your notes were uploaded and are waiting for review.");
      await loadStore();
    } catch (uploadError) {
      if (uploadedFile) await storage.deleteFile(APPWRITE_NOTES_STORE_BUCKET_ID, uploadedFile.$id).catch(() => {});
      setError(uploadError.message || "The notes could not be uploaded.");
    } finally { setBusy(false); }
  }

  function downloadNote(note) {
    const url = storage.getFileDownload(APPWRITE_NOTES_STORE_BUCKET_ID, note.fileId);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function loadRazorpay() {
    if (window.Razorpay) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Razorpay Checkout could not be loaded."));
      document.head.appendChild(script);
    });
  }

  async function buyNote(note) {
    setBusy(true); setError("");
    try {
      const order = await notesStoreRequest({ action: "create_order", noteId: note.id });
      await loadRazorpay();
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: "INR",
        name: "Mahei-Pathap Notes Store",
        description: note.title,
        order_id: order.orderId,
        prefill: { name: userName, email: authUser.email },
        handler: async (payment) => {
          try {
            await notesStoreRequest({ action: "verify_payment", noteId: note.id, ...payment });
            setMessage("Payment verified. The notes are now in My Library.");
            await loadStore();
            downloadNote(note);
          } catch (verifyError) { setError(verifyError.message); }
        },
        theme: { color: "#ef7d5b" },
      });
      checkout.open();
    } catch (purchaseError) { setError(purchaseError.message || "Checkout could not be started."); }
    finally { setBusy(false); }
  }

  async function deleteUpload(note) {
    if (!window.confirm(`Delete “${note.title}”? This cannot be undone.`)) return;
    setBusy(true); setError("");
    try {
      await notesStoreRequest({ action: "delete_listing", noteId: note.id });
      await loadStore();
    } catch (deleteError) { setError(deleteError.message || "The upload could not be deleted."); }
    finally { setBusy(false); }
  }

  async function moderate(note, status) {
    setBusy(true); setError("");
    try { await notesStoreRequest({ action: "moderate_note", noteId: note.id, status }); await loadStore(); }
    catch (moderationError) { setError(moderationError.message); }
    finally { setBusy(false); }
  }

  const NoteCard = ({ note, owned = false }) => (
    <article className="store-note-card">
      <div className="store-note-icon"><FileText size={25} /></div>
      <div className="store-note-copy">
        <div className="store-note-tags"><span>{note.subject}</span><span>{note.level}</span>{note.status && note.status !== "approved" && <span>{note.status}</span>}</div>
        <h4>{note.title}</h4><p>{note.description || "Study notes shared by the Mahei-Pathap community."}</p>
        <small>By {note.sellerName} · {(Number(note.fileSize) / 1048576).toFixed(1)} MB</small>
      </div>
      <div className="store-note-actions"><strong>{formatNotePrice(note.pricePaise)}</strong>
        {owned ? <><button className="primary-button mint" onClick={() => downloadNote(note)}><Download size={15}/>Preview</button><button className="delete-button" onClick={() => deleteUpload(note)} aria-label={`Delete ${note.title}`}><Trash2 size={16}/></button></>
          : note.isFree || library.some((item) => item.id === note.id)
            ? <button className="primary-button mint" onClick={() => downloadNote(note)}><Download size={15}/>Download</button>
            : <button className="primary-button orange" disabled={busy} onClick={() => buyNote(note)}><ShoppingBag size={15}/>Buy</button>}
      </div>
    </article>
  );

  if (!configured) return <div className="empty-state"><span>⚙️</span><p>Notes Store is not configured yet.</p></div>;

  return <div className="notes-store-page page-stack">
    <section className="notes-store-hero card"><div><span className="section-label">Community learning marketplace</span><h3>Notes Store</h3><p>Share useful PDF notes, discover study material, and support student creators.</p></div><div className="notes-store-hero-icon"><Store size={30}/></div></section>
    <div className="notes-store-tabs">
      {[['store','Store'],['library','My Library'],['sell','Sell notes'],['uploads','My Uploads'],...(isAdmin ? [['review','Review']] : [])].map(([id,label]) => <button key={id} className={tab===id?'active':''} onClick={()=>{setTab(id);setError('');setMessage('');}}>{label}</button>)}
    </div>
    {error && <p className="store-alert error" role="alert">{error}</p>}{message && <p className="store-alert success" role="status">{message}</p>}
    {tab==='store' && <><section className="store-toolbar card"><label><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search notes, subjects or classes"/></label><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All notes</option><option value="free">Free</option><option value="paid">Paid</option></select></section><div className="store-note-grid">{visibleNotes.map(note=><NoteCard key={note.id} note={note}/>)}</div>{!loading&&!visibleNotes.length&&<div className="empty-state"><span>📚</span><p>No matching notes yet.</p></div>}</>}
    {tab==='library' && <><div className="store-note-grid">{library.map(note=><NoteCard key={note.id} note={note}/>)}</div>{!library.length&&<div className="empty-state"><span>🛍️</span><p>Your downloaded and purchased notes will appear here.</p></div>}</>}
    {tab==='sell' && <form className="store-upload-form card" onSubmit={uploadNote}><div className="store-form-heading"><Upload size={22}/><div><h3>Upload your notes</h3><p>Only upload work you created or have permission to share.</p></div></div><div className="store-form-grid"><label className="field-group"><span>Title</span><input required maxLength={160} value={draft.title} onChange={e=>update('title',e.target.value)}/></label><label className="field-group"><span>Subject</span><input required maxLength={80} value={draft.subject} onChange={e=>update('subject',e.target.value)}/></label><label className="field-group"><span>Class or level</span><input maxLength={80} value={draft.level} onChange={e=>update('level',e.target.value)}/></label><label className="field-group"><span>PDF file · maximum 25 MB</span><input required type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><label className="field-group store-description"><span>Description</span><textarea required maxLength={1200} value={draft.description} onChange={e=>update('description',e.target.value)}/></label></div><div className="store-price-choice"><label><input type="radio" checked={draft.isFree} onChange={()=>update('isFree',true)}/> Upload free</label><label><input type="radio" checked={!draft.isFree} onChange={()=>update('isFree',false)}/> Sell these notes</label></div>{!draft.isFree&&<div className="store-paid-fields"><label className="field-group"><span>Price in ₹</span><input type="number" min="5" max="10000" step="1" required value={draft.priceRupees} onChange={e=>update('priceRupees',e.target.value)}/></label><label className="field-group"><span>Razorpay Route account ID</span><input required placeholder="acc_..." value={draft.sellerAccountId} onChange={e=>update('sellerAccountId',e.target.value)}/></label><p>You receive 90% after payment. Mahei-Pathap keeps a 10% platform fee.</p></div>}<button className="primary-button orange store-submit" disabled={busy}>{busy?'Uploading…':'Submit notes for review'}</button></form>}
    {tab==='uploads' && <><div className="store-note-grid">{uploads.map(note=><NoteCard key={note.id} note={note} owned/>)}</div>{!uploads.length&&<div className="empty-state"><span>📤</span><p>You have not uploaded any notes.</p></div>}</>}
    {tab==='review'&&isAdmin&&<><div className="store-note-grid">{pending.map(note=><article className="store-note-card" key={note.id}><ShieldCheck/><div className="store-note-copy"><h4>{note.title}</h4><p>{note.description}</p><small>{note.sellerName} · {note.fileName}</small></div><div className="store-review-actions"><button className="primary-button mint" onClick={()=>moderate(note,'approved')}>Approve</button><button className="small-button coral-button" onClick={()=>moderate(note,'rejected')}>Reject</button></div></article>)}</div>{!pending.length&&<div className="empty-state"><span>✅</span><p>No notes are waiting for review.</p></div>}</>}
  </div>;
}
