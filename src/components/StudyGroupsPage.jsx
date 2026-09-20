import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Users, Plus, Link, Send, FileText, Video, Trash2, ArrowLeft, Copy, Upload, X, Bell, BellOff } from 'lucide-react';
import { storage } from '../lib/appwrite';
import { studyGroupsRequest as api, subscribeToStudyGroups, mergeGroupMessages, invitationFromInput, groupFileUrl, requestId } from '../lib/studyGroups';
import './StudyGroupsPage.css';
import './StudyGroupsNotifications.css';
const CollaborativeNote = lazy(() => import('./groups/GroupCollaborativeNote'));
const VideoSession = lazy(() => import('./groups/GroupVideoSession'));
const idOf = item => item?.$id || item?.id;
const dateLabel = value => value ? new Date(value).toLocaleString([], { dateStyle:'short', timeStyle:'short' }) : '';

export default function StudyGroupsPage({
  user,
  personalNotes = [],
  invitationToken = '',
  onInvitationHandled,
  openGroupId = '',
  onGroupOpened,
  onGroupViewChange,
  onGroupsLoaded,
  unreadByGroup = {},
  markGroupRead,
  notificationPermission = 'default',
  requestNotificationPermission,
}) {
  const [groups,setGroups] = useState([]), [selected,setSelected] = useState(''), [detail,setDetail] = useState(null);
  const [tab,setTab] = useState('chat'), [messages,setMessages] = useState([]), [cursor,setCursor] = useState(null);
  const [pending,setPending] = useState([]), [body,setBody] = useState(''), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [loading,setLoading] = useState(true), [busy,setBusy] = useState(false), [modal,setModal] = useState(null), [confirm,setConfirm] = useState(null);
  const [preview,setPreview] = useState(null), [token,setToken] = useState(invitationToken), [inviteLink,setInviteLink] = useState('');
  const [activeNote,setActiveNote] = useState(null), [showCall,setShowCall] = useState(false);
  const selectedRef = useRef(selected), requestVersion = useRef(0), chatEnd = useRef(null);
  selectedRef.current = selected;
  const group = detail?.group, owner = group?.ownerId === user?.$id, archived = group?.status === 'archived';
  const call = detail?.call, activeCall = call && call.status !== 'ended';
  const loadGroups = useCallback(async () => { const result = await api('listGroups'); setGroups(result.groups || []); onGroupsLoaded?.(result.groups || []); return result; },[onGroupsLoaded]);
  const refresh = useCallback(async (groupId, reset = false) => {
    const version = requestVersion.current;
    const [data, chat] = await Promise.all([api('getGroup',{groupId}),api('listMessages',{groupId})]);
    if (selectedRef.current !== groupId || version !== requestVersion.current) return;
    setDetail(data); setMessages(current => reset ? mergeGroupMessages([],chat.messages || []) : mergeGroupMessages(current,chat.messages || []));
    if (reset) setCursor(chat.cursor || null);
  },[]);
  useEffect(() => { let alive = true; loadGroups().catch(e => alive && setError(e.message)).finally(() => alive && setLoading(false)); return () => {alive = false;}; },[loadGroups,user?.$id]);
  useEffect(() => {
    requestVersion.current++; setDetail(null); setMessages([]); setPending([]); setActiveNote(null); setShowCall(false); setInviteLink('');
    if (selected) refresh(selected,true).catch(e => setError(e.message));
  },[selected,refresh]);
  useEffect(() => {
    let timer, alive = true;
    const sync = () => { clearTimeout(timer); timer = setTimeout(() => { if (!alive) return; loadGroups().catch(()=>{}); if(selectedRef.current) refresh(selectedRef.current).catch(e => { if(alive) {setError(e.message);setDetail(null);setShowCall(false);setActiveNote(null);} }); },150); };
    let unsubscribe = () => {};
    try { unsubscribe = subscribeToStudyGroups(event => {
      if (event.events?.some(item=>item.endsWith('.delete'))) setMessages(items=>items.filter(item=>idOf(item)!==idOf(event.payload)));
      sync();
    }); } catch { /* Polling below recovers when realtime is unavailable. */ }
    const interval = setInterval(sync,15000);
    window.addEventListener('online',sync); window.addEventListener('focus',sync);
    return () => { alive=false;clearTimeout(timer);clearInterval(interval);unsubscribe();window.removeEventListener('online',sync);window.removeEventListener('focus',sync); };
  },[loadGroups,refresh,user?.$id]);
  useEffect(() => { if(invitationToken) {setToken(invitationToken);setModal('join');api('previewInvite',{token:invitationToken}).then(setPreview).catch(e=>setError(e.message));} },[invitationToken]);
  useEffect(() => {
    if (!openGroupId) return;
    setSelected(openGroupId);
    setTab('chat');
    onGroupOpened?.();
  }, [openGroupId, onGroupOpened]);
  useEffect(() => {
    onGroupViewChange?.({ groupId: selected, tab });
    if (selected && tab === 'chat') markGroupRead?.(selected);
  }, [selected, tab, markGroupRead, onGroupViewChange]);
  useEffect(() => { chatEnd.current?.scrollIntoView({block:'nearest'}); },[messages.length,pending.length]);
  async function run(action) { setBusy(true);setError('');setNotice('');try { await action(); } catch(e) {setError(e.message || 'Please try again.');} finally {setBusy(false);} }
  async function mutate(action,payload = {}) { const result = await api(action,{groupId:selected,requestId:requestId(),...payload}); await loadGroups(); if(selected) await refresh(selected); return result; }
  async function submitMessage(item) {
    const entry = item || {id:requestId(),body:body.trim(),status:'sending'};
    if (!entry.body) return;
    if (!item) { setBody('');setPending(items=>[...items,entry]); } else setPending(items=>items.map(p=>p.id===entry.id?{...p,status:'sending'}:p));
    const groupId = selected;
    try { const result = await api('sendMessage',{groupId,body:entry.body,requestId:entry.id}); if(selectedRef.current!==groupId)return; setPending(items=>items.filter(p=>p.id!==entry.id)); if(result.message)setMessages(items=>mergeGroupMessages(items,[result.message])); await refresh(groupId); }
    catch(e) { if(selectedRef.current===groupId) {setPending(items=>items.map(p=>p.id===entry.id?{...p,status:'failed'}:p));setError(e.message);} }
  }
  async function uploadPdf(file,title) {
    if (!file || file.size > 25*1024*1024 || !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Choose a PDF smaller than 25 MB.');
    const ticket = await api('preparePdf',{groupId:selected,title:title || file.name,fileName:file.name,size:file.size,requestId:requestId()});
    await storage.createFile(ticket.bucketId,ticket.fileId,file);
    await api('finalizePdf',{groupId:selected,noteId:idOf(ticket.note),requestId:requestId()});
    await refresh(selected);setModal(null);setNotice('PDF shared with your group.');
  }
  function askConfirm(title,message,action) {setConfirm({title,message,action});}
  function closeModal() {if(!busy){setModal(null);setPreview(null);}}
  const notes = detail?.notes || [];
  return <section className="study-groups">
    <header className="sg-page-heading"><div><span className="sg-eyebrow">LEARN TOGETHER</span><h1>Study Groups</h1><p>A private space for friends, shared notes, and focused study.</p></div><div className="sg-actions">{notificationPermission === 'default' && <button onClick={()=>run(async()=>{const result=await requestNotificationPermission?.();setNotice(result==='granted'?'Chat notifications are on while Mahei is open.':'Notifications were not enabled. You can change this in your browser settings.');})}><Bell size={16}/> Enable chat alerts</button>}{notificationPermission === 'granted' && <span className="sg-notification-state"><Bell size={15}/> Chat alerts on</span>}{notificationPermission === 'denied' && <span className="sg-notification-state sg-notification-blocked"><BellOff size={15}/> Alerts blocked in browser</span>}<button onClick={()=>{setModal('join');setPreview(null);}}><Link size={16}/> Join group</button><button className="sg-primary" onClick={()=>setModal('create')}><Plus size={16}/> Create group</button></div></header>
    {error && <div className="sg-error" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError('')}><X size={16}/></button></div>}
    {notice && <p className="sg-notice" role="status">{notice}</p>}
    {loading ? <p role="status">Loading your study groups…</p> : !selected ? <div className="sg-group-grid">{groups.map(item=>{const groupId=idOf(item),unread=unreadByGroup[groupId]||0;return <button className="sg-group-card" key={groupId} onClick={()=>{setSelected(groupId);setTab('chat');}}><Users size={25}/><h2>{item.name}</h2>{unread>0&&<span className="sg-unread-badge"><span aria-hidden="true">{unread>99?'99+':unread}</span><span className="sr-only">{unread} unread messages</span></span>}<p>{item.subject || 'Study together'}</p><p>{item.description}</p><small>{item.status==='archived'?'Archived · read only':`${item.memberCount || 1} / 20 members`}</small></button>})}{!groups.length && <div className="sg-empty"><Users size={32}/><h2>Your study circle starts here</h2><p>Create a private group, then share an invitation link with your friends.</p><button className="sg-primary" onClick={()=>setModal('create')}>Create your first group</button></div>}</div> : <>
      <button className="sg-back" onClick={()=>setSelected('')}><ArrowLeft size={16}/> All groups</button>
      {!group ? <p role="status">Loading group…</p> : <div className="sg-workspace">
        <header className="sg-group-header"><div><h2>{group.name}</h2><p>{group.subject}{group.subject && group.description ? ' · ' : ''}{group.description}</p></div><div className="sg-actions">{archived ? <span className="sg-badge">Archived · read only</span> : activeCall ? <button className="sg-primary" onClick={()=>setShowCall(true)}><Video size={16}/> Join session</button> : owner && <button disabled={busy} onClick={()=>run(async()=>{await mutate('startCall');setShowCall(true);})}><Video size={16}/> Start study session</button>}</div></header>
        {showCall && activeCall && <Suspense fallback={<p>Loading study session…</p>}><VideoSession groupId={selected} call={call} userName={user?.name || 'Student'} isOwner={owner} onClose={()=>setShowCall(false)} onCallChanged={()=>refresh(selected)}/></Suspense>}
        <nav className="sg-tabs" aria-label="Group sections">{['chat','notes','members'].map(value=><button key={value} aria-current={tab===value?'page':undefined} onClick={()=>setTab(value)}>{value[0].toUpperCase()+value.slice(1)}{value==='chat'&&unreadByGroup[selected]>0&&<> <span aria-hidden="true">({unreadByGroup[selected]})</span><span className="sr-only">, {unreadByGroup[selected]} unread</span></>}{value==='members'?` (${detail.members?.length || 0}/20)`:''}</button>)}</nav>
        {tab==='chat' && <div className="sg-chat"><div className="sg-chat-history" role="log" aria-label="Group messages" aria-live="polite">{cursor && <button disabled={busy} onClick={()=>run(async()=>{const older=await api('listMessages',{groupId:selected,cursor});setMessages(items=>mergeGroupMessages(items,older.messages || []));setCursor(older.cursor || null);})}>Load earlier messages</button>}{!messages.length && !pending.length && <p className="sg-empty">Say hello and decide what you will study together.</p>}{messages.map(message=><article className={`sg-message ${message.userId===user?.$id?'sg-own':''}`} key={idOf(message)}><header><strong>{message.senderName || 'Group update'}</strong><time>{dateLabel(message.createdAt || message.$createdAt)}</time>{!archived && (owner || message.userId===user?.$id) && <button aria-label="Delete message" onClick={()=>askConfirm('Delete message?','This removes the message for everyone.',()=>mutate('deleteMessage',{messageId:idOf(message)}))}><Trash2 size={14}/></button>}</header><p>{message.body}</p>{message.noteId && notes.some(note=>idOf(note)===message.noteId) && <button onClick={()=>{setTab('notes');const note=notes.find(note=>idOf(note)===message.noteId);if(note?.kind!=='pdf')setActiveNote(note);}}><FileText size={16}/> Open shared note</button>}</article>)}{pending.map(item=><article className="sg-message sg-own" key={item.id}><p>{item.body}</p><small>{item.status==='failed'?'Not sent':'Sending…'}</small>{item.status==='failed'&&<button onClick={()=>submitMessage(item)}>Retry</button>}</article>)}<div ref={chatEnd}/></div>{!archived && <form className="sg-composer" onSubmit={e=>{e.preventDefault();submitMessage();}}><textarea aria-label="Message your group" maxLength={4000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Message your study group…" onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();submitMessage();}}}/><button className="sg-primary" disabled={!body.trim()}><Send size={17}/> Send</button></form>}</div>}
        {tab==='notes' && <section className="sg-notes"><div className="sg-actions">{!archived&&<><button onClick={()=>setModal('note')}><Plus size={16}/> New shared note</button><button onClick={()=>setModal('copy')}><Copy size={16}/> Copy personal note</button><button onClick={()=>setModal('pdf')}><Upload size={16}/> Upload PDF</button></>}</div><p className="sg-muted">Shared notes belong to this group. Personal-note copies are independent. PDFs are attachments.</p>{activeNote ? <Suspense fallback={<p>Loading collaborative editor…</p>}><CollaborativeNote key={idOf(activeNote)} groupId={selected} note={activeNote} readOnly={archived} onClose={()=>setActiveNote(null)}/></Suspense> : <div className="sg-note-grid">{notes.filter(note=>note.kind!=='upload').map(note=><article className="sg-note" key={idOf(note)}><FileText size={23}/><h3>{note.title}</h3><p>{note.kind==='pdf'?'PDF attachment':'Collaborative note'}</p><div className="sg-actions">{note.kind==='pdf'?<a href={groupFileUrl(note.fileId)} target="_blank" rel="noopener noreferrer">Download PDF</a>:<button onClick={()=>setActiveNote(note)}>{archived?'Read note':'Open note'}</button>}{!archived&&(owner||note.authorId===user?.$id)&&<button aria-label={`Delete ${note.title}`} onClick={()=>askConfirm('Delete shared note?','This removes the shared note for everyone. Your personal original will remain unchanged.',()=>mutate('deleteNote',{noteId:idOf(note)}))}><Trash2 size={16}/></button>}</div></article>)}</div>}{!notes.length&&<p className="sg-empty">Share your first note to start learning together.</p>}</section>}
        {tab==='members' && <section className="sg-members">{owner&&!archived&&<div className="sg-invitations"><h3>Invite your friends</h3><p>Anyone with a valid link can review this group and join. Links expire in seven days.</p><button disabled={busy} onClick={()=>run(async()=>{const result=await mutate('createInvite');const invitation=result.token||result.invite?.token; if(!invitation)throw new Error('The server did not return an invitation token.');setInviteLink(`${window.location.origin}/?groupInvite=${encodeURIComponent(invitation)}`);})}><Link size={16}/> Generate invitation link</button>{inviteLink&&<div className="sg-copy"><input aria-label="Invitation link" readOnly value={inviteLink}/><button onClick={()=>run(async()=>{await navigator.clipboard.writeText(inviteLink);setNotice('Invitation copied.');})}>Copy</button></div>}{(detail.invites||[]).filter(invite=>!invite.revoked).map(invite=><div className="sg-member" key={idOf(invite)}><span>Invitation · expires {dateLabel(invite.expiresAt)}</span><button disabled={busy} onClick={()=>run(async()=>{await mutate('revokeInvite',{inviteId:idOf(invite)});setInviteLink('');})}>Revoke</button></div>)}</div>}{(detail.members||[]).map(member=><div className="sg-member" key={member.userId}><div><strong>{member.name || 'Student'}</strong><small>{member.userId===group.ownerId?'Owner':'Member'}{member.userId===user?.$id?' · You':''}</small></div>{owner&&!archived&&member.userId!==user?.$id&&<div className="sg-actions"><button onClick={()=>askConfirm('Transfer ownership?',`${member.name || 'This member'} will manage invitations, membership, and study sessions. You will become a member.`,()=>mutate('transferOwnership',{userId:member.userId}))}>Make owner</button><button onClick={()=>askConfirm('Remove member?','They will lose access to this group, shared notes, files, and active calls.',()=>mutate('removeMember',{userId:member.userId}))}>Remove</button></div>}</div>)}<div className="sg-danger-zone">{owner?!archived&&<button onClick={()=>askConfirm('Archive group?','The group remains readable. Messages, note editing, invitations, and calls will be disabled.',()=>mutate('archiveGroup'))}>Archive group</button>:<button onClick={()=>askConfirm('Leave group?','You will lose access to the group and its shared materials.',async()=>{await api('leaveGroup',{groupId:selected,requestId:requestId()});setSelected('');await loadGroups();})}>Leave group</button>}</div></section>}
      </div>}
    </>}
    {modal && <div className="sg-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)closeModal();}}><section className="sg-dialog" role="dialog" aria-modal="true" aria-labelledby="sg-dialog-title"><header><h2 id="sg-dialog-title">{({create:'Create a study group',join:'Join a study group',note:'New shared note',copy:'Share a personal-note copy',pdf:'Upload a PDF'})[modal]}</h2><button disabled={busy} aria-label="Close dialog" onClick={closeModal}><X size={20}/></button></header>
      <form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);run(async()=>{if(modal==='create'){const result=await api('createGroup',{name:data.get('name'),subject:data.get('subject'),description:data.get('description'),requestId:requestId()});await loadGroups();setSelected(idOf(result.group));setModal(null);}else if(modal==='join'){const parsed=invitationFromInput(token);if(!preview){setPreview(await api('previewInvite',{token:parsed}));}else{const result=await api('joinGroup',{token:parsed,requestId:requestId()});await loadGroups();setSelected(idOf(result.group)||result.groupId);setModal(null);setPreview(null);onInvitationHandled?.();}}else if(modal==='pdf'){await uploadPdf(data.get('file'),data.get('title'));}else{const payload=modal==='copy'?{sourceNoteId:data.get('sourceNoteId'),title:data.get('title')}:{title:data.get('title')};const result=await mutate('createNote',payload);setModal(null);setTab('notes');if(result.note)setActiveNote(result.note);}});}}>
        {modal==='create'?<><label>Group name<input autoFocus name="name" required maxLength={80}/></label><label>Subject (optional)<input name="subject" maxLength={80}/></label><label>Description (optional)<textarea name="description" maxLength={500}/></label><p className="sg-muted">Private · up to 20 members · you will be the owner.</p></>:modal==='join'?<><label>Invitation link or code<input autoFocus required value={token} onChange={e=>{setToken(e.target.value);setPreview(null);}}/></label>{preview&&<div className="sg-invite-preview"><h3>{preview.group?.name||preview.name}</h3><p>{preview.group?.description}</p><p>Join this private group to access its conversations and shared notes.</p></div>}</>:<><label>Title<input autoFocus name="title" required maxLength={150}/></label>{modal==='copy'&&<label>Personal note<select name="sourceNoteId" required defaultValue=""><option value="" disabled>Choose one of your notes</option>{personalNotes.map(note=><option key={idOf(note)} value={idOf(note)}>{note.title}</option>)}</select></label>}{modal==='pdf'&&<label>PDF file · maximum 25 MB<input name="file" type="file" accept="application/pdf,.pdf" required/></label>}</>}
        <footer><button type="button" disabled={busy} onClick={closeModal}>Cancel</button><button className="sg-primary" disabled={busy}>{busy?'Please wait…':modal==='join'?(preview?'Join group':'Review invitation'):modal==='create'?'Create group':modal==='pdf'?'Upload PDF':'Create shared note'}</button></footer>
      </form></section></div>}
    {confirm&&<div className="sg-overlay"><section className="sg-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sg-confirm-title"><h2 id="sg-confirm-title">{confirm.title}</h2><p>{confirm.message}</p><footer><button disabled={busy} onClick={()=>setConfirm(null)}>Cancel</button><button className="sg-destructive" disabled={busy} onClick={()=>run(async()=>{await confirm.action();setConfirm(null);})}>{busy?'Please wait…':'Confirm'}</button></footer></section></div>}
  </section>;
}
