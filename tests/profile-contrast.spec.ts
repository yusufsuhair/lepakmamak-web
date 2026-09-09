import{test,expect}from'@playwright/test';
const profile={id:'abc123def456',name:'Yusuf',registered:true,details:{bio:'Suka lepak kat mamak.'},stats:{sessions:12,recalls:5,dances:3,basketballPoints:8},achievements:[{id:'first_lepak',name:'First Lepak',detail:'Visited Mamak Maju',unlockedAt:'2026-01-02T10:00:00Z'}],guestbook:[{id:'g1',authorId:'x',author:'Aisyah',text:'Jom lepak!',createdAt:'2026-02-01T10:00:00Z'}],activity:[{type:'visit',label:'Discovered KLCC Park',createdAt:'2026-02-03T10:00:00Z'}],posts:[]};

test('profile text stays readable on the light card',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/profile-harness',route=>route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><dialog id="player-profile" aria-labelledby="profile-title"><h2 id="profile-title">Player profile</h2><p id="profile-name"></p><div id="profile-details"></div><button id="close-profile" type="button">Close</button></dialog>'}));
 await page.goto('/profile-harness');
 await page.evaluate(async data=>{const{renderProfile}=await import('/src/profile.ts');renderProfile(document.querySelector('#profile-details')!,data as any);(document.querySelector('#player-profile') as HTMLDialogElement).showModal();},profile);
 const failures=await page.evaluate(()=>{
  const luminance=(channels:number[])=>{const parts=channels.map(value=>{const ratio=value/255;return ratio<=.03928?ratio/12.92:Math.pow((ratio+.055)/1.055,2.4);});return .2126*parts[0]+.7152*parts[1]+.0722*parts[2];};
  const parse=(value:string)=>{const numbers=value.match(/[\d.]+/g)!;return{rgb:[+numbers[0],+numbers[1],+numbers[2]],alpha:numbers[3]===undefined?1:+numbers[3]};};
  const backgroundOf=(element:Element)=>{let node:Element|null=element;while(node){const{rgb,alpha}=parse(getComputedStyle(node).backgroundColor);if(alpha>0)return rgb;node=node.parentElement;}return[255,255,255];};
  const failed:string[]=[];
  for(const element of document.querySelectorAll('#player-profile *')){
   const text=[...element.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent!.trim()).join('');
   if(!text)continue;
   const style=getComputedStyle(element),foreground=parse(style.color).rgb,background=backgroundOf(element);
   const light=Math.max(luminance(foreground),luminance(background)),dark=Math.min(luminance(foreground),luminance(background));
   const ratio=(light+.05)/(dark+.05),size=parseFloat(style.fontSize);
   const large=size>=24||(size>=18.66&&Number(style.fontWeight)>=700);
   if(ratio<(large?3:4.5))failed.push(`${text.slice(0,24)} · ${style.color} on rgb(${background}) · ${ratio.toFixed(2)}`);
  }
  return failed;
 });
 expect(failures).toEqual([]);
});

test('close button sits at the top of the card',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/profile-harness',route=>route.fulfill({contentType:'text/html',body:'<link rel="stylesheet" href="/src/style.css"><dialog id="player-profile" aria-labelledby="profile-title"><h2 id="profile-title">Player profile</h2><p id="profile-name"></p><div id="profile-details"></div><button id="close-profile" type="button">Close</button></dialog>'}));
 await page.goto('/profile-harness');
 await page.evaluate(async data=>{const{renderProfile}=await import('/src/profile.ts');renderProfile(document.querySelector('#profile-details')!,data as any);(document.querySelector('#player-profile') as HTMLDialogElement).showModal();},profile);
 await page.locator('#player-profile').evaluate(element=>{element.scrollTop=0;});
 const button=(await page.locator('#close-profile').boundingBox())!;
 expect(button.y).toBeLessThan(120);
});
