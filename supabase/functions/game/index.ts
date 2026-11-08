import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type J = Record<string, unknown>;
type Room = { id: string; code: string; host_user_id: string; status: "waiting"|"night"|"day"|"voting"|"finished"; winner: "mafia"|"town"|null; settings: { max_players: number }; round_number: number };
type Player = { id: string; room_id: string; user_id: string; nickname: string; is_alive: boolean; is_ready: boolean; joined_at: string };

const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type", "Access-Control-Allow-Methods":"POST,OPTIONS" };
function keys(name: string): Record<string,string> { try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; } }
const url = Deno.env.get("SUPABASE_URL") ?? "";
const pub = keys("SUPABASE_PUBLISHABLE_KEYS").default ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const secret = keys("SUPABASE_SECRET_KEYS").default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const db = createClient(url, secret, { auth:{ autoRefreshToken:false, persistSession:false } });

class Problem extends Error { status: number; constructor(message:string,status=400){super(message);this.status=status;} }
function response(body:J,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});}
function text(value:unknown,label:string,min:number,max:number){if(typeof value!=="string")throw new Problem("Поле «"+label+"» заполнено неверно.");const s=value.trim();if(s.length<min||s.length>max)throw new Problem("Поле «"+label+"» должно содержать от "+min+" до "+max+" символов.");return s;}
function roomCode(){const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);return Array.from(bytes,b=>alphabet[b%alphabet.length]).join("");}
function shuffle<T>(values:T[]){const a=[...values];for(let i=a.length-1;i>0;i--){const r=new Uint32Array(1);crypto.getRandomValues(r);const j=Math.floor(r[0]/0x100000000*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

async function userId(req:Request){
 const token=(req.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"");
 if(!token)throw new Problem("Нужно войти в игру ещё раз.",401);
 const auth=createClient(url,pub,{global:{headers:{Authorization:"Bearer "+token}},auth:{autoRefreshToken:false,persistSession:false}});
 const {data,error}=await auth.auth.getUser(token);
 if(error||!data.user)throw new Problem("Сессия игрока недействительна. Обновите страницу.",401);
 return data.user.id;
}
async function getRoom(value:unknown):Promise<Room>{
 const code=text(value,"код комнаты",6,6).toUpperCase();
 const {data,error}=await db.from("rooms").select("*").eq("code",code).maybeSingle();
 if(error)throw new Problem("Не удалось загрузить комнату.",500);
 if(!data)throw new Problem("Комната с таким кодом не найдена.",404);
 return data as Room;
}
async function member(room:Room,uid:string):Promise<Player>{
 const {data,error}=await db.from("players").select("*").eq("room_id",room.id).eq("user_id",uid).maybeSingle();
 if(error)throw new Problem("Не удалось проверить участие.",500);
 if(!data)throw new Problem("Вы не состоите в этой комнате.",403);
 return data as Player;
}
async function snapshot(room:Room,uid:string):Promise<J>{
 await member(room,uid);
 const {data:raw,error}=await db.from("players").select("*").eq("room_id",room.id).order("joined_at");
 if(error)throw new Problem("Не удалось загрузить игроков.",500);
 const players=(raw??[]) as Player[];
 const dead=players.filter(p=>!p.is_alive).map(p=>p.id);
 const roleMap:Record<string,string>={};
 if(dead.length){const {data:roles}=await db.from("player_roles").select("player_id,role").in("player_id",dead);for(const role of roles??[])roleMap[role.player_id]=role.role;}
 const {data:messages,error:msgError}=await db.from("room_messages").select("id,player_id,nickname,body,created_at").eq("room_id",room.id).order("created_at",{ascending:false}).limit(60);
 if(msgError)throw new Problem("Не удалось загрузить сообщения.",500);
 return {
  room:{id:room.id,code:room.code,status:room.status,winner:room.winner,round_number:room.round_number,settings:room.settings},
  players:players.map(p=>({id:p.id,nickname:p.nickname,is_alive:p.is_alive,is_ready:p.is_ready,is_host:p.user_id===room.host_user_id,revealed_role:roleMap[p.id]??null})),
  messages:(messages??[]).reverse()
 };
}
async function loadRoom(code:unknown,uid:string){const room=await getRoom(code);const player=await member(room,uid);return {room,player};}
function makeRoles(n:number){const mafia=Math.max(1,Math.floor(n/3));const doctor=n>=5?1:0;const detective=n>=6?1:0;return [...Array(mafia).fill("mafia"),...Array(doctor).fill("doctor"),...Array(detective).fill("detective"),...Array(n-mafia-doctor-detective).fill("civilian")];}
async function winner(roomId:string):Promise<"mafia"|"town"|null>{
 const {data:alive,error}=await db.from("players").select("id").eq("room_id",roomId).eq("is_alive",true);
 if(error)throw new Problem("Не удалось проверить партию.",500);
 const ids=(alive??[]).map(p=>p.id);if(!ids.length)return "town";
 const {data:roles,error:roleError}=await db.from("player_roles").select("role").in("player_id",ids);
 if(roleError)throw new Problem("Не удалось проверить роли.",500);
 const mafia=(roles??[]).filter(r=>r.role==="mafia").length;const town=ids.length-mafia;
 if(!mafia)return "town";if(mafia>=town)return "mafia";return null;
}
async function saveRoom(id:string,patch:Record<string,unknown>){
 const {error}=await db.from("rooms").update({...patch,updated_at:new Date().toISOString()}).eq("id",id);
 if(error)throw new Problem("Не удалось обновить комнату.",500);
}
async function ownRole(room:Room,player:Player):Promise<J>{
 const {data:assignment,error}=await db.from("player_roles").select("role").eq("player_id",player.id).maybeSingle();
 if(error)throw new Problem("Не удалось загрузить роль.",500);
 if(!assignment)return {role:null,team:[],investigation:null};
 let team:string[]=[];
 if(assignment.role==="mafia"){
  const {data:members}=await db.from("player_roles").select("player_id").eq("room_id",room.id).eq("role","mafia");
  const ids=(members??[]).map(m=>m.player_id);
  const {data:names}=await db.from("players").select("id,nickname").in("id",ids);
  team=(names??[]).filter(p=>p.id!==player.id).map(p=>p.nickname);
 }
 let investigation:null|J=null;
 if(assignment.role==="detective"){
  const {data:a}=await db.from("game_actions").select("target_player_id").eq("room_id",room.id).eq("actor_player_id",player.id).eq("action","investigate").eq("round_number",room.round_number).maybeSingle();
  if(a?.target_player_id){
   const {data:r}=await db.from("player_roles").select("role").eq("player_id",a.target_player_id).maybeSingle();
   const {data:p}=await db.from("players").select("nickname").eq("id",a.target_player_id).maybeSingle();
   investigation={nickname:p?.nickname??"Игрок",is_mafia:r?.role==="mafia"};
  }
 }
 return {role:assignment.role,team,investigation};
}
async function createRoom(uid:string,b:J){
 const nickname=text(b.nickname,"никнейм",2,18);const max=Number(b.max_players??10);
 if(!Number.isInteger(max)||max<4||max>50)throw new Problem("В комнате может быть от 4 до 50 игроков.");
 let room:Room|null=null;
 for(let i=0;i<6;i++){
  const {data,error}=await db.from("rooms").insert({code:roomCode(),host_user_id:uid,settings:{max_players:max,discussion_seconds:180,voting_seconds:30}}).select("*").single();
  if(!error){room=data as Room;break;}if(error.code!=="23505")throw new Problem("Не удалось создать комнату: "+error.message,500);
 }
 if(!room)throw new Problem("Не удалось создать код комнаты.",500);
 const {error}=await db.from("players").insert({room_id:room.id,user_id:uid,nickname,is_ready:true});
 if(error){await db.from("rooms").delete().eq("id",room.id);throw new Problem("Не удалось добавить ведущего в комнату.",500);}
 return snapshot(room,uid);
}
async function joinRoom(uid:string,b:J){
 const code=text(b.code,"код комнаты",6,6).toUpperCase();const nickname=text(b.nickname,"никнейм",2,18);const room=await getRoom(code);
 if(room.status!=="waiting")throw new Problem("Игра уже началась. Новые участники не принимаются.");
 const {data:existing}=await db.from("players").select("id").eq("room_id",room.id).eq("user_id",uid).maybeSingle();
 if(existing){const {error}=await db.from("players").update({nickname}).eq("id",existing.id);if(error)throw new Problem("Не удалось обновить никнейм.");return snapshot(room,uid);}
 const {count,error:countError}=await db.from("players").select("id",{count:"exact",head:true}).eq("room_id",room.id);
 if(countError)throw new Problem("Не удалось проверить количество игроков.",500);
 if((count??0)>=room.settings.max_players)throw new Problem("В комнате больше нет свободных мест.");
 const {error}=await db.from("players").insert({room_id:room.id,user_id:uid,nickname,is_ready:false});
 if(error?.code==="23505")throw new Problem("Это имя уже занято. Выберите другое.");
 if(error)throw new Problem("Не удалось присоединиться к комнате.",500);
 return snapshot(room,uid);
}
async function nightAction(room:Room,p:Player,b:J){
 if(room.status!=="night")throw new Problem("Сейчас не ночная фаза.");if(!p.is_alive)throw new Problem("Вы выбыли из игры.");
 const action=String(b.action??"");const expected:Record<string,string>={night_kill:"mafia",protect:"doctor",investigate:"detective"};
 if(!expected[action])throw new Problem("Неизвестное действие.");
 const {data:r}=await db.from("player_roles").select("role").eq("player_id",p.id).maybeSingle();
 if(r?.role!==expected[action])throw new Problem("Ваша роль не может выполнять это действие.");
 const target=text(b.target_player_id,"цель",36,36);
 const {data:t}=await db.from("players").select("id,is_alive").eq("id",target).eq("room_id",room.id).maybeSingle();
 if(!t||!t.is_alive)throw new Problem("Выбранный игрок уже недоступен.");
 if(action==="night_kill"){const {data:tr}=await db.from("player_roles").select("role").eq("player_id",target).maybeSingle();if(tr?.role==="mafia")throw new Problem("Нельзя выбрать участника своей команды.");}
 const {error}=await db.from("game_actions").upsert({room_id:room.id,actor_player_id:p.id,target_player_id:target,action,round_number:room.round_number},{onConflict:"room_id,actor_player_id,action,round_number"});
 if(error)throw new Problem("Не удалось сохранить действие.",500);
}
async function vote(room:Room,p:Player,b:J){
 if(room.status!=="voting")throw new Problem("Сейчас голосование не проводится.");if(!p.is_alive)throw new Problem("Вы выбыли из игры.");
 const target=text(b.target_player_id,"цель",36,36);if(target===p.id)throw new Problem("Нельзя голосовать за себя.");
 const {data:t}=await db.from("players").select("id,is_alive").eq("id",target).eq("room_id",room.id).maybeSingle();
 if(!t||!t.is_alive)throw new Problem("Этот игрок уже выбыл.");
 const {error}=await db.from("game_actions").upsert({room_id:room.id,actor_player_id:p.id,target_player_id:target,action:"vote",round_number:room.round_number},{onConflict:"room_id,actor_player_id,action,round_number"});
 if(error)throw new Problem("Не удалось сохранить голос.",500);
}
async function advance(room:Room){
 if(room.status==="night"){
  const {data:actions,error}=await db.from("game_actions").select("target_player_id,action").eq("room_id",room.id).eq("round_number",room.round_number).in("action",["night_kill","protect"]);
  if(error)throw new Problem("Не удалось обработать ночные действия.",500);
  const kills=(actions??[]).filter(a=>a.action==="night_kill"&&a.target_player_id);const protects=(actions??[]).filter(a=>a.action==="protect"&&a.target_player_id);
  const counts=new Map<string,number>();for(const a of kills){const id=a.target_player_id as string;counts.set(id,(counts.get(id)??0)+1);}
  const top=[...counts.entries()].sort((a,b)=>b[1]-a[1]);const kill=top.length&&(top.length===1||top[0][1]>top[1][1])?top[0][0]:null;const protect=protects.length?protects[protects.length-1].target_player_id:null;
  if(kill&&kill!==protect)await db.from("players").update({is_alive:false}).eq("id",kill);
  const win=await winner(room.id);await saveRoom(room.id,win?{status:"finished",winner:win}:{status:"day"});return;
 }
 if(room.status==="day"){await saveRoom(room.id,{status:"voting"});return;}
 if(room.status==="voting"){
  const {data:votes,error}=await db.from("game_actions").select("target_player_id").eq("room_id",room.id).eq("round_number",room.round_number).eq("action","vote");
  if(error)throw new Problem("Не удалось подсчитать голоса.",500);
  const counts=new Map<string,number>();for(const v of votes??[]){if(v.target_player_id){const id=v.target_player_id as string;counts.set(id,(counts.get(id)??0)+1);}}
  const top=[...counts.entries()].sort((a,b)=>b[1]-a[1]);if(top.length&&(top.length===1||top[0][1]>top[1][1]))await db.from("players").update({is_alive:false}).eq("id",top[0][0]).eq("room_id",room.id);
  const win=await winner(room.id);await saveRoom(room.id,win?{status:"finished",winner:win}:{status:"night",round_number:room.round_number+1});return;
 }
 throw new Problem("Сейчас нельзя сменить фазу.");
}
async function sendMessage(room:Room,p:Player,b:J){
 if(room.status!=="day")throw new Problem("Общий чат доступен во время обсуждения.");if(!p.is_alive)throw new Problem("Вы выбыли из игры.");
 const body=text(b.message,"сообщение",1,500);const since=new Date(Date.now()-5000).toISOString();
 const {count}=await db.from("room_messages").select("id",{count:"exact",head:true}).eq("player_id",p.id).gte("created_at",since);
 if((count??0)>=5)throw new Problem("Слишком часто. Сделайте небольшую паузу.");
 const {error}=await db.from("room_messages").insert({room_id:room.id,player_id:p.id,nickname:p.nickname,body});
 if(error)throw new Problem("Не удалось отправить сообщение.",500);
}
async function leaveRoom(room:Room,p:Player){
 const {data:others}=await db.from("players").select("user_id,joined_at").eq("room_id",room.id).neq("id",p.id).order("joined_at");
 if(room.status==="waiting")await db.from("players").delete().eq("id",p.id);
 else await db.from("players").update({is_alive:false,is_ready:false}).eq("id",p.id);
 if(room.host_user_id===p.user_id){
  if(!others?.length)await db.from("rooms").delete().eq("id",room.id);
  else await db.from("rooms").update({host_user_id:others[0].user_id,updated_at:new Date().toISOString()}).eq("id",room.id);
 }
 if(room.status!=="waiting"&&room.status!=="finished"){const win=await winner(room.id);if(win)await saveRoom(room.id,{status:"finished",winner:win});}
 return {left:true};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return response({error:"Метод не поддерживается."},405);
 if(!url||!pub||!secret)return response({error:"Не настроены серверные ключи Supabase."},503);
 try{
  const uid=await userId(req);const b=await req.json() as J;const action=String(b.action??"");
  if(action==="create_room")return response(await createRoom(uid,b));
  if(action==="join_room")return response(await joinRoom(uid,b));
  if(action==="get_room"){const room=await getRoom(b.code);return response(await snapshot(room,uid));}
  const room=await getRoom(b.code);const p=await member(room,uid);
  if(action==="set_ready"){if(room.status!=="waiting")throw new Problem("Игра уже началась.");const {error}=await db.from("players").update({is_ready:!p.is_ready,last_seen_at:new Date().toISOString()}).eq("id",p.id);if(error)throw new Problem("Не удалось изменить готовность.",500);return response(await snapshot(room,uid));}
  if(action==="start_game"){
   if(room.host_user_id!==uid)throw new Problem("Начать игру может только ведущий.",403);if(room.status!=="waiting")throw new Problem("Игра уже началась.");
   const {data:raw,error}=await db.from("players").select("*").eq("room_id",room.id).order("joined_at");if(error)throw new Problem("Не удалось загрузить игроков.",500);
   const roster=(raw??[]) as Player[];if(roster.length<4)throw new Problem("Для начала нужно минимум 4 игрока.");if(roster.some(x=>!x.is_ready))throw new Problem("Не все игроки готовы.");
   const roles=shuffle(makeRoles(roster.length));await db.from("player_roles").delete().eq("room_id",room.id);
   const {error:roleError}=await db.from("player_roles").insert(roster.map((x,i)=>({room_id:room.id,player_id:x.id,role:roles[i]})));
   if(roleError)throw new Problem("Не удалось раздать роли.",500);
   await saveRoom(room.id,{status:"night",round_number:1,winner:null});
   const updated={...room,status:"night" as const,round_number:1};const result=await snapshot(updated,uid);result.my_role=await ownRole(updated,p);return response(result);
  }
  if(action==="get_my_role")return response(await ownRole(room,p));
  if(action==="night_action"){await nightAction(room,p,b);const result=await snapshot(room,uid);result.my_role=await ownRole(room,p);return response(result);}
  if(action==="vote"){await vote(room,p,b);return response(await snapshot(room,uid));}
  if(action==="advance_phase"){
   if(room.host_user_id!==uid)throw new Problem("Менять фазу может только ведущий.",403);
   await advance(room);const updated=await getRoom(room.code);const result=await snapshot(updated,uid);result.my_role=await ownRole(updated,p);return response(result);
  }
  if(action==="send_message"){await sendMessage(room,p,b);return response(await snapshot(room,uid));}
  if(action==="leave_room")return response(await leaveRoom(room,p));
  throw new Problem("Неизвестное действие.");
 }catch(e){if(e instanceof Problem)return response({error:e.message},e.status);console.error("game function error",e);return response({error:"Внутренняя ошибка сервера. Попробуйте ещё раз."},500);}
});
