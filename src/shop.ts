import { session } from './auth';
import catalog from '../shared/shop.json';
export function setupShop(onEquip: (items: string[]) => void) {
 const dialog=document.createElement('dialog');dialog.id='item-shop';dialog.setAttribute('aria-labelledby','shop-title');
 dialog.innerHTML=`<header><div><h2 id="shop-title">A little more you.</h2><p>One-time accessories · RM 5 each</p></div><button type="button" id="shop-close" aria-label="Close shop">Close ×</button></header><p>Keep your favourites on this account. Wear them around the city.</p><div id="shop-items"></div><p id="shop-message" role="status" aria-live="polite"></p><button type="button" id="shop-refresh" class="secondary">Refresh purchases</button>`;
 document.body.append(dialog);
 const message=dialog.querySelector<HTMLElement>('#shop-message')!;
 const base=(import.meta.env.VITE_MULTIPLAYER_URL || '').replace(/^ws/,'http').replace(/\/ws\/?$/,'').replace(/\/$/,'');
 let owned: {sku:string;equipped:boolean}[]=[], available=false, busy=false;
 async function request(path:string, body?:unknown) {
  if(!base)throw Error('The shop needs an online connection.');
  const result=await fetch(`${base}/shop/${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(session?{Authorization:`Bearer ${session.access_token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await result.json();if(!result.ok)throw Error(data.error || 'Please try again.');return data;
 }
 const equipped=()=>owned.filter(i=>i.equipped).map(i=>i.sku);
 function draw() {
  const list=dialog.querySelector('#shop-items')!;list.replaceChildren();
  for(const item of catalog){
   const record=owned.find(i=>i.sku===item.id), card=document.createElement('article');
   const preview=document.createElement('div');preview.className=`shop-art ${item.id}`;preview.setAttribute('aria-hidden','true');preview.innerHTML=item.id==='cap'?'<i></i>':'<i></i><i></i>';
   const title=document.createElement('h3');title.textContent=item.name;
   const description=document.createElement('p');description.textContent=item.description;
   const button=document.createElement('button');button.className='primary';button.type='button';button.disabled=busy||!available||!session;
   button.textContent=record?(record.equipped?'Take off':'Wear item'):'Buy · RM 5';
   button.onclick=async()=>{if(busy)return;busy=true;draw();message.textContent=record?'Updating your look…':'Opening secure Stripe Checkout…';try{
    if(record){const data=await request('equip',{sku:item.id,equipped:!record.equipped});owned=data.items;onEquip(equipped());message.textContent='Outfit updated.';}
    else {const data=await request('checkout',{sku:item.id});const target=new URL(data.url);if(target.protocol!=='https:'||target.hostname!=='checkout.stripe.com')throw Error('Invalid checkout address');location.assign(target.href);}
   }catch(error){message.textContent=error instanceof Error?error.message:'Please try again.';}finally{busy=false;draw();}};
   card.append(preview,title,description,button);list.append(card);
  }
 }
 async function refresh(){if(busy)return;busy=true;draw();try{const data=await request('catalog');available=data.available;if(session&&available){owned=(await request('inventory')).items;onEquip(equipped());}message.textContent=!session?'Log in to buy and wear accessories.':available?'Purchases use real MYR payments through Stripe.':'The shop is not available yet.';}catch{available=false;message.textContent='Could not connect to the shop. Please try again.';}finally{busy=false;draw();}}
 dialog.querySelector('#shop-close')!.addEventListener('click',()=>dialog.close());
 dialog.querySelector('#shop-refresh')!.addEventListener('click',()=>void refresh());
 dialog.addEventListener('keydown',e=>e.stopPropagation());
 async function enter(){
  owned=[];onEquip([]);await refresh();
  const params=new URLSearchParams(location.search), checkout=params.get('session_id');
  if(params.has('shop')){dialog.showModal();if(params.get('shop')==='success'&&checkout&&session){try{const result=await request('confirm',{session_id:checkout});owned=result.items;onEquip(equipped());message.textContent=result.paid?'Payment confirmed. Your item is ready to wear.':'Your payment is processing. Refresh purchases shortly.';draw();}catch{message.textContent='Payment verification is pending. Refresh purchases in a moment.';}}
   const clean=new URL(location.href);clean.searchParams.delete('shop');clean.searchParams.delete('session_id');history.replaceState(null,'',clean);
  }
 }
 return {open(){dialog.showModal();void refresh();},enter, close(){dialog.close();owned=[];onEquip([]);}};
}
