/* ══════════════════════════════════════
   ANA SAYFA
══════════════════════════════════════ */
/* Firebase Spark planı doluluk takibi (sadece admin) */
function countPhotos(){
  let c=0;
  S.reports.forEach(r=>{ if(r.photos) c+=r.photos.length; });
  return c;
}

/* Veri & Kota takip kartı — SADECE SÜPER ADMIN görür
   DB ve Storage ayrı ayrı, tıklayınca kota ayarı */
function renderFbUsage(){
  const el=document.getElementById('fb-usage-box');
  if(!el) return;
  // Sadece süper admin görür
  if(!isSuperAdmin()){ el.innerHTML=''; return; }

  const lim=getQuotaLimits();
  const dbBytes=estimateDbBytes();
  const stBytes=estimateStorageBytes();
  const dbLimit=lim.dbGB*1024*1024*1024;
  const stLimit=lim.storageGB*1024*1024*1024;
  const dbPct=Math.min(100,(dbBytes/dbLimit)*100);
  const stPct=Math.min(100,(stBytes/stLimit)*100);

  const barColor=p=> p>=90?'linear-gradient(90deg,#ef4444,#dc2626)':p>=70?'linear-gradient(90deg,#f59e0b,#ef4444)':'linear-gradient(90deg,#22c55e,#16a34a)';
  const pctTxt=p=> p<0.01?'<0.01':p.toFixed(2);

  el.innerHTML=`<div class="ed-card" style="margin-bottom:18px;cursor:pointer" onclick="openQuotaPanel()">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span style="font-size:13px;font-weight:700;color:var(--txt)">📊 Veri & Depolama Takibi</span>
      <span style="font-size:11px;color:var(--accent);font-weight:600">⚙️ Kota Ayarla</span>
    </div>
    <!-- Veritabanı -->
    <div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span style="font-weight:600;color:var(--txt2)">🗄️ Veritabanı (canlı veri)</span>
        <span style="font-weight:700;color:${dbPct>=90?'var(--rtxt)':'var(--txt2)'}">%${pctTxt(dbPct)}</span>
      </div>
      <div style="height:10px;background:var(--bg);border-radius:6px;overflow:hidden">
        <div style="height:100%;width:${Math.max(dbPct,0.5)}%;background:${barColor(dbPct)};transition:width .4s"></div>
      </div>
      <div style="font-size:10.5px;color:var(--txt3);margin-top:3px">${fmtBytes(dbBytes)} / ${lim.dbGB} GB</div>
    </div>
    <!-- Storage -->
    <div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span style="font-weight:600;color:var(--txt2)">📁 Depolama (belgeler)</span>
        <span style="font-weight:700;color:${stPct>=90?'var(--rtxt)':'var(--txt2)'}">%${pctTxt(stPct)}</span>
      </div>
      <div style="height:10px;background:var(--bg);border-radius:6px;overflow:hidden">
        <div style="height:100%;width:${Math.max(stPct,0.5)}%;background:${barColor(stPct)};transition:width .4s"></div>
      </div>
      <div style="font-size:10.5px;color:var(--txt3);margin-top:3px">${fmtBytes(stBytes)} / ${lim.storageGB} GB</div>
    </div>
  </div>`;
}

/* Kota ayar paneli (süper admin) */
function openQuotaPanel(){
  if(!isSuperAdmin()){ toast('🔒 Sadece süper admin'); return; }
  const lim=getQuotaLimits();
  renderQuotaOptions('db', lim.dbGB);
  renderQuotaOptions('storage', lim.storageGB);
  openModal('modal-quota');
}

let _quotaDb=null, _quotaStorage=null;
function renderQuotaOptions(which, current){
  const free = which==='db'?FREE_DB_GB:FREE_STORAGE_GB;
  const opts = which==='db'?[1,10,20,50]:[5,10,20,50];
  if(which==='db') _quotaDb=current; else _quotaStorage=current;
  const el=document.getElementById(which==='db'?'quota-db-opts':'quota-storage-opts');
  if(!el) return;
  el.innerHTML=opts.map(g=>`<button class="quota-opt${current==g?' active':''}" onclick="setQuotaOpt('${which}',${g})">${g} GB${g===free?' (ücretsiz)':''}</button>`).join('')
    +`<button class="quota-opt${!opts.includes(current)?' active':''}" onclick="setQuotaManual('${which}')">✏️ El ile</button>`;
}
function setQuotaOpt(which, g){
  const free=which==='db'?FREE_DB_GB:FREE_STORAGE_GB;
  if(g<free){ toast(`⚠️ Alt limit ${free} GB`); g=free; }
  if(which==='db') _quotaDb=g; else _quotaStorage=g;
  renderQuotaOptions(which, g);
}
async function setQuotaManual(which){
  const free=which==='db'?FREE_DB_GB:FREE_STORAGE_GB;
  const v=await promptDialog({title:'El ile Kota',message:`GB cinsinden değer girin (en az ${free}):`,placeholder:'Örn: 100',okText:'Ayarla'});
  if(v===null) return;
  let g=parseFloat(v);
  if(isNaN(g)||g<free){ toast(`⚠️ En az ${free} GB olmalı`); return; }
  if(which==='db') _quotaDb=g; else _quotaStorage=g;
  renderQuotaOptions(which, g);
}
async function saveQuota(){
  if(!isSuperAdmin()) return;
  S.quotaLimits={dbGB:_quotaDb||FREE_DB_GB, storageGB:_quotaStorage||FREE_STORAGE_GB};
  try{ await save(); closeModal('modal-quota'); renderFbUsage(); toast('✅ Kota limitleri güncellendi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* Veri saklama süreleri paneli (sadece süper admin) */
function openRetentionPanel(){
  if(!isSuperAdmin()){ toast('🔒 Sadece süper admin'); return; }
  const r=getRetention();
  document.getElementById('ret-reports').value=r.reports;
  document.getElementById('ret-documents').value=r.documents;
  document.getElementById('ret-notifications').value=r.notifications;
  document.getElementById('ret-logs').value=r.logs;
  const woEl=document.getElementById('ret-workorders'); if(woEl) woEl.value=r.workorders;
  openModal('modal-retention');
}
async function saveRetention(){
  if(!isSuperAdmin()) return;
  const num=(id,def)=>{ const v=parseInt(document.getElementById(id)?.value); return (isNaN(v)||v<1)?def:v; };
  S.retention={
    reports: num('ret-reports', DEFAULT_RETENTION.reports),
    documents: num('ret-documents', DEFAULT_RETENTION.documents),
    notifications: num('ret-notifications', DEFAULT_RETENTION.notifications),
    logs: num('ret-logs', DEFAULT_RETENTION.logs),
    workorders: num('ret-workorders', DEFAULT_RETENTION.workorders),
  };
  logActivity('retention', 'Veri saklama süreleri güncellendi');
  try{
    await save(); closeModal('modal-retention'); toast('✅ Veri saklama süreleri kaydedildi');
    S._retentionDay=null; runRetentionCleanup(); // hemen uygula
  }catch(e){ toast('❌ '+e.message,5000); }
}

function renderHome(){
  // Firebase doluluk barı (sadece admin)
  renderFbUsage();
  // Bana ait yarım kalan denetimler uyarısı
  renderMyIncomplete();
  // Şirket belge ağacı (sağ taraf) — hata olsa bile ana sayfa render edilsin
  try{ renderCompanyDocs(); }catch(e){ console.warn('renderCompanyDocs:', e); }
  try{ renderWorkOrders(); }catch(e){ console.warn('renderWorkOrders:', e); }
  // Ay filtresi
  const now=new Date();
  return _renderHomeRest(now);
}

/* Genel sayfalama kontrolü HTML'i üretir (◀ 1/3 ▶).
   total: toplam kayıt, page: mevcut sayfa (1-tabanlı), perPage: sayfa başına,
   fn: sayfa değiştiren JS ifadesi şablonu — '%P%' yerine yeni sayfa no gelir */
function pagerHTML(total, page, perPage, fnTemplate){
  const pages=Math.ceil(total/perPage);
  if(pages<=1) return '';
  const mk=(p)=>fnTemplate.replace(/%P%/g, p);
  const prevDis=page<=1?'opacity:.4;pointer-events:none':'';
  const nextDis=page>=pages?'opacity:.4;pointer-events:none':'';
  return `<div style="display:flex;align-items:center;justify-content:center;gap:14px;padding:10px 0;margin-top:4px">
    <button class="pager-btn" style="${prevDis}" onclick="${mk(page-1)}">◀</button>
    <span style="font-size:12.5px;font-weight:600;color:var(--txt2)">${page} / ${pages}</span>
    <button class="pager-btn" style="${nextDis}" onclick="${mk(page+1)}">▶</button>
  </div>`;
}

/* Giriş yapan kullanıcıya ait yarım kalan denetimler (ana sayfa) — sayfalı, 5'er */
function renderMyIncomplete(){
  const el=document.getElementById('my-incomplete-box'); if(!el) return;
  const me=S.cur?.fullname||S.cur?.username||'';
  // Yönetici+/süper admin TÜM yarım raporları görür; diğer kullanıcılar sadece kendininkini
  const seesAll = S.cur?.isSuper || roleLevel(S.cur?.role)>=3 || getUserPerms(S.cur||{}).includes('view_notifications');
  const mine=S.reports.filter(r=>r.incomplete && (seesAll || (r.byId ? r.byId===S.cur?.id : r.by===me)));
  if(!mine.length){ el.innerHTML=''; return; }
  const PER=5;
  const pages=Math.ceil(mine.length/PER);
  if(S.pgIncomplete>pages) S.pgIncomplete=pages;
  if(S.pgIncomplete<1) S.pgIncomplete=1;
  const start=(S.pgIncomplete-1)*PER;
  const slice=mine.slice(start, start+PER);
  const title = seesAll ? `⚠️ Yarım kalan denetimler (${mine.length})` : `⏳ Yarım kalan denetimleriniz (${mine.length})`;
  el.innerHTML=`<div style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);border-radius:var(--r12);padding:12px 14px;margin-bottom:14px">
    <div style="font-weight:700;color:var(--otxt);font-size:13.5px;margin-bottom:8px">${title}</div>
    ${slice.map(r=>`<div onclick="openReportDetail('${r.id}')" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:var(--card);border-radius:8px;margin-bottom:6px;cursor:pointer">
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.catIcon||''} ${safe(r.equipName)}</div>
        <div style="font-size:11px;color:var(--txt3)">${safe(r.mahalName)} · ${r.date}${seesAll&&r.by?' · '+safe(r.by):''}</div>
      </div>
      <span style="font-size:12px;color:var(--accent);font-weight:600;white-space:nowrap">Devam →</span>
    </div>`).join('')}
    ${pagerHTML(mine.length, S.pgIncomplete, PER, 'S.pgIncomplete=%P%;renderMyIncomplete()')}
  </div>`;
}

function _renderHomeRest(now){
  const months=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const ayRpts=S.reports.filter(r=>{
    if(!r.createdAt) return false;
    const d=new Date(r.createdAt);
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
  });

  document.getElementById('home-stats').innerHTML=`
    <div style="font-size:11.5px;color:var(--txt2);margin-bottom:10px;font-weight:600">
      ${months[now.getMonth()]} ${now.getFullYear()} raporları
    </div>
    <div class="hstat-grid">
      <div class="hstat-card" style="cursor:pointer" onclick="S.reportFilter='all';showPage('reports')">
        <div class="hstat-icon">📋</div>
        <div class="hstat-num">${ayRpts.length}</div>
        <div class="hstat-lbl">Toplam</div>
      </div>
      <div class="hstat-card ok" style="cursor:pointer" onclick="S.reportFilter='ok';showPage('reports')">
        <div class="hstat-icon">✅</div>
        <div class="hstat-num">${ayRpts.filter(r=>r.result==='ok'&&!r.incomplete).length}</div>
        <div class="hstat-lbl">Uygun</div>
      </div>
      <div class="hstat-card fail" style="cursor:pointer" onclick="S.reportFilter='fail';showPage('reports')">
        <div class="hstat-icon">❌</div>
        <div class="hstat-num">${ayRpts.filter(r=>r.result==='fail'&&!r.incomplete).length}</div>
        <div class="hstat-lbl">Uygun Değil</div>
      </div>
      <div class="hstat-card pend" style="cursor:pointer" onclick="S.reportFilter='incomplete';showPage('reports')">
        <div class="hstat-icon">⏳</div>
        <div class="hstat-num">${ayRpts.filter(r=>r.incomplete).length}</div>
        <div class="hstat-lbl">Yarım</div>
      </div>
    </div>`;

  // Mahal grid
  const grid=document.getElementById('mahal-grid');
  grid.innerHTML='';
  S.mahals.forEach((m,idx)=>{
    const eq=S.equips.filter(e=>e.mahalId===m.id);
    const ok=eq.filter(e=>getStatus(e)==='ok').length;
    const fail=eq.filter(e=>getStatus(e)==='fail').length;
    const pend=eq.filter(e=>getStatus(e)==='pend').length;
    const card=document.createElement('div');
    card.className='mahal-card'+(fail>0?' has-fail':'');
    card.innerHTML=`
      ${fail>0?'<span class="mahal-warn"><svg viewBox="0 0 24 24" fill="#f59e0b" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"><path d="M12 3.5 22 20H2L12 3.5z"/><path d="M12 10v4" stroke="#7c2d12" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1" fill="#7c2d12" stroke="none"/></svg></span>':''}
      <span class="mahal-icon">${mahalIcon(idx,m)}</span>
      <div class="mahal-name">${safe(m.name)}</div>
      <div class="mahal-sub">${eq.length} ekipman</div>
      <div class="mahal-mini-stats">
        ${ok  ?`<span class="mini-stat ms-ok">✅${ok}</span>`:''}
        ${fail?`<span class="mini-stat ms-fail">❌${fail}</span>`:''}
        ${pend?`<span class="mini-stat ms-pend">⏳${pend}</span>`:''}
      </div>
      ${(canDo('add_mahal')||canDo('del_mahal'))?`<button class="mahal-edit-btn" data-mid="${m.id}">✏️</button>`:''}`;
    card.addEventListener('click',ev=>{
      if(ev.target.closest('.mahal-edit-btn')){ openEditMahal(m.id); return; }
      S.activeMahalId=m.id; showPage('mahal');
    });
    grid.appendChild(card);
  });

  // Mahal ekle kartı (mahal ekleme yetkisi olanlar)
  if(canDo('add_mahal')){
    const addCard=document.createElement('div');
    addCard.className='mahal-add-card';
    addCard.innerHTML='<span style="font-size:26px">➕</span><div style="font-size:13px;font-weight:600;margin-top:8px;color:var(--txt2)">Mahal Ekle</div>';
    addCard.addEventListener('click',()=>openAddMahal());
    grid.appendChild(addCard);
  }

  if(!S.mahals.length&&!canDo('add_mahal')){
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🏨</div><p>Henüz mahal eklenmedi.</p></div>`;
  }
}

