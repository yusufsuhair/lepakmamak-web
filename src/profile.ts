import {auth,session,guestName} from './auth';
import fields from '../shared/profile-fields.json';
export type PlayerProfile = {id:string;name:string;registered:boolean;gameMaster?:boolean;details:Record<string,string>|null};
export function renderProfile(container:HTMLElement, profile:PlayerProfile) {
 container.replaceChildren();
 if(!profile.registered)return;
 const badge=document.createElement('p');badge.className='profile-badge';badge.textContent=profile.gameMaster?'✦ Game Master':'LepakMamak member';container.append(badge);
 let count=0;
 const list=document.createElement('dl');
 for(const {key,label} of fields){const value=profile.details?.[key];if(!value)continue;const term=document.createElement('dt');term.textContent=label;const detail=document.createElement('dd');detail.textContent=value;list.append(term,detail);count++;}
 if(count)container.append(list);else{const empty=document.createElement('p');empty.className='profile-empty';empty.textContent='Still writing their story. Say hello!';container.append(empty);}
}
export function setupProfileEditor(onSave:()=>Promise<void>) {
 const dialog=document.createElement('dialog');dialog.id='edit-profile';dialog.setAttribute('aria-labelledby','edit-profile-title');
 dialog.innerHTML='<form><h2 id="edit-profile-title">A little about you.</h2><p>Help your mamak friends get to know you. All fields are optional and visible to other players.</p><div id="profile-fields"></div><p id="profile-save-status" role="status"></p><div class="profile-editor-actions"><button type="submit">Save profile</button><button type="button">Cancel</button></div></form>';
 const form=dialog.querySelector('form')!, status=dialog.querySelector<HTMLElement>('[role=status]')!, save=form.querySelector<HTMLButtonElement>('[type=submit]')!, cancel=form.querySelector<HTMLButtonElement>('[type=button]')!;
 const inputs=new Map<string,HTMLInputElement|HTMLTextAreaElement>();
 for(const field of fields){const label=document.createElement('label');label.textContent=field.label;const input=field.key==='bio'?document.createElement('textarea'):document.createElement('input');input.id=`profile-${field.key}`;input.name=field.key;input.maxLength=field.max;input.placeholder=field.placeholder;label.htmlFor=input.id;label.append(input);inputs.set(field.key,input);dialog.querySelector('#profile-fields')!.append(label);}
 document.body.append(dialog);let busy=false,generation=0,loaded=false;
 function lock(value:boolean){busy=value;save.disabled=cancel.disabled=value;for(const input of inputs.values())input.disabled=value;}
 function close(){generation++;dialog.close();}
 cancel.onclick=close;dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();else generation++;});dialog.addEventListener('keydown',event=>event.stopPropagation());
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!loaded||!auth||!session||guestName)return;
  const id=session.user.id,attempt=generation;
  const profile=Object.fromEntries(fields.map(({key,max})=>[key,inputs.get(key)!.value.trim().slice(0,max)]));
  lock(true);status.textContent='Saving…';
  try{
   const {error}=await auth.auth.updateUser({data:{profile}});if(error)throw error;
   if(attempt!==generation)return;
   if(session?.user.id!==id||guestName)throw Error('Your session changed. Reopen your profile.');
   await onSave();close();
  }catch(error){if(attempt===generation)status.textContent=error instanceof Error?error.message:'Could not save. Please try again.';}
  finally{lock(false);}
 };
 return {close,async open(){
  if(!auth||!session||guestName)return;
  const id=session.user.id,attempt=++generation;loaded=false;status.textContent='Loading your profile…';lock(true);if(!dialog.open)dialog.showModal();
  try{const {data,error}=await auth.auth.getUser();if(error)throw error;if(attempt!==generation)return;if(data.user?.id!==id||session?.user.id!==id||guestName)throw Error('Please log in again.');
   for(const {key,max} of fields){const value=data.user.user_metadata?.profile?.[key];inputs.get(key)!.value=typeof value==='string'?value.slice(0,max):'';}
   loaded=true;status.textContent='';
  }catch(error){if(attempt===generation)status.textContent=error instanceof Error?error.message:'Could not load profile.';}
  finally{if(attempt===generation){lock(false);save.disabled=!loaded;inputs.get('bio')!.focus();}}
 }};
}
