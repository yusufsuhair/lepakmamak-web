const ENDPOINT='https://lepak-city-realtime-production.up.railway.app/health/public';
const $=id=>document.getElementById(id);

export function formatUptime(seconds){
  const total=Math.max(0,Math.floor(Number(seconds)||0));
  const days=Math.floor(total/86400),hours=Math.floor(total%86400/3600),minutes=Math.floor(total%3600/60);
  if(days)return `${days}d ${hours}h`;
  if(hours)return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

async function check(){
  const started=performance.now();
  $('refresh').disabled=true;$('refresh').textContent='Checking…';
  try{
    const response=await fetch(ENDPOINT,{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('Health API unavailable');
    const data=await response.json(),latency=Math.round(performance.now()-started);
    const good=data.status==='operational';
    $('status-light').className=`light ${good?'good':'degraded'}`;
    $('status-title').textContent=good?'All systems operational':'Service is degraded';
    $('status-note').textContent=good?'The mamak is open and the city is connected.':'The city is online, but realtime is under pressure.';
    $('realtime').textContent=good?'Operational':'Degraded';
    $('uptime').textContent=formatUptime(data.uptimeSeconds);
    $('latency').textContent=`${latency} ms`;
    $('players').textContent=String(data.players??0);
    $('rooms').textContent=`Across ${data.rooms??0} active room${data.rooms===1?'':'s'}`;
    $('version').textContent=`v${data.version||'—'}`;
    $('service-detail').textContent=`Realtime responded in ${latency} ms`;
    $('service-state').textContent=good?'OPERATIONAL':'DEGRADED';
    $('service-state').className=`pill ${good?'good':'degraded'}`;
    $('service-dot').className=`service-dot ${good?'good':'degraded'}`;
  }catch{
    $('status-light').className='light down';$('status-title').textContent='Realtime unavailable';
    $('status-note').textContent='We could not reach the city server. The team may be deploying or investigating.';
    $('realtime').textContent='Unavailable';$('uptime').textContent='—';$('latency').textContent='—';
    $('players').textContent='—';$('rooms').textContent='Live count unavailable';
    $('service-detail').textContent='No response from realtime';$('service-state').textContent='UNAVAILABLE';
    $('service-state').className='pill down';$('service-dot').className='service-dot down';
  }finally{
    $('checked').textContent=new Intl.DateTimeFormat('en-MY',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'Asia/Kuala_Lumpur'}).format(new Date())+' MYT';
    $('refresh').disabled=false;$('refresh').textContent='Check now';
  }
}

$('refresh').addEventListener('click',check);
check();setInterval(check,30000);
