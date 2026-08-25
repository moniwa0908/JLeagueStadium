let standingsData={J1:[],J2:[],J3:[]},standingsLeague='J1';

const standingsButton=document.createElement('button');
standingsButton.id='standingsViewBtn';standingsButton.textContent='順位表';
$('scheduleViewBtn').after(standingsButton);

const standingsView=document.createElement('section');
standingsView.id='standingsView';standingsView.className='standings-view';standingsView.hidden=true;
standingsView.innerHTML='<div class="standings-head"><h2>Jリーグ順位表</h2><span class="standings-updated" id="standingsUpdated"></span></div><div class="standings-tabs" id="standingsTabs"><button class="J1 active" data-l="J1">J1</button><button class="J2" data-l="J2">J2</button><button class="J3" data-l="J3">J3</button></div><div class="standings-table-wrap" id="standingsItems"><div class="schedule-empty">順位表を読み込み中です</div></div><p class="standings-note">表は横にスライドできます。チーム名を押すと日程を表示します。</p><a class="detail-action official-button" id="standingsOfficial" href="https://www.jleague.jp/j1/standings/2026-27/" target="_blank" rel="noopener">Jリーグ公式の順位表を確認</a>';
$('scheduleView').after(standingsView);

function standingsEscape(value){
  return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
}

function renderStandings(){
  const rows=standingsData[standingsLeague]||[];
  $('standingsOfficial').href=`https://www.jleague.jp/${standingsLeague.toLowerCase()}/standings/2026-27/`;
  if(!rows.length){$('standingsItems').innerHTML='<div class="schedule-empty">順位表を表示できません。</div>';return}
  $('standingsItems').innerHTML=`<table class="standings-table"><colgroup><col class="col-rank"><col class="col-team"><col class="col-points"><col class="col-played"><col class="col-record"><col class="col-goals"><col class="col-diff"></colgroup><thead><tr><th>順位</th><th>チーム</th><th>勝点</th><th>試合</th><th>勝-分-敗</th><th>得-失</th><th>差</th></tr></thead><tbody>${rows.map(row=>`<tr class="${String(row.team).includes('セレッソ大阪')?'standing-cerezo':''}"><td>${standingsEscape(row.rank)}</td><td><button class="standing-team" data-team="${standingsEscape(row.team)}">${standingsEscape(row.team)}</button></td><td class="standing-points">${standingsEscape(row.points)}</td><td>${standingsEscape(row.played)}</td><td>${standingsEscape(row.won)}-${standingsEscape(row.drawn)}-${standingsEscape(row.lost)}</td><td>${standingsEscape(row.goalsFor)}-${standingsEscape(row.goalsAgainst)}</td><td>${standingsEscape(row.goalDifference)}</td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('.standing-team').forEach(button=>button.onclick=()=>openTeamSchedule(button.dataset.team))
}

function openTeamSchedule(team){
  scheduleFilter=standingsLeague;scheduleTeam=team;scheduleMode='upcoming';selectedScheduleDate='ALL';
  document.querySelectorAll('#scheduleModePicker button').forEach(button=>button.classList.toggle('active',button.dataset.mode==='upcoming'));
  document.querySelectorAll('#scheduleTabs button').forEach(button=>button.classList.toggle('active',button.dataset.l===scheduleFilter));
  updateTeamOptions();$('scheduleTeam').value=team;resetScheduleDate();setMainView('schedule')
}

async function loadStandings(){
  try{
    const response=await fetch(`schedule.json?t=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error('standings');
    const payload=await response.json();standingsData=payload.standings||standingsData;
    const updatedAt=payload.standingsUpdatedAt||payload.updatedAt;
    $('standingsUpdated').textContent=updatedAt?`最終更新：${new Date(updatedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`:'';
    renderStandings()
  }catch(error){$('standingsItems').innerHTML='<div class="schedule-empty">順位表を読み込めませんでした。</div>'}
}

standingsButton.onclick=()=>setMainView('standings');
document.querySelectorAll('#standingsTabs button').forEach(button=>button.onclick=()=>{standingsLeague=button.dataset.l;document.querySelectorAll('#standingsTabs button').forEach(item=>item.classList.toggle('active',item===button));renderStandings()});
loadStandings();
