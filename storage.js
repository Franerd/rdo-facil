const DRAFT_KEY='rdo-facil-rascunho';
const HISTORY_KEY='rdo-facil-historico';
let currentId=null;
function formValues(){return Object.fromEntries(ids.map(id=>[id,el[id].value]))}
function savedReports(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{return[]}}
function saveDraft(){localStorage.setItem(DRAFT_KEY,JSON.stringify(formValues()))}
function fillForm(data){ids.forEach(id=>el[id].value=data[id]||'');if(!el.data.value)el.data.value=new Date().toISOString().slice(0,10);atualizar();saveDraft()}
function dateBR(value){return value?new Date(value+'T12:00:00').toLocaleDateString('pt-BR'):'Sem data'}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function renderHistory(){const list=document.getElementById('historico');const reports=savedReports();if(!reports.length){list.innerHTML='<div class="empty">Nenhum RDO salvo ainda.</div>';return}list.innerHTML=reports.map(report=>`<article class="historyItem"><div><strong>${escapeHtml(report.obra||'Obra não informada')}</strong><small>${escapeHtml(dateBR(report.data))} · ${escapeHtml(report.local||'Local não informado')}</small></div><div class="historyActions"><button data-open="${report.id}">Abrir</button><button data-copy="${report.id}">Duplicar</button><button class="delete" data-delete="${report.id}">Excluir</button></div></article>`).join('')}
const draft=localStorage.getItem(DRAFT_KEY);if(draft){try{fillForm(JSON.parse(draft))}catch{}}
ids.forEach(id=>el[id].addEventListener('input',saveDraft));
document.getElementById('salvar').onclick=()=>{const reports=savedReports();const now=new Date().toISOString();if(currentId){const index=reports.findIndex(report=>report.id===currentId);if(index>=0)reports[index]={...formValues(),id:currentId,updatedAt:now};else currentId=null}if(!currentId){currentId=String(Date.now());reports.unshift({...formValues(),id:currentId,updatedAt:now})}localStorage.setItem(HISTORY_KEY,JSON.stringify(reports));renderHistory();const status=document.getElementById('saveStatus');status.textContent='RDO salvo com sucesso';setTimeout(()=>status.textContent='',2200)};
document.getElementById('novo').onclick=()=>{currentId=null;ids.forEach(id=>el[id].value='');el.data.value=new Date().toISOString().slice(0,10);localStorage.removeItem(DRAFT_KEY);atualizar();saveDraft();scrollTo({top:0,behavior:'smooth'})};
document.getElementById('historico').onclick=event=>{const button=event.target.closest('button');if(!button)return;const id=button.dataset.open||button.dataset.copy||button.dataset.delete;const reports=savedReports();const report=reports.find(item=>item.id===id);if(button.dataset.delete){if(confirm('Excluir este RDO deste aparelho?')){localStorage.setItem(HISTORY_KEY,JSON.stringify(reports.filter(item=>item.id!==id)));if(currentId===id)currentId=null;renderHistory()}return}if(report){currentId=button.dataset.copy?null:report.id;fillForm(report);scrollTo({top:0,behavior:'smooth'})}};
renderHistory();
