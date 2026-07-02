/* ══════════════════════════════════════
   MODAL & UI
══════════════════════════════════════ */
let _modalZ=10050; // dinamik modal z-index sayacı
function openModal(id){
  const ov=document.getElementById(id); if(!ov) return;
  const modal=ov.querySelector('.modal');
  // Alt kapat butonu yoksa ekle (X erişilemezse diye güvence)
  if(modal && !modal.querySelector('.modal-bottom-close')){
    const btn=document.createElement('button');
    btn.className='btn btn-secondary btn-full modal-bottom-close';
    btn.style.marginTop='16px';
    btn.textContent='✕ Kapat';
    btn.onclick=()=>{ closeModal(id); if(id==='modal-scan') stopCamera(); };
    modal.appendChild(btn);
  }
  // Açılan modal en üste gelsin (üst üste açılan modallar için)
  _modalZ+=10;
  ov.style.zIndex=_modalZ;
  ov.classList.add('open');
  if(modal) modal.scrollTop=0;
}
function closeModal(id){
  const ov=document.getElementById(id);
  if(ov){ ov.classList.remove('open'); ov.style.zIndex=''; }
  // Sayaç sıfırlama: açık modal kalmadıysa
  if(!document.querySelector('.modal-ov.open')) _modalZ=10050;
  if(id==='modal-insp'){ clearActiveInspection(); detachCollabListener(); }
}

/* ══════════════════════════════════════
   TEMA
══════════════════════════════════════ */
// Tema ikonları (SVG) — koyu moddayken güneş, açık moddayken ay
const THEME_ICON={
  moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
};
function themeIcon(t){ return t==='dark'?THEME_ICON.sun:THEME_ICON.moon; }

/* Status bar rengini temaya göre güncelle (Android adres çubuğu) */
function updateThemeColor(t){
  const meta=document.getElementById('meta-theme-color');
  if(meta) meta.setAttribute('content', t==='dark'?'#0D1117':'#F5F7FA');
}

function initTheme(){
  const t=getTheme();
  document.documentElement.setAttribute('data-theme',t);
  updateThemeColor(t);
  const btn=document.getElementById('btn-theme');
  if(btn) btn.innerHTML=themeIcon(t);
}

/* ══════════════════════════════════════
   EVENT LISTENERS
══════════════════════════════════════ */
function setupListeners(){
  document.getElementById('btn-login')?.addEventListener('click',doLogin);
  document.getElementById('login-pass')?.addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });

  // Şifre göster/gizle — tüm pw-toggle butonları (event delegation)
  const EYE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 7 10 7a16 16 0 0 1-3.4 4M6.6 6.6A16 16 0 0 0 2 11s3.5 7 10 7a10 10 0 0 0 4.3-.9M3 3l18 18M9.5 9.5a3 3 0 0 0 4.2 4.2"/></svg>';
  // İkonları yerleştir
  document.querySelectorAll('.pw-toggle').forEach(b=>{ b.innerHTML=EYE; });
  // Tıklama (delegation — modaller sonradan açılsa da çalışır)
  document.addEventListener('click',e=>{
    const t=e.target.closest('.pw-toggle');
    if(!t) return;
    const inp=document.getElementById(t.dataset.pw);
    if(!inp) return;
    const show=inp.type==='password';
    inp.type=show?'text':'password';
    t.innerHTML=show?EYE_OFF:EYE;
  });

  document.getElementById('btn-logout')?.addEventListener('click',doLogout);
  document.getElementById('logo-home-btn')?.addEventListener('click',()=>showPage('home'));
  document.getElementById('global-back')?.addEventListener('click',goBack);
  document.getElementById('btn-theme')?.addEventListener('click',()=>{
    const cur=document.documentElement.getAttribute('data-theme');
    const next=cur==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',next);
    setTheme(next);
    updateThemeColor(next);
    document.getElementById('btn-theme').innerHTML=themeIcon(next);
  });
  document.getElementById('btn-avatar')?.addEventListener('click',e=>{
    e.stopPropagation();
    document.getElementById('avatar-menu')?.classList.toggle('open');
  });
  document.addEventListener('click',e=>{ if(!e.target.closest('.avatar-wrap')) document.getElementById('avatar-menu')?.classList.remove('open'); });
  document.querySelectorAll('.am-item[data-go]').forEach(btn=>btn.addEventListener('click',()=>{ document.getElementById('avatar-menu')?.classList.remove('open'); showPage(btn.dataset.go); }));
  document.querySelectorAll('.nav-btn[data-page]').forEach(b=>b.addEventListener('click',()=>{
    const pg=b.dataset.page;
    // Navbar'dan girişte filtreleri sıfırla (temiz başlasın)
    if(pg==='equipments'){ S.filterCat='all'; S.searchQ=''; const si=document.getElementById('equip-search'); if(si) si.value=''; }
    if(pg==='reports'){ S.reportFilter='all'; S.reportMahalFilter='all'; S.reportQ=''; S.pgReports=1; const ri=document.getElementById('report-search'); if(ri) ri.value=''; }
    showPage(pg);
  }));
  document.getElementById('nav-qr-btn')?.addEventListener('click',()=>{ openModal('modal-scan'); setTimeout(()=>{ startCamera&&startCamera(); }, 350); });
  // (Misafir QR okut kaldırıldı — QR artık normal kamerayla açılıyor)
  document.getElementById('btn-save-mahal')?.addEventListener('click',saveMahal);
  document.getElementById('inp-mahal-name')?.addEventListener('keydown',e=>{ if(e.key==='Enter') saveMahal(); });
  document.getElementById('btn-save-edit-mahal')?.addEventListener('click',saveEditMahal);
  document.getElementById('btn-del-mahal')?.addEventListener('click',deleteMahal);
  document.getElementById('btn-copy-mahal')?.addEventListener('click',copyMahal);
  document.getElementById('btn-add-equip-mahal')?.addEventListener('click',()=>{ if(!canDo('add_equip')){ toast('🚫 Yetkiniz yok'); return; } openAddEquipModal(); setTimeout(()=>{ const s=document.getElementById('inp-equip-mahal'); if(S.activeMahalId&&s) s.value=S.activeMahalId; },60); });
  document.getElementById('inp-equip-cat')?.addEventListener('change',onCatChange);
  // Periyot "özel" seçilince gün girişini göster
  document.getElementById('inp-equip-period')?.addEventListener('change',function(){
    const c=document.getElementById('inp-equip-period-custom'); if(c) c.style.display=this.value==='custom'?'block':'none';
  });
  document.getElementById('edit-equip-period')?.addEventListener('change',function(){
    const c=document.getElementById('edit-equip-period-custom'); if(c) c.style.display=this.value==='custom'?'block':'none';
  });
  document.getElementById('fd-period')?.addEventListener('change',function(){
    const c=document.getElementById('fd-period-custom'); if(c) c.style.display=this.value==='custom'?'block':'none';
  });
  document.getElementById('newcat-period')?.addEventListener('change',function(){
    const c=document.getElementById('newcat-period-custom'); if(c) c.style.display=this.value==='custom'?'block':'none';
  });
  document.getElementById('btn-save-equip')?.addEventListener('click',saveNewEquip);
  document.getElementById('btn-add-edit-catform')?.addEventListener('click',()=>{
    const cat=document.getElementById('inp-equip-cat')?.value;
    if(!cat||cat==='__new__'){ toast('⚠️ Önce bir tür seçin'); return; }
    if(!_newEquipForm) _newEquipForm=getCatForm(cat);
    // Bu eklenecek ekipmana özel taslağı düzenle (türe DOKUNMA)
    _fdForm=JSON.parse(JSON.stringify(_newEquipForm));
    _fdCatId=null; _fdSaveTarget='newequip'; _fdOpen=-1;
    _fdCatName=catById(cat).name;
    document.getElementById('fd-title').textContent='🛠️ Yeni Ekipman — Denetim Formu';
    document.getElementById('fd-subtitle').textContent='Bu ekipmana özel form. Türü etkilemez.';
    renderFdFields();
    openModal('modal-form-designer');
  });
  document.getElementById('btn-save-edit-equip')?.addEventListener('click',saveEditEquip);
  document.getElementById('btn-edit-equip-form')?.addEventListener('click',editEquipForm);
  document.getElementById('btn-del-equip')?.addEventListener('click',deleteEquip);
  document.getElementById('btn-dl-qr')?.addEventListener('click',downloadQR);
  document.getElementById('btn-regen-qr')?.addEventListener('click',async()=>{ if(!await confirmDialog({title:'QR Yenilensin mi?',message:'Eski QR kodu geçersiz olacak, yeni etiket basmanız gerekecek.',okText:'Evet, Yenile'})) return; const e=equipById(S.qrEquipId); if(!e) return; e.id=uid(); S.qrEquipId=e.id; try{ await save(); showQRModal(e.id); toast('🔄 Yenilendi'); }catch(err){ toast('❌ '+err.message,5000); } });
  document.querySelectorAll('#modal-scan .tab').forEach(t=>t.addEventListener('click',()=>switchScanTab(t.dataset.tab)));
  document.getElementById('btn-cam-start')?.addEventListener('click',startCamera);
  document.getElementById('btn-cam-stop')?.addEventListener('click',stopCamera);
  document.getElementById('qr-file')?.addEventListener('change',e=>handleQRFile(e.target.files[0]));
  document.getElementById('btn-manual-find')?.addEventListener('click',manualQRFind);
  document.getElementById('manual-qr-inp')?.addEventListener('keydown',e=>{ if(e.key==='Enter') manualQRFind(); });
  document.getElementById('report-search')?.addEventListener('input',e=>{ S.reportQ=e.target.value; S.pgReports=1; toggleClear(e.target); renderReports(); });
  document.getElementById('search-bar')?.addEventListener('input',e=>{ S.searchQ=e.target.value; S.pgEquip=1; toggleClear(e.target); renderEquipments(); });
  // Arama temizle (×) butonları
  document.addEventListener('click',e=>{
    const c=e.target.closest('.search-clear');
    if(!c) return;
    const inp=document.getElementById(c.dataset.clear);
    if(!inp) return;
    inp.value=''; inp.dispatchEvent(new Event('input',{bubbles:true})); inp.focus();
  });
  document.getElementById('btn-dl-date-reports')?.addEventListener('click',()=>{
    const d=document.getElementById('report-date-inp')?.value;
    if(!d){ toast('⚠️ Tarih seçin'); return; }
    const trDate=d.trim();
    const rpts=S.reports.filter(r=>r.date&&r.date.startsWith(trDate));
    if(!rpts.length){ toast('⚠️ Bu tarihte rapor yok'); return; }
    printBulkReports(rpts,`Raporlar-${trDate}`);
  });
  document.getElementById('btn-dl-all-reports')?.addEventListener('click',()=>{
    if(!S.reports.length){ toast('⚠️ Rapor yok'); return; }
    printBulkReports(S.reports,'Tum-Raporlar');
  });
  // Sadece ŞU AN hâlâ uygunsuz olan ekipmanların raporları (giderilmişler hariç)
  document.getElementById('btn-dl-all-fails')?.addEventListener('click',()=>{
    const rpts=currentFailReports();
    if(!rpts.length){ toast('✅ Şu an uygunsuz ekipman yok'); return; }
    printBulkReports(rpts,'Uygunsuz-Raporlar');
  });
  document.getElementById('btn-dl-date-fails')?.addEventListener('click',()=>{
    const d=document.getElementById('report-date-inp')?.value;
    if(!d){ toast('⚠️ Tarih seçin'); return; }
    const trDate=d.trim();
    const rpts=currentFailReports().filter(r=>r.date&&r.date.startsWith(trDate));
    if(!rpts.length){ toast('✅ Bu tarihte hâlâ uygunsuz olan rapor yok'); return; }
    printBulkReports(rpts,`Uygunsuz-${trDate}`);
  });
  // Yeni: Excel + Mail + Toplu QR + Bildirim
  document.getElementById('btn-export-excel')?.addEventListener('click',exportReportsExcel);
  document.getElementById('btn-mail-fails')?.addEventListener('click',mailFailReports);
  document.getElementById('btn-mail-resolved')?.addEventListener('click',mailResolvedReports);
  document.getElementById('btn-new-type')?.addEventListener('click',()=>openNewCatModal());
  document.getElementById('btn-notif')?.addEventListener('click',openNotifications);
  document.getElementById('btn-save-newcat')?.addEventListener('click',saveNewCat);
  // Form tasarımcısı
  document.getElementById('fd-add-field')?.addEventListener('click',fdAddField);
  document.getElementById('fd-save')?.addEventListener('click',fdSaveForm);
  document.getElementById('btn-save-role-perms')?.addEventListener('click',saveRolePerms);
  document.getElementById('btn-save-quota')?.addEventListener('click',saveQuota);
  document.getElementById('btn-save-retention')?.addEventListener('click',saveRetention);
  document.getElementById('btn-save-user')?.addEventListener('click',saveUser);
  document.getElementById('ue-perms-reset')?.addEventListener('click',()=>{ _uePerms=null; renderUePerms(document.getElementById('ue-role').value); toast('↺ Rol varsayılanına dönüldü'); });
  document.getElementById('btn-save-cpw')?.addEventListener('click',saveChangePw);
  document.getElementById('btn-del-user')?.addEventListener('click',deleteUser);
  document.getElementById('btn-retry-conn')?.addEventListener('click',()=>{ document.getElementById('conn-error').style.display='none'; initApp(); });
  document.addEventListener('click',e=>{
    if(e.target.matches('[data-close]')){ const id=e.target.dataset.close; closeModal(id); if(id==='modal-scan') stopCamera(); if(id==='modal-new-cat'){const s=document.getElementById('inp-equip-cat');if(s&&s.value==='__new__'){s.value=BASE_CATS[0].id;onCatChange();}} return; }
    if(e.target.classList.contains('modal-ov')){ closeModal(e.target.id); if(e.target.id==='modal-scan') stopCamera(); if(e.target.id==='modal-new-cat'){const s=document.getElementById('inp-equip-cat');if(s&&s.value==='__new__'){s.value=BASE_CATS[0].id;onCatChange();}} }
  });
}

/* ══════════════════════════════════════
   BAŞLAT
══════════════════════════════════════ */
function start(){
  initTheme();
  populateCatSelects();
  populateMahalSelects();
  loadDefCrit();
  setupListeners();
  initDatePickerControls();

  setupPullToRefresh();
  showLoading(true);
  initApp();
}

/* ── PULL TO REFRESH ── */
function setupPullToRefresh(){
  let startY=0, pulling=false, dist=0;
  const THRESHOLD=70;
  // Gösterge elemanı oluştur
  let ind=document.getElementById('ptr-ind');
  if(!ind){
    ind=document.createElement('div');
    ind.id='ptr-ind'; ind.className='ptr-indicator';
    ind.innerHTML='<span class="ptr-spin"></span><span>Yenileniyor…</span>';
    document.body.appendChild(ind);
  }

  document.addEventListener('touchstart',e=>{
    if(!S.cur) return;
    if(window.scrollY>2) return;            // sadece en üstteyken
    if(document.querySelector('.modal-ov.open')) return; // modal açıkken değil
    startY=e.touches[0].clientY; pulling=true; dist=0;
  },{passive:true});

  document.addEventListener('touchmove',e=>{
    if(!pulling) return;
    dist=e.touches[0].clientY-startY;
    if(dist>0 && dist<140){
      ind.style.transform=`translateX(-50%) translateY(${Math.min(dist-50,10)}px)`;
      ind.style.opacity=Math.min(dist/THRESHOLD,1);
    }
  },{passive:true});

  document.addEventListener('touchend',async()=>{
    if(!pulling) return;
    pulling=false;
    if(dist>=THRESHOLD){
      ind.classList.add('show');
      haptic(15);
      try{
        const d=await fbGet();
        if(d){
          if(d.users) S.users=toArr(d.users);
          if(d.mahals) S.mahals=toArr(d.mahals);
          if(d.equips) S.equips=toArr(d.equips);
          if(d.reports) S.reports=toArr(d.reports);
          if(d.logs) S.logs=toArr(d.logs);
          if(d.activity) S.activity=toArr(d.activity);
          if(d.notifications) S.notifications=toArr(d.notifications);
          if(d.customCats){ S.customCats=toArr(d.customCats); rebuildCats(); }
          if(d.catForms) S.catForms=d.catForms;
          if(d.catOverrides) S.catOverrides=d.catOverrides;
          if(d.rolePerms) S.rolePerms=d.rolePerms;
          if(d.contactInfo) S.contactInfo=d.contactInfo;
          if(d.quotaLimits) S.quotaLimits=d.quotaLimits;
          if(d.catPeriods) S.catPeriods=d.catPeriods;
          if(d.customRoles) S.customRoles=d.customRoles;
          if(d.catMaintenance) S.catMaintenance=d.catMaintenance;
          if(d.retention) S.retention=d.retention;
          renderCurrent();
        }
        toast('🔄 Güncellendi');
      }catch(e){ toast('❌ Yenilenemedi'); }
      setTimeout(()=>{ ind.classList.remove('show'); ind.style.transform=''; ind.style.opacity=''; }, 600);
    } else {
      ind.style.transform=''; ind.style.opacity='';
    }
    dist=0;
  },{passive:true});
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start);
else start();
