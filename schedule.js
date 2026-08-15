let scheduleMatches=[],scheduleFilter='ALL',scheduleTeam='ALL',scheduleMode='upcoming',selectedScheduleDate='ALL',calendarMonth=localDateKey().slice(0,7);
const teamNorthOrder=[
  '北海道コンサドーレ札幌','ヴァンラーレ八戸','ブラウブリッツ秋田','ベガルタ仙台','モンテディオ山形','アルビレックス新潟','福島ユナイテッドＦＣ','いわきＦＣ',
  'ＡＣ長野パルセイロ','ツエーゲン金沢','カターレ富山','水戸ホーリーホック','栃木ＳＣ','栃木シティ','ザスパ群馬','松本山雅ＦＣ','鹿島アントラーズ',
  'ＲＢ大宮アルディージャ','浦和レッズ','柏レイソル','ジェフユナイテッド千葉','ＦＣ東京','東京ヴェルディ','ＦＣ町田ゼルビア','川崎フロンターレ','ＳＣ相模原','横浜Ｆ・マリノス','横浜ＦＣ','湘南ベルマーレ','ヴァンフォーレ甲府',
  '名古屋グランパス','清水エスパルス','藤枝ＭＹＦＣ','ジュビロ磐田','ＦＣ岐阜','京都サンガF.C.','レイラック滋賀ＦＣ','ガンバ大阪','ヴィッセル神戸','セレッソ大阪','奈良クラブ','ＦＣ大阪',
  'ファジアーノ岡山','ガイナーレ鳥取','サンフレッチェ広島','レノファ山口ＦＣ','カマタマーレ讃岐','徳島ヴォルティス','愛媛ＦＣ','ＦＣ今治','高知ユナイテッドＳＣ','アビスパ福岡','ギラヴァンツ北九州','サガン鳥栖','Ｖ・ファーレン長崎','ロアッソ熊本','大分トリニータ','テゲバジャーロ宮崎','鹿児島ユナイテッドＦＣ','ＦＣ琉球'
];

const teamPicker=document.createElement('div');
teamPicker.className='team-schedule-picker';
teamPicker.innerHTML='<label for="scheduleTeam">チーム</label><select id="scheduleTeam" aria-label="表示するチーム"><option value="ALL">すべてのチーム</option></select>';
const scheduleModePicker=document.createElement('div');
scheduleModePicker.className='schedule-mode-picker';scheduleModePicker.id='scheduleModePicker';
scheduleModePicker.innerHTML='<button class="active" data-mode="upcoming">これからの試合</button><button data-mode="results">試合結果</button>';
$('monthShortcuts').before(scheduleModePicker,teamPicker);
const scheduleCalendar=document.createElement('section');
scheduleCalendar.id='scheduleCalendar';
scheduleCalendar.className='schedule-calendar';
scheduleCalendar.setAttribute('aria-label','試合日カレンダー');
teamPicker.after(scheduleCalendar);

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
  calendarMonth=target==='recent'?element.dataset.month:target;
  renderCalendar(baseScheduleMatches());
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

function updateTeamOptions(reset=false){
  const select=$('scheduleTeam');
  const leagues=scheduleFilter==='ALL'?['J1','J2','J3']:[scheduleFilter];
  const byLeague=Object.fromEntries(leagues.map(league=>[league,[...new Set(scheduleMatches.filter(m=>m.league===league).flatMap(m=>[m.home,m.away]))].sort((a,b)=>{
    const ai=teamNorthOrder.indexOf(a),bi=teamNorthOrder.indexOf(b);
    return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,'ja')
  })]));
  const teams=leagues.flatMap(league=>byLeague[league]);
  if(reset||!teams.includes(scheduleTeam))scheduleTeam='ALL';
  select.replaceChildren(new Option('すべてのチーム','ALL'));
  leagues.forEach(league=>{
    const group=document.createElement('optgroup');group.label=league;
    group.append(...byLeague[league].map(team=>new Option(team,team)));
    select.append(group)
  });
  select.value=scheduleTeam
}

function baseScheduleMatches(){
  const today=localDateKey();
  const matches=scheduleMatches.filter(m=>(scheduleMode==='results'?m.status==='finished':m.status!=='finished'&&m.date>=today)&&(scheduleFilter==='ALL'||m.league===scheduleFilter)&&(scheduleTeam==='ALL'||m.home===scheduleTeam||m.away===scheduleTeam));
  return scheduleMode==='results'?matches.reverse():matches
}

function renderCalendar(matches){
  const [year,month]=calendarMonth.split('-').map(Number),firstWeekday=new Date(year,month-1,1).getDay(),lastDay=new Date(year,month,0).getDate();
  const counts={};matches.filter(m=>m.date.startsWith(calendarMonth)).forEach(m=>counts[m.date]=(counts[m.date]||0)+1);
  const blanks='<span class="calendar-blank"></span>'.repeat(firstWeekday);
  const days=Array.from({length:lastDay},(_,index)=>{
    const day=index+1,date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,count=counts[date]||0;
    return `<button class="calendar-day${count?' has-match':''}${selectedScheduleDate===date?' selected':''}" data-date="${date}" ${count?'':'disabled'}><span>${day}</span>${count?`<small>${count}試合</small>`:''}</button>`
  }).join('');
  $('scheduleCalendar').innerHTML=`<div class="calendar-head"><button id="calendarPrev" aria-label="前の月">‹</button><strong>${monthLabel(calendarMonth)}</strong><button id="calendarNext" aria-label="次の月">›</button></div><div class="calendar-week"><span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span></div><div class="calendar-grid">${blanks}${days}</div><button class="calendar-all${selectedScheduleDate==='ALL'?' active':''}" id="calendarAll">全日程を表示</button>`;
  $('calendarPrev').onclick=()=>changeCalendarMonth(-1,matches);
  $('calendarNext').onclick=()=>changeCalendarMonth(1,matches);
  $('calendarAll').onclick=()=>{selectedScheduleDate='ALL';renderSchedule()};
  document.querySelectorAll('.calendar-day.has-match').forEach(button=>button.onclick=()=>{selectedScheduleDate=button.dataset.date;renderSchedule()})
}

function changeCalendarMonth(amount,matches){
  const [year,month]=calendarMonth.split('-').map(Number),date=new Date(year,month-1+amount,1);
  calendarMonth=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  selectedScheduleDate='ALL';
  renderSchedule()
}

function resetScheduleDate(){
  selectedScheduleDate='ALL';
  const first=baseScheduleMatches()[0];
  if(first)calendarMonth=first.date.slice(0,7)
}

function renderSchedule(){
  const baseMatches=baseScheduleMatches(),matches=selectedScheduleDate==='ALL'?baseMatches:baseMatches.filter(m=>m.date===selectedScheduleDate);
  renderCalendar(baseMatches);
  const modeLabel=scheduleMode==='results'?'試合結果':'これからの試合';
  $('scheduleCount').textContent=`${scheduleTeam==='ALL'?'':scheduleTeam+'：'}${selectedScheduleDate==='ALL'?modeLabel:displayDate(selectedScheduleDate)} ${matches.length}件`;
  if(!matches.length){$('monthShortcuts').innerHTML='';$('scheduleItems').innerHTML=`<div class="schedule-empty">表示できる${modeLabel}がありません。</div>`;return}
  const months={};matches.forEach(m=>((months[m.date.slice(0,7)]??={})[m.date]??=[]).push(m));
  $('monthShortcuts').innerHTML=`<button class="active" data-month="recent">${scheduleMode==='results'?'最新':'直近'}</button>${Object.keys(months).map(month=>`<button data-month="${month}">${monthLabel(month)}</button>`).join('')}`;
  $('scheduleItems').innerHTML=Object.entries(months).map(([month,days])=>`<section class="schedule-month" id="schedule-month-${month}" data-month="${month}"><h2 class="schedule-month-title">${monthLabel(month)}</h2>${Object.entries(days).map(([date,items])=>`<section class="schedule-day"><h3>${displayDate(date)}</h3>${items.map(m=>{const stadium=stadiumForSchedule(m.stadium),result=m.status==='finished',homeWin=result&&m.homeScore>m.awayScore,awayWin=result&&m.awayScore>m.homeScore;return `<article class="match-card${result?' result-card':''}"><div class="match-top"><span class="schedule-badge ${m.league}">${m.league}</span><strong>${m.time}</strong>${result?'<small class="match-finished">試合終了</small>':''}</div><div class="match-teams"><span class="${homeWin?'winner':''}">${m.home}</span><b class="${result?'match-score':''}">${result?`${m.homeScore} - ${m.awayScore}`:'VS'}</b><span class="${awayWin?'winner':''}">${m.away}</span></div><div class="match-bottom">${stadium?`<button class="match-stadium" data-stadium-id="${stadium.id}">📍 ${m.stadium}</button>`:`<span class="match-stadium-text">📍 ${m.stadium}</span>`}<a href="${m.url}" target="_blank" rel="noopener">公式試合情報</a></div></article>`}).join('')}</section>`).join('')}</section>`).join('');
  document.querySelectorAll('#monthShortcuts button').forEach(button=>button.onclick=()=>jumpToSchedule(button.dataset.month));
  document.querySelectorAll('.match-stadium').forEach(button=>button.onclick=()=>showDetail(button.dataset.stadiumId))
}

function setMainView(view){
  const stadium=view==='stadium',schedule=view==='schedule',standings=view==='standings';
  $('stadiumViewBtn').classList.toggle('active',stadium);$('scheduleViewBtn').classList.toggle('active',schedule);$('standingsViewBtn').classList.toggle('active',standings);
  $('stadiumControls').hidden=!stadium;$('stadiumList').hidden=!stadium;$('scheduleView').hidden=!schedule;$('standingsView').hidden=!standings;
  if(schedule)renderSchedule();if(standings)renderStandings()
}

async function loadSchedule(){
  try{
    const response=await fetch(`schedule.json?t=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error('schedule');
    const payload=await response.json();scheduleMatches=Array.isArray(payload.matches)?payload.matches:[];updateTeamOptions();
    $('scheduleUpdated').textContent=payload.updatedAt?`最終更新：${new Date(payload.updatedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`:'';
    renderSchedule()
  }catch(error){$('scheduleCount').textContent='日程を読み込めませんでした';$('scheduleItems').innerHTML='<div class="schedule-empty">時間をおいて、もう一度開いてください。</div>'}
}

$('stadiumViewBtn').onclick=()=>setMainView('stadium');
$('scheduleViewBtn').onclick=()=>setMainView('schedule');
document.querySelectorAll('#scheduleTabs button').forEach(button=>button.onclick=()=>{scheduleFilter=button.dataset.l;document.querySelectorAll('#scheduleTabs button').forEach(item=>item.classList.toggle('active',item===button));updateTeamOptions(true);resetScheduleDate();renderSchedule()});
$('scheduleTeam').onchange=event=>{scheduleTeam=event.target.value;resetScheduleDate();renderSchedule()};
document.querySelectorAll('#scheduleModePicker button').forEach(button=>button.onclick=()=>{scheduleMode=button.dataset.mode;document.querySelectorAll('#scheduleModePicker button').forEach(item=>item.classList.toggle('active',item===button));resetScheduleDate();renderSchedule()});
loadSchedule();
