/* ── GLOBAL PROFİL (tam ekran view) ── */
function renderGlobalProfile(){
  const body=document.getElementById('gprofile-body');
  if(!body) return;
  const tel=(S.contactInfo&&S.contactInfo.tel)||'';
  const mail=(S.contactInfo&&S.contactInfo.mail)||'';
  body.innerHTML=`
    <p class="sec-label" style="margin-bottom:8px">Üye Yönetimi</p>
    <div class="ed-card" style="margin-bottom:14px">
      <button class="btn btn-primary btn-full" onclick="openAddUserGlobal()">➕ Üye Ekle (şirket seçerek)</button>
    </div>
    <p class="sec-label" style="margin-bottom:8px">📞 Global İletişim Bilgileri</p>
    <div class="ed-card" style="margin-bottom:14px">
      <p style="font-size:12px;color:var(--txt2);margin-bottom:10px;line-height:1.5">Bu bilgiler TÜM giriş ekranlarında ve QR okutan misafirlere görünür.</p>
      <div class="form-group"><label class="form-label">TELEFON</label><input class="form-input" id="ci-tel" placeholder="0532..." value="${safe(tel)}"/></div>
      <div class="form-group"><label class="form-label">E-POSTA</label><input class="form-input" id="ci-mail" type="email" placeholder="ornek@firma.com" value="${safe(mail)}"/></div>
      <button class="btn btn-primary btn-sm" onclick="saveContactInfo()">💾 Kaydet</button>
    </div>
    <p class="sec-label" style="margin-bottom:8px">Sistem</p>
    <div class="ed-card">
      <button class="btn btn-secondary btn-full" onclick="openSuperLogs()" style="margin-bottom:8px">📋 Tüm Şirket Logları</button>
      <button class="btn btn-secondary btn-full" onclick="globalNav('companies')">🏢 Şirketlere Dön</button>
    </div>`;
}

/* Üye ekle — önce şirket seç, sonra o şirkete kullanıcı ekle */
async function openAddUserGlobal(){
  if(!S.companies.length){ toast('⚠️ Önce şirket oluşturun'); return; }
  const cid=await pickCompanyDialog('Üye hangi şirkete eklenecek?');
  if(!cid) return;
  const c=S.companies.find(x=>x.id===cid);
  await switchToCompany(cid);
  await new Promise(r=>setTimeout(r,400));
  toast('🏢 '+c.name+' — üye ekleyebilirsiniz');
  showPage('profile');
  setTimeout(()=>{ if(typeof openAddUser==='function') openAddUser(); }, 400);
}

/* Şirket seçme dialogu → cid döner */
function pickCompanyDialog(title){
  return new Promise(resolve=>{
    const body=document.getElementById('gmodal-body');
    const t=document.getElementById('gmodal-title');
    t.textContent=title||'Şirket Seç';
    const list=S.companies.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','tr'));
    body.innerHTML=`<div style="display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow-y:auto">
      ${list.map(c=>`<button class="btn btn-secondary btn-full" style="justify-content:flex-start" onclick="window._pickCompany('${c.id}')">🏢 ${safe(c.name)}</button>`).join('')}
    </div>`;
    window._pickCompany=(cid)=>{ closeModal('gmodal'); delete window._pickCompany; resolve(cid); };
    openModal('gmodal');
  });
}

/* ── GLOBAL RAPORLAR (tam ekran view) ── */
async function renderGlobalReports(){
  const body=document.getElementById('greports-list');
  if(!body) return;
  body.innerHTML='<div style="text-align:center;padding:30px;color:var(--txt3)">Yükleniyor…</div>';
  let all=[];
  for(const c of S.companies){
    try{
      const snap=await _db.ref(`${companyDataPath(c.id)}/reports`).once('value');
      if(snap.exists()){ toArr(snap.val()).forEach(r=>{ if(r) all.push({...r, _company:c.name, _cid:c.id}); }); }
    }catch(e){}
  }
  all.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
  if(!all.length){ body.innerHTML='<div style="text-align:center;padding:30px;color:var(--txt3)">Henüz rapor yok</div>'; return; }
  body.innerHTML=all.slice(0,150).map(r=>{
    const resColor=r.result==='pass'?'var(--gtxt)':r.result==='fail'?'var(--rtxt)':'var(--txt3)';
    const resTxt=r.result==='pass'?'✅ Uygun':r.result==='fail'?'❌ Uygun Değil':'⏳ Yarım';
    return `<div onclick="goToCompanyReport('${r._cid}','${r.id}')" style="padding:12px 14px;background:var(--bg);border:1px solid var(--brd);border-radius:10px;margin-bottom:8px;cursor:pointer">
      <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:2px">
        <span style="font-size:13.5px;font-weight:600;color:var(--txt)">${safe(r.equipName||'—')}</span>
        <span style="font-size:12px;font-weight:700;color:${resColor}">${resTxt}</span>
      </div>
      <div style="font-size:11.5px;color:var(--txt3)">🏢 ${safe(r._company)} · ${safe(r.mahalName||'')} · ${safe(r.date||'')}</div>
    </div>`;
  }).join('');
}

async function goToCompanyReport(cid, reportId){
  await switchToCompany(cid);
  await new Promise(r=>setTimeout(r,400));
  setTimeout(()=>{ if(typeof openReportDetail==='function') openReportDetail(reportId); }, 300);
}

/* ── GLOBAL: Default ekipman türleri (tüm şirketleri etkiler) ── */
let _globalCats={ overrides:{}, forms:{}, custom:[], periods:{} };

async function loadGlobalCats(){
  if(!_db) return;
  try{
    const snap=await _db.ref(`${TENANT_ROOT}/globalCats`).once('value');
    if(snap.exists()){
      const d=snap.val();
      _globalCats={ overrides:d.overrides||{}, forms:d.forms||{}, custom:toArr(d.custom||[]), periods:d.periods||{} };
    }
  }catch(e){ console.warn('globalCats yüklenemedi:', e.message); }
}

async function saveGlobalCats(){
  if(!_db) return;
  await _db.ref(`${TENANT_ROOT}/globalCats`).set({
    overrides:_globalCats.overrides||{}, forms:_globalCats.forms||{},
    custom:_globalCats.custom||[], periods:_globalCats.periods||{}, updatedAt:Date.now()
  });
}

/* Global tür değişikliğini TÜM şirketlere uygula (ad/ikon geçmiş raporlara da, form yapısı yeni denetimlere) */
async function applyGlobalCatsToAll(){
  let count=0;
  const globalCustom=_globalCats.custom||[];
  const globalCustomIds=new Set(globalCustom.map(c=>c.id));
  for(const c of S.companies){
    try{
      const ref=_db.ref(companyDataPath(c.id));
      const snap=await ref.once('value');
      if(!snap.exists()) continue;
      const d=snap.val();
      const updates={};
      updates['catOverrides']=_globalCats.overrides||{};
      // Form yapısı: global formları şirkete uygula (yeni denetimler kullanır, geçmiş raporlar kendi form kopyasını korur → veri kaybı yok)
      const mergedForms={...(d.catForms||{}), ...(_globalCats.forms||{})};
      updates['catForms']=mergedForms;
      // Tür varsayılan periyotları: global olanları şirkete uygula (şirketin diğer periyotları korunur)
      updates['catPeriods']={...(d.catPeriods||{}), ...(_globalCats.periods||{})};
      // Özel türler: ŞİRKETİN kendi özel türlerini KORU, global türleri ekle/güncelle (veri kaybı yok)
      const companyCustom=toArr(d.customCats||[]);
      // Şirketin global olmayan kendi türleri (korunur)
      const companyOwn=companyCustom.filter(ct=>ct && !globalCustomIds.has(ct.id) && !String(ct.id).startsWith('gcat'));
      // Global türler + şirketin kendi türleri
      const mergedCustom=[...globalCustom, ...companyOwn];
      updates['customCats']=mergedCustom;
      // Ad/ikon değişikliğini geçmiş raporlara da yansıt (sadece etiket, form yapısı değil)
      const reports=toArr(d.reports||[]); let changed=false;
      reports.forEach(r=>{
        if(!r||!r.catId) return;
        const ov=_globalCats.overrides[r.catId];
        if(ov){
          if(ov.name && r.catName!==ov.name){ r.catName=ov.name; changed=true; }
          if(ov.icon && r.catIcon!==ov.icon){ r.catIcon=ov.icon; changed=true; }
        }
      });
      if(changed) updates['reports']=reports;
      await ref.update(updates);
      count++;
    }catch(e){ console.warn('Şirket güncellenemedi:', c.id, e.message); }
  }
  return count;
}

/* ── GLOBAL TÜR PANELİ (Türler sekmesi) ──
   Şirkete GİRMEDEN, ekipman/şirket verisi göstermeden tür yönetimi.
   Görünüm: şirket-içi Ekipmanlar ekranıyla aynı (cat-section). Değişiklik OTOMATİK tüm şirketlere uygulanır. */
function renderGlobalTypesPanel(){
  const el=document.getElementById('global-cat-list');
  if(!el) return;
  // Temel türler (global override uygulanmış) + global özel türler — ŞİRKET VERİSİ YOK
  const baseCats=BASE_CATS.map(c=>{
    const ov=_globalCats.overrides&&_globalCats.overrides[c.id];
    return {id:c.id, name:(ov&&ov.name)||c.name, icon:(ov&&ov.icon)||c.icon, base:true};
  });
  const customCats=(_globalCats.custom||[]).map(c=>({id:c.id, name:c.name, icon:c.icon||'📦', base:false}));
  const cats=[...baseCats, ...customCats];
  el.innerHTML=cats.map(c=>{
    const hasForm=_globalCats.forms&&_globalCats.forms[c.id];
    return `<div class="cat-section">
      <div class="cat-section-title" style="cursor:default">
        <span class="cat-sec-icon">${c.icon||'📦'}</span>
        <span class="cat-sec-name">${safe(c.name)}${c.base?'<span style="font-size:11px;color:var(--txt3);font-weight:500"> · varsayılan</span>':''}</span>
        <span class="cat-mng" style="margin-left:auto">
          <button class="cat-mng-btn" onclick="editGlobalType('${c.id}')" title="Ad/ikon düzenle">✏️</button>
          <button class="cat-mng-btn" onclick="editGlobalTypeForm('${c.id}')" title="Denetim formunu düzenle">🛠️${hasForm?'<span style="color:var(--green)">•</span>':''}</button>
          ${!c.base?`<button class="cat-mng-btn" onclick="deleteGlobalType('${c.id}')" title="Türü sil">🗑️</button>`:''}
        </span>
      </div>
    </div>`;
  }).join('');
}

/* Değişikliği global'e kaydet + TÜM şirketlere otomatik uygula + paneli yenile */
async function saveGlobalCatsAndApply(msg){
  showLoading(true);
  try{
    await saveGlobalCats();
    const n=await applyGlobalCatsToAll();
    showLoading(false);
    toast(`✅ ${msg} — ${n} şirkete uygulandı`);
    logSuperActivity('global_types', `${msg} (${n} şirket)`);
    renderGlobalTypesPanel();
  }catch(e){ showLoading(false); toast('❌ '+e.message,5000); }
}

/* Yeni global tür — güzel modal (ikon seçici + şablon + periyot) */
function addGlobalType(){ openNewCatModal('global-add'); }

/* Global tür ad/ikon/periyot düzenle — güzel modal */
function editGlobalType(catId){ openNewCatModal('global-edit', catId); }

/* Global özel tür sil (temel türler silinemez) */
async function deleteGlobalType(catId){
  const c=(_globalCats.custom||[]).find(x=>x.id===catId);
  if(!c) return;
  if(!await confirmDialog({title:'Türü Sil',message:`"${safe(c.name)}" türü silinecek ve tüm şirketlerden kalkacak. (O türdeki mevcut ekipman/raporlar şirkette korunur.) Devam?`,danger:true,okText:'Sil'})) return;
  _globalCats.custom=(_globalCats.custom||[]).filter(x=>x.id!==catId);
  if(_globalCats.forms) delete _globalCats.forms[catId];
  await saveGlobalCatsAndApply('Tür silindi');
}

/* Global tür denetim formunu düzenle — form tasarımcısını GLOBAL modda açar */
function editGlobalTypeForm(catId){
  const baseC=BASE_CATS.find(c=>c.id===catId);
  const customC=(_globalCats.custom||[]).find(c=>c.id===catId);
  const ov=(_globalCats.overrides&&_globalCats.overrides[catId])||{};
  const nm=ov.name||(customC&&customC.name)||(baseC&&baseC.name)||catId;
  _fdForm=(_globalCats.forms&&_globalCats.forms[catId]) ? JSON.parse(JSON.stringify(_globalCats.forms[catId])) : defaultFormFor(catId);
  _fdCatId=catId; _fdCatName=nm; _fdSaveTarget='global'; _fdOpen=-1;
  document.getElementById('fd-title').textContent='🛠️ '+nm;
  document.getElementById('fd-subtitle').textContent='Global form — kaydedince tüm şirketlere uygulanır (geçmiş raporlar korunur).';
  // Periyot/bakım kutuları şirket-içi kavramlar → global modda gizle
  const pBox=document.getElementById('fd-period-box'); if(pBox) pBox.style.display='none';
  const mBox=document.getElementById('fd-maint-box'); if(mBox) mBox.style.display='none';
  renderFdFields();
  openModal('modal-form-designer');
}

function openGlobalTypes(){
  const body=document.getElementById('gmodal-body');
  document.getElementById('gmodal-title').textContent='🔧 Varsayılan Ekipman Türleri';
  // Global override uygulanmış tür listesi
  const cats=BASE_CATS.map(c=>{
    const ov=_globalCats.overrides&&_globalCats.overrides[c.id];
    return ov?{...c, name:ov.name||c.name, icon:ov.icon||c.icon}:c;
  });
  const customs=_globalCats.custom||[];
  body.innerHTML=`
    <p style="font-size:12.5px;color:var(--txt2);line-height:1.5;margin-bottom:14px">
      Bu türler <b>tüm şirketlerde ortak</b>. Buradan yaptığınız değişiklik tüm şirketlere uygulanır.
      Ad/ikon değişikliği geçmiş raporlara da yansır; form yapısı değişikliği yalnızca yeni denetimleri etkiler (geçmiş kayıtlar korunur).
    </p>
    <p class="sec-label" style="margin-bottom:8px">Temel Türler</p>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
      ${cats.map(c=>`
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg);border:1px solid var(--brd);border-radius:10px">
          <span style="font-size:20px">${c.icon}</span>
          <span style="flex:1;font-size:13.5px;font-weight:600;color:var(--txt)">${safe(c.name)}</span>
          <button class="doc-mini-btn" onclick="editGlobalCat('${c.id}')" title="Ad/İkon Düzenle">✏️</button>
          <button class="doc-mini-btn" onclick="editGlobalCatForm('${c.id}')" title="Denetim Formu">📋</button>
        </div>`).join('')}
    </div>
    ${customs.length?`<p class="sec-label" style="margin-bottom:8px">Özel Türler</p>
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">
      ${customs.map(c=>`
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg);border:1px solid var(--brd);border-radius:10px">
          <span style="font-size:20px">${c.icon||'📦'}</span>
          <span style="flex:1;font-size:13.5px;font-weight:600;color:var(--txt)">${safe(c.name)}</span>
          <button class="doc-mini-btn" onclick="editGlobalCat('${c.id}')" title="Düzenle">✏️</button>
          <button class="doc-mini-btn" onclick="editGlobalCatForm('${c.id}')" title="Form">📋</button>
          <button class="doc-mini-btn" onclick="deleteGlobalCustomCat('${c.id}')" title="Sil">🗑️</button>
        </div>`).join('')}
    </div>`:''}
    <button class="btn btn-secondary btn-full btn-sm" style="margin-bottom:12px" onclick="addGlobalCustomCat()">➕ Yeni Tür Ekle</button>
    <div style="background:var(--obg);border-radius:10px;padding:12px;margin-top:6px">
      <p style="font-size:12px;color:var(--txt2);margin-bottom:8px">Değişiklikleri (yeni tür, ad/ikon, form) tüm şirketlere uygulamak için:</p>
      <button class="btn btn-primary btn-full" onclick="pushGlobalCatsToAll()">🌐 Tüm Şirketlere Uygula</button>
    </div>`;
  openModal('gmodal');
}

/* Global yeni özel tür ekle */
async function addGlobalCustomCat(){
  const name=await promptDialog({title:'Yeni Ekipman Türü',message:'Tür adı:',placeholder:'örn: Asansör',okText:'İleri'});
  if(name===null||!name.trim()) return;
  const icon=await promptDialog({title:'İkon',message:'Emoji ikon (örn: 🛗):',value:'📦',okText:'Oluştur'});
  if(icon===null) return;
  if(!_globalCats.custom) _globalCats.custom=[];
  // Benzersiz id
  const id='gcat'+Date.now();
  _globalCats.custom.push({ id, name:name.trim(), icon:(icon.trim()||'📦') });
  try{
    await saveGlobalCats();
    toast('✅ Tür eklendi — "Tüm Şirketlere Uygula" ile yayınlayın');
    openGlobalTypes();
  }catch(e){ toast('❌ '+e.message,5000); }
}

/* Global özel tür sil */
async function deleteGlobalCustomCat(catId){
  const c=(_globalCats.custom||[]).find(x=>x.id===catId);
  if(!c) return;
  if(!await confirmDialog({title:'Türü Sil',message:`"${safe(c.name)}" global türü silinecek. "Tüm Şirketlere Uygula" dediğinizde şirketlerden de kalkar (mevcut o türdeki ekipmanlar/raporlar şirkette kalır). Devam?`,danger:true,okText:'Sil'})) return;
  _globalCats.custom=_globalCats.custom.filter(x=>x.id!==catId);
  if(_globalCats.forms) delete _globalCats.forms[catId];
  try{
    await saveGlobalCats();
    toast('🗑️ Tür silindi — "Tüm Şirketlere Uygula" ile yayınlayın');
    openGlobalTypes();
  }catch(e){ toast('❌ '+e.message,5000); }
}

/* Tür ad/ikon düzenle (global) */
async function editGlobalCat(catId){
  const base=BASE_CATS.find(c=>c.id===catId)||(_globalCats.custom||[]).find(c=>c.id===catId);
  const ov=_globalCats.overrides[catId]||{};
  const curName=ov.name||base?.name||'';
  const curIcon=ov.icon||base?.icon||'📦';
  const name=await promptDialog({title:'Tür Adı',message:'Ekipman türü adı:',value:curName,okText:'İleri'});
  if(name===null) return;
  const icon=await promptDialog({title:'İkon',message:'Emoji ikon (örn: 🧯):',value:curIcon,okText:'Kaydet'});
  if(icon===null) return;
  if(!_globalCats.overrides) _globalCats.overrides={};
  _globalCats.overrides[catId]={name:name.trim()||curName, icon:icon.trim()||curIcon};
  try{ await saveGlobalCats(); toast('✅ Kaydedildi — "Tüm Şirketlere Uygula" ile yayınlayın'); openGlobalTypes(); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* ── GLOBAL FORM EDİTÖRÜ (süper admin, şirketler ana ekranı) ── */
function openGlobalFormEditor(){
  // Şirket-içi Ekipmanlar ekranının birebir aynısı (tam ekran, pop-up değil)
  openGlobalTypeManager();
}

/* Tür formu düzenle (global) — şablon şirketten forma git */
function editGlobalCatForm(catId){
  const body=document.getElementById('gmodal-body');
  document.getElementById('gmodal-title').textContent='📋 Global Form Düzenleme';
  const cat=BASE_CATS.find(c=>c.id===catId)||(_globalCats.custom||[]).find(c=>c.id===catId)||{name:catId};
  const hasGlobalForm=_globalCats.forms && _globalCats.forms[catId];
  body.innerHTML=`
    <p style="font-size:12.5px;color:var(--txt2);line-height:1.5;margin-bottom:14px">
      <b>${safe(cat.name)}</b> türünün denetim formunu tüm şirketler için merkezi olarak yönetin.
    </p>
    <div style="background:var(--obg);border-radius:10px;padding:12px;margin-bottom:12px">
      <p style="font-size:12px;color:var(--txt2);line-height:1.6">
        <b>Nasıl çalışır:</b><br>
        1. Bir şirkete girip <b>Ekipmanlar → ${safe(cat.name)} → Form Düzenle</b> ile formu istediğiniz gibi hazırlayın<br>
        2. Buraya dönüp <b>"Bu Formu Global Yap"</b> deyin<br>
        3. <b>"Tüm Şirketlere Uygula"</b> ile yayınlayın<br><br>
        <span style="color:var(--txt3)">Form yapısı değişikliği yalnızca yeni denetimleri etkiler; geçmiş raporlar korunur (veri kaybı yok).</span>
      </p>
    </div>
    ${hasGlobalForm?`<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--gbg);border-radius:8px;margin-bottom:12px">
      <span style="font-size:13px;color:var(--gtxt);font-weight:600">✓ Bu tür için global form tanımlı</span>
    </div>`:`<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg);border:1px solid var(--brd);border-radius:8px;margin-bottom:12px">
      <span style="font-size:13px;color:var(--txt3)">Henüz global form tanımlı değil</span>
    </div>`}
    <button class="btn btn-secondary btn-full" style="margin-bottom:8px" onclick="captureGlobalFormFromActive('${catId}')">📥 Aktif Şirketin Bu Formunu Global Yap</button>
    <button class="btn btn-secondary btn-full" onclick="openGlobalTypes()">← Geri</button>`;
  openModal('gmodal');
}

/* Aktif şirkette bu türün formunu global şablona al */
async function captureGlobalFormFromActive(catId){
  // Süper admin bir şirkete girmiş olmalı ki o şirketin formu okunabilsin
  if(!S.activeCompanyId){
    toast('⚠️ Önce bir şirkete girip formu hazırlayın, sonra buraya dönün');
    return;
  }
  const form=S.catForms && S.catForms[catId];
  if(!form){
    toast('⚠️ Bu şirkette bu tür için özel form yok. Önce formu düzenleyin.');
    return;
  }
  if(!_globalCats.forms) _globalCats.forms={};
  _globalCats.forms[catId]=JSON.parse(JSON.stringify(form));
  try{
    await saveGlobalCats();
    toast('✅ Form global şablona alındı — "Tüm Şirketlere Uygula" ile yayınlayın');
    editGlobalCatForm(catId);
  }catch(e){ toast('❌ '+e.message,5000); }
}

/* Global türleri tüm şirketlere uygula */
async function pushGlobalCatsToAll(){
  if(!S.companies.length){ toast('⚠️ Şirket yok'); return; }
  if(!await confirmDialog({title:'Tüm Şirketlere Uygula',message:`Tür ve form ayarları ${S.companies.length} şirkete uygulanacak. Ad/ikon değişiklikleri geçmiş raporlara da yansır; form yapısı yeni denetimlere uygulanır (geçmiş korunur). Devam edilsin mi?`,okText:'Uygula'})) return;
  showLoading(true);
  try{
    const n=await applyGlobalCatsToAll();
    showLoading(false);
    toast(`✅ ${n} şirkete uygulandı`);
    logSuperActivity('global_cats', `Tür/form ayarları ${n} şirkete uygulandı`);
    closeModal('gmodal');
  }catch(e){ showLoading(false); toast('❌ '+e.message,5000); }
}

async function openSuperLogs(){
  if(!_db){ toast('❌ Bağlantı yok'); return; }
  showLoading(true);
  let logs=[];
  try{
    const snap=await _db.ref(`${TENANT_ROOT}/superlogs`).limitToLast(100).once('value');
    if(snap.exists()){ logs=Object.values(snap.val()).sort((a,b)=>(b.ts||0)-(a.ts||0)); }
  }catch(e){ showLoading(false); toast('❌ Loglar alınamadı: '+e.message,5000); return; }
  showLoading(false);
  const rows = logs.length ? logs.map(l=>`
    <div style="padding:10px 12px;border-bottom:1px solid var(--brd)">
      <div style="font-size:13px;color:var(--txt);font-weight:600">${safe(l.desc||l.type||'—')}</div>
      <div style="font-size:11px;color:var(--txt3)">${safe(l.at||'')} · ${safe(l.by||'')}</div>
    </div>`).join('') : '<div style="padding:24px;text-align:center;color:var(--txt3)">Henüz log yok</div>';
  const body=document.getElementById('super-logs-body');
  if(body) body.innerHTML=rows;
  openModal('modal-super-logs');
}



function showConnectionError(msg){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='none';
  document.getElementById('conn-error').style.display='flex';
  document.getElementById('conn-error-msg').textContent=msg;
}

function hideSyncBar(){
  // Artık sync bar yok — sessizce çalışır
}

// Firebase'e yaz
async function fbSet(data){
  if(!_ref || !S.fbReady) throw new Error('Firebase bağlı değil');
  await _ref.set(data);
}

// Firebase'den bir kez oku
async function fbGet(){
  if(!_ref) throw new Error('Firebase bağlı değil');
  const snap = await _ref.get();
  return snap.exists() ? snap.val() : null;
}

// Tüm veriyi Firebase'e kaydet (offline-aware + bekleyen sayaç)
async function save(){
  const payload={
    users:    S.users,
    mahals:   S.mahals,
    equips:   S.equips,
    reports:  S.reports,
    logs:     S.logs,
    activity: S.activity,
    notifications: S.notifications,
    customCats: S.customCats,
    catForms: S.catForms,
    catOverrides: S.catOverrides,
    rolePerms: S.rolePerms,
    contactInfo: S.contactInfo,
    quotaLimits: S.quotaLimits,
    catPeriods: S.catPeriods,
    customRoles: S.customRoles,
    catMaintenance: S.catMaintenance,
    retention: S.retention,
    companyFolders: S.companyFolders,
    workOrders: S.workOrders,
  };
  // undefined alanları temizle (Firebase undefined kabul etmez)
  Object.keys(payload).forEach(k=>{ if(payload[k]===undefined||payload[k]===null) delete payload[k]; });
  if(!_ref){ toast('❌ Bağlantı yok'); throw new Error('no ref'); }

  // Çevrimdışıysa: Firebase kuyruğa alır, biz "bekliyor" gösteririz, hata vermeyiz
  if(!_fbConnected){
    _pendingWrites++;
    updateConnStatus();
    // set'i await ETME — offline'da promise bağlanana kadar beklemez/çözülmez.
    // Firebase persistence diske yazar, bağlanınca otomatik gönderir.
    _ref.set(payload).then(()=>{
      _pendingWrites=Math.max(0,_pendingWrites-1);
      updateConnStatus();
    }).catch(()=>{
      _pendingWrites=Math.max(0,_pendingWrites-1);
      updateConnStatus();
    });
    return true; // offline'da başarılı say (veri diske alındı)
  }

  // Çevrimiçi: normal yaz, sonucu bekle
  _syncing=true; updateConnStatus();
  try{
    await _ref.set(payload);
    _syncing=false; updateConnStatus();
    return true;
  }catch(e){
    _syncing=false;
    // Bağlantı yazma sırasında koptuysa offline gibi davran (veri kuyruğa girdi)
    if(!_fbConnected){ _pendingWrites++; updateConnStatus(); return true; }
    updateConnStatus();
    toast('❌ Kayıt hatası: '+e.message, 5000);
    throw e;
  }
}

