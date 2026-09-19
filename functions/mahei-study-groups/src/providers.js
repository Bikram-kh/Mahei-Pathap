import { Liveblocks } from '@liveblocks/node';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { getSchema } from '@tiptap/core';
import { generateJSON } from '@tiptap/html/server';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { prosemirrorJSONToYDoc } from 'y-prosemirror';
import { encodeStateAsUpdate } from 'yjs';
import { fail } from './policy.js';
import { newId } from './appwrite.js';
export function createProviders(env=process.env){
 const collaboration=Boolean(env.LIVEBLOCKS_SECRET_KEY);
 const video=Boolean(env.LIVEKIT_URL&&env.LIVEKIT_API_KEY&&env.LIVEKIT_API_SECRET);
 const lb=()=>{if(!collaboration)fail('Collaborative notes are not configured yet. Ask the administrator to connect Liveblocks.',503);return new Liveblocks({secret:env.LIVEBLOCKS_SECRET_KEY});};
 const lk=()=>{if(!video)fail('Video study sessions are not configured yet. Ask the administrator to connect LiveKit Cloud.',503);return new RoomServiceClient(env.LIVEKIT_URL.replace(/^wss:/,'https:').replace(/^ws:/,'http:'),env.LIVEKIT_API_KEY,env.LIVEKIT_API_SECRET);};
 const access=(members,readOnly)=>Object.fromEntries(members.map(m=>[m.userId,readOnly?['*:read']:['*:write']]));
 return {
  status:{collaboration,video},
  async createNote(roomId,members,html){const client=lb();await client.createRoom(roomId,{defaultAccesses:[],usersAccesses:access(members,false)});try{const extensions=[StarterKit,Highlight];const json=generateJSON(html||'<p></p>',extensions);const doc=prosemirrorJSONToYDoc(getSchema(extensions),json,'default');await client.sendYjsBinaryUpdate(roomId,encodeStateAsUpdate(doc));doc.destroy();}catch(e){await client.deleteRoom(roomId);throw e;}},
  async authorize(roomId,user,members,readOnly){const client=lb();await client.updateRoom(roomId,{defaultAccesses:[],usersAccesses:access(members,readOnly)});const {body,status}=await client.identifyUser({userId:user.$id},{userInfo:{name:user.name||'Student',color:'#ad6b3b'}});if(status!==200)fail('Collaboration authorization failed.',503);return JSON.parse(body);},
  async rotateNote(note,members,readOnly){const client=lb();const current=await client.getRoom(note.roomId);const usersAccesses={...Object.fromEntries(Object.keys(current.usersAccesses||{}).map(id=>[id,null])),...access(members,readOnly)};await client.updateRoom(note.roomId,{defaultAccesses:[],usersAccesses});const newRoomId=`group:${note.groupId}:note:${newId()}`;await client.updateRoomId({currentRoomId:note.roomId,newRoomId});return newRoomId;},
  async deleteNote(roomId){await lb().deleteRoom(roomId);},
  async startCall(roomName){await lk().createRoom({name:roomName,maxParticipants:8,emptyTimeout:600,departureTimeout:60});},
  async joinCall(call,user){const client=lk();const participants=await client.listParticipants(call.roomName);if(participants.length>=8&&!participants.some(p=>p.identity===user.$id))fail('This study session is full (8 participants).',409);const token=new AccessToken(env.LIVEKIT_API_KEY,env.LIVEKIT_API_SECRET,{identity:user.$id,name:user.name||'Student',ttl:'2m'});token.addGrant({roomJoin:true,room:call.roomName,canPublish:true,canSubscribe:true,canPublishData:true});return {token:await token.toJwt(),serverUrl:env.LIVEKIT_URL};},
  async endCall(call){try{await lk().deleteRoom(call.roomName);}catch(e){if(!/not.?found/i.test(e.message))throw e;}},
  async removeParticipant(call,userId){try{await lk().removeParticipant(call.roomName,userId);}catch(e){if(!/not.?found/i.test(e.message))throw e;}},
 };
}
