let scheduleMatches=[],scheduleFilter='ALL';

function localDateKey(){
  const parts=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const value=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return `${value.year}-${value.month}-${value.day}`
}

function displayDate(value){
  const d=new Date(`${value}T00:00:00+09:00`),week='日月火水木金土'[d.getDay()];
  return `${d.getMonth()+1}月${d.getDate()}日（${week}）`
}

function monthLabel(value){
  const [year,month]=value.split('-');
  return `${year}年${Number(month)}月`
}

function jumpToSchedule(target){
  const element=target==='recent'?document.querySelector('.schedule-month'):document.getElementById(`schedule-month-${target}`);
  if(!element)return;
  document.querySelectorAll('#monthShortcuts button').forEach(button=>button.classList.toggle('active',button.dataset.month===target));
  element.scrollIntoView({behavior:'smooth',block:'start'})
}

function stadiumForSchedule(name){
  const aliases={
    '国立ＭＵＦＧスタジアム':'',
    'ＭＵＦＧスタジアム':'',
    'ＩＡＩスタジアム日本平':'IAIスタジアム日本平',
    'ＵｖａｎｃｅとどろきスタジアムｂｙＦｕｊｉｔｓｕ':'Uvanceとどろきスタジアム by Fujitsu',
    'ＰＥＡＣＥＳＴＡＤＩＵＭＣｏｎｎｅｃｔｅｄｂｙＳｏｆｔＢａｎｋ':'PEACE STADIUM Connected by SoftBank'
  };
  const compact=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s・]/g,'');
  const target=compact(name),alias=aliases[name];
  if(alias!==undefined)return alias?data.find(s=>s.name===alias):null;
  return data.find(s=>{const n=compact(s.name);return n===target||n.includes(target)||target.includes(n)})||null
}

function renderSchedule(){
  const today=localDateKey(),matches=scheduleMatches.filter(m=>m.date>=today&&(scheduleFilter==='ALL'||m.league===scheduleFilter));
  $('scheduleCount').textContent=`今後の試合 ${matches.length}件`;
  if(!matches.length){$('monthShortcuts').innerHTML='';$('scheduleItems').innerHTML='<div class="schedule-empty">表示できる今後の日程がありません。</div>';return}
  const months={};matches.forEach(m=>((months[m.date.slice(0,7)]??={})[m.date]??=[]).push(m));
  $('monthShortcuts').innerHTML=`<button class="active" data-month="recent">直近</button>${Object.keys(months).map(month=>`<button data-month="${month}">${monthLabel(month)}</button>`).join('')}`;
  $('scheduleItems').innerHTML=Object.entries(months).map(([month,days])=>`<section class="schedule-month" id="schedule-month-${month}" data-month="${month}"><h2 class="schedule-month-title">${monthLabel(month)}</h2>${Object.entries(days).map(([date,items])=>`<section class="schedule-day"><h3>${displayDate(date)}</h3>${items.map(m=>{const stadium=stadiumForSchedule(m.stadium);return `<article class="match-card"><div class="match-top"><span class="schedule-badge ${m.league}">${m.league}</span><strong>${m.time}</strong></div><div class="match-teams"><span>${m.home}</span><b>VS</b><span>${m.away}</span></div><div class="match-bottom">${stadium?`<button class="match-stadium" data-stadium-id="${stadium.id}">📍 ${m.stadium}</button>`:`<span class="match-stadium-text">📍 ${m.stadium}</span>`}<a href="${m.url}" target="_blank" rel="noopener">公式試合情報</a></div></article>`}).join('')}</section>`).join('')}</section>`).join('');
  document.querySelectorAll('#monthShortcuts button').forEach(button=>button.onclick=()=>jumpToSchedule(button.dataset.month));
  document.querySelectorAll('.match-stadium').forEach(button=>button.onclick=()=>showDetail(button.dataset.stadiumId))
}

function setMainView(view){
  const stadium=view==='stadium';
  $('stadiumViewBtn').classList.toggle('active',stadium);$('scheduleViewBtn').classList.toggle('active',!stadium);
  $('stadiumControls').hidden=!stadium;$('stadiumList').hidden=!stadium;$('scheduleView').hidden=stadium;
  if(!stadium)renderSchedule()
}

async function loadSchedule(){
  try{
    const response=await fetch(`schedule.json?t=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error('schedule');
    const payload=await response.json();scheduleMatches=Array.isArray(payload.matches)?payload.matches:[];
    $('scheduleUpdated').textContent=payload.updatedAt?`最終更新：${new Date(payload.updatedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`:'';
    renderSchedule()
  }catch(error){$('scheduleCount').textContent='日程を読み込めませんでした';$('scheduleItems').innerHTML='<div class="schedule-empty">時間をおいて、もう一度開いてください。</div>'}
}

$('stadiumViewBtn').onclick=()=>setMainView('stadium');
$('scheduleViewBtn').onclick=()=>setMainView('schedule');
document.querySelectorAll('#scheduleTabs button').forEach(button=>button.onclick=()=>{scheduleFilter=button.dataset.l;document.querySelectorAll('#scheduleTabs button').forEach(item=>item.classList.toggle('active',item===button));renderSchedule()});
loadSchedule();
