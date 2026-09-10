import './developer-options.css';

export function setupDeveloperOptions(send:(message:object)=>boolean){
 const root=document.createElement('section');root.id='developer-options';
 root.innerHTML='<header><small>DEV BUILD ONLY</small><h3>Developer Option</h3></header><label>Nearby test users<input id="dev-user-count" type="number" min="1" max="30" value="4" inputmode="numeric"></label><div class="dev-checks"><label><input id="dev-bot-mic" type="checkbox"> Open mic</label><label><input id="dev-bot-speaker" type="checkbox" checked> Open speaker</label></div><div class="dev-actions"><button id="dev-spawn" type="button">Spawn users</button><button id="dev-remove" type="button">Remove all users</button></div><p id="dev-options-status" role="status"></p>';
 document.querySelector('.pause-panel')!.append(root);
 const status=root.querySelector<HTMLElement>('#dev-options-status')!;
 root.querySelector<HTMLButtonElement>('#dev-spawn')!.onclick=()=>{const count=Math.max(1,Math.min(30,Number(root.querySelector<HTMLInputElement>('#dev-user-count')!.value)||1));const ok=send({type:'dev-spawn-bots',count,mic:root.querySelector<HTMLInputElement>('#dev-bot-mic')!.checked,speaker:root.querySelector<HTMLInputElement>('#dev-bot-speaker')!.checked});status.textContent=ok?`Spawning ${count} test users nearby…`:'Connect to dev city first.';};
 root.querySelector<HTMLButtonElement>('#dev-remove')!.onclick=()=>{const ok=send({type:'dev-remove-bots'});status.textContent=ok?'Removing your test users…':'Connect to dev city first.';};
 return root;
}
