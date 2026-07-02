/* ══════════════════════════════════════
   YETKİ UI
══════════════════════════════════════ */
function applyPerms(){
  document.querySelectorAll('.perm-admin').forEach(el=>el.style.display=isAdmin()?'':'none');
  document.querySelectorAll('.perm-equip').forEach(el=>el.style.display=canDo('add_equip')?'':'none');
  document.querySelectorAll('.perm-insp').forEach(el=>el.style.display=canDo('inspect')?'':'none');
}

function updateTopbar(){
  const u=S.cur; if(!u) return;
  document.getElementById('avatar-letter').textContent=(u.fullname||u.username).charAt(0).toUpperCase();
  document.getElementById('am-name').textContent=u.fullname||u.username;
  document.getElementById('am-role').textContent=roleLabel(u.role);
  document.getElementById('greeting-text').textContent=`Hoşgeldiniz, ${u.fullname||u.username}`;
  document.getElementById('greeting-date').textContent=new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  // Süper admin bir şirkete girmişse: şirket bandı göster
  updateCompanyBanner();
}

function updateCompanyBanner(){
  let band=document.getElementById('super-company-band');
  const showBand = S.cur?.isSuper && S.activeCompanyId;
  if(showBand){
    if(!band){
      band=document.createElement('div');
      band.id='super-company-band';
      // padding-top'a safe-area: iPhone çentik/durum çubuğu altında kalmasın ("← Şirketler" tuşu erişilebilir olsun)
      // sticky top:0 — kaydırınca KAYBOLMAZ; topbar JS ile bandın ALTINA sabitlenir (üst üste binmez, boşluk olmaz)
      band.style.cssText='position:sticky;top:0;z-index:102;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:calc(8px + env(safe-area-inset-top)) 16px 8px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px';
      const app=document.getElementById('app');
      app.insertBefore(band, app.firstChild);
    }
    document.body.classList.add('has-company-band');
    band.innerHTML=`<span style="display:flex;align-items:center;gap:7px;min-width:0">
        <span style="font-size:15px">🏢</span>
        <span style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(S.activeCompanyName||'Şirket')}</span>
        <span style="opacity:.8;font-size:11px;white-space:nowrap">• süper admin</span>
      </span>
      <button onclick="exitCompany()" style="background:rgba(255,255,255,.2);color:#fff;border:none;border-radius:8px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">← Şirketler</button>`;
    band.style.display='flex';
  } else {
    document.body.classList.remove('has-company-band');
    if(band) band.style.display='none';
  }
  requestAnimationFrame(positionSidebar);
}

/* ══════════════════════════════════════
   NAVİGASYON
══════════════════════════════════════ */
const pageHistory=[];

function showPage(name, push=true){
  const prevPage=S.page;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg=document.getElementById('page-'+name);
  if(!pg) return;
  pg.classList.add('active');
  if(push && name!==S.page) pageHistory.push(S.page);
  S.page=name;
  window.scrollTo(0,0);
  document.querySelectorAll('.nav-btn[data-page]').forEach(b=>b.classList.remove('active'));
  document.querySelector(`.nav-btn[data-page="${name}"]`)?.classList.add('active');
  // Ekipmanlar sayfasına BAŞKA bir sayfadan girince kategorileri kapalı başlat
  // (aynı sayfada render/güncelleme ise açık kalanları koru)
  if(name==='equipments' && prevPage!=='equipments'){
    openCats.clear();
    S.pgEquip=1;
    Object.keys(_catPage).forEach(k=>_catPage[k]=1);
  }
  if(name==='home')        renderHome();
  if(name==='mahal')       renderMahalPage();
  if(name==='equipments')  renderEquipments();
  if(name==='reports')     renderReports();
  if(name==='profile')     renderProfile();
  if(name==='dashboard')   renderDashboard();
  if(name==='notifications') renderNotifications();
}

function renderCurrent(){ if(S.cur) showPage(S.page, false); }

/* Firebase'den art arda gelen güncellemeleri throttle et (300ms).
   Modal açıkken veya kullanıcı input'a yazarken render'ı erteler —
   böylece form doldururken ekran sıçramaz. */
let _renderTimer=null;
function scheduleRender(){
  if(!S.cur) return;
  // Açık modal var mı?
  const modalOpen=document.querySelector('.modal-ov.open');
  // Kullanıcı bir input/textarea'ya yazıyor mu?
  const tag=document.activeElement?.tagName;
  const typing=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';
  if(modalOpen||typing){
    // Ertele — 1 sn sonra tekrar dene
    clearTimeout(_renderTimer);
    _renderTimer=setTimeout(scheduleRender, 1000);
    return;
  }
  clearTimeout(_renderTimer);
  _renderTimer=setTimeout(()=>renderCurrent(), 300);
}

function goBack(){
  const prev=pageHistory.pop();
  showPage(prev&&prev!==S.page?prev:'home', false);
}

/* ══════════════════════════════════════
   DURUM
══════════════════════════════════════ */
function getStatus(e){
  // Yeni dinamik form sonucu
  if(e.lastInsp && e.lastInsp.result) return e.lastInsp.result;
  if(e.lastResult) return e.lastResult;
  // Eski tüp dolap formatı (geriye uyumluluk)
  if(e.cat==='tup-dolap' && e.tupRows){
    if(!e.tupRows.length) return 'pend';
    if(e.tupRows.some(r=>r.durum==='fail'||r.durum==='bekliyor')) return 'fail';
    if(e.tupRows.every(r=>r.durum==='ok')) return 'ok';
    return 'pend';
  }
  // lastInsp yoksa: bu ekipmanın TAMAMLANMIŞ raporlarından en yenisinin sonucunu al
  const reps=S.reports.filter(r=>r&&r.equipId===e.id && !r.incomplete && r.result && r.result!=='pend');
  if(reps.length){
    reps.sort((a,b)=>(parseDateStr(b.date)||0)-(parseDateStr(a.date)||0));
    return reps[0].result;
  }
  // Eski normal format
  if(!e.lastInsp) return 'pend';
  const vals=Object.values(e.lastInsp.answers||{});
  if(!vals.length) return 'pend';
  return vals.some(v=>v==='fail')?'fail':'ok';
}

function statusBadge(e){
  const s=getStatus(e);
  return s==='ok'  ?'<span class="status-badge sb-ok">✅ Uygun</span>'
        :s==='fail'?'<span class="status-badge sb-fail">❌ Uygun Değil</span>'
                   :'<span class="status-badge sb-pend">⏳ Denetlenmedi</span>';
}

/* Denetim tarihini parse et (tr formatı: "22.06.2026 14:30") */
/* Ekipmanın son denetim tarihini bul — önce lastInsp, yoksa tamamlanmış raporlardan */
function lastInspectionDate(e){
  // 1) e.lastInsp.date varsa onu kullan
  let best=null;
  const fromLast=parseDateStr(e.lastInsp&&e.lastInsp.date);
  if(fromLast) best=fromLast;
  // 2) Bu ekipmanın TAMAMLANMIŞ raporlarından en yenisini de hesaba kat
  //    (lastInsp güncellenmemiş olabilir — ortak çalışma vb.)
  const reps=S.reports.filter(r=>r&&r.equipId===e.id && !r.incomplete);
  reps.forEach(r=>{
    const d=parseDateStr(r.date);
    if(d && (!best || d>best)) best=d;
  });
  return best;
}
/* "27.06.2026 20:15" veya "27.06.2026" → Date */
function parseDateStr(str){
  if(!str) return null;
  const m=String(str).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if(!m) return null;
  return new Date(+m[3], +m[2]-1, +m[1], +(m[4]||0), +(m[5]||0));
}
function parseInspDate(e){
  return lastInspectionDate(e);
}

/* Kaç gün geçmiş — denetim gecikme durumu */
// Periyot seçenekleri (gün cinsinden)
const PERIOD_OPTIONS = [
  {v:7,    label:'Haftada 1'},
  {v:14,   label:'2 Haftada 1'},
  {v:30,   label:'Ayda 1'},
  {v:90,   label:'3 Ayda 1'},
  {v:180,  label:'6 Ayda 1'},
  {v:365,  label:'Yılda 1'},
  {v:'custom', label:'Özel (gün)'},
  {v:0,    label:'Periyot Yok'},
];
function periodLabel(days){
  if(days===0||days==null) return 'Periyot yok';
  const o=PERIOD_OPTIONS.find(p=>p.v===days);
  if(o) return o.label;
  return days+' günde 1';
}
/* Bir ekipmanın etkin periyodu (gün). e.period öncelikli, yoksa kategori varsayılanı */
function equipPeriod(e){
  if(e.period!==undefined && e.period!==null) return e.period; // 0 = yok
  return catDefaultPeriod(e.cat);
}
/* Bir kategorinin (türün) varsayılan periyodu — süper admin/admin ayarlayabilir */
function catDefaultPeriod(catId){
  if(S.catPeriods && S.catPeriods[catId]!==undefined && S.catPeriods[catId]!==null) return S.catPeriods[catId];
  return INSPECT_PERIOD[catId]||30;
}

function inspectStatus(e){
  const period=equipPeriod(e);
  if(!period){ return {state:'none', days:null, period:0}; } // periyot yok → uyarı yok
  const last=parseInspDate(e);
  if(!last) return {state:'never', days:null, period};   // hiç denetlenmemiş
  const days=Math.floor((Date.now()-last.getTime())/86400000);
  const remaining=period-days;
  if(remaining<0)  return {state:'overdue', days:-remaining, period};  // gecikmiş
  if(remaining<=7) return {state:'soon',    days:remaining, period};   // yaklaşıyor
  return {state:'ok', days:remaining, period};
}

/* Denetim hatırlatması gereken ekipmanlar */
function getDueEquips(){
  return S.equips.map(e=>({e, st:inspectStatus(e)}))
    .filter(x=>x.st.state==='overdue'||x.st.state==='never'||x.st.state==='soon')
    .sort((a,b)=>{
      const order={overdue:0,never:1,soon:2};
      return order[a.st.state]-order[b.st.state];
    });
}

function equipRowHTML(e, showMahal=false){
  const s=getStatus(e);
  const cat=catById(e.cat);
  const m=showMahal?mahalById(e.mahalId):null;
  const img=e.imageUrl?`<img src="${e.imageUrl}" style="width:36px;height:36px;border-radius:8px;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">`
                      :`<span style="font-size:24px;flex-shrink:0">${cat.icon}</span>`;
  // Denetim gecikme uyarısı
  const ist=inspectStatus(e);
  let warn='';
  if(ist.state==='never') warn=`<span class="eq-warn never">⚠️ hiç denetlenmedi</span>`;
  else if(ist.state==='overdue') warn=`<span class="eq-warn overdue">⚠️ ${ist.days} gün gecikti</span>`;
  else if(ist.state==='soon') warn=`<span class="eq-warn soon">⏰ ${ist.days} gün kaldı</span>`;
  return `<div class="equip-row ${s}" data-eid="${e.id}">
    ${img}
    <div class="eq-info">
      <div class="eq-name">${safe(e.name)}</div>
      <div class="eq-meta">${m?safe(m.name)+' · ':''}${e.lastInsp?e.lastInsp.date:'—'}</div>
      ${warn}
    </div>
    ${statusBadge(e)}
  </div>`;
}

