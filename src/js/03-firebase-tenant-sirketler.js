/* ══════════════════════════════════════
   FİREBASE
══════════════════════════════════════ */
let _db=null;
let _ref=null;            // AKTİF şirketin veri kökü: takipet/data/{companyId}
let _companiesRef=null;   // Şirket kataloğu: takipet/companies
let _companiesListener=null;
let _storage=null;        // Firebase Storage (belge arşivi)
let _storageReady=false;
let _globalDocs={ folders:[] };  // Genel evraklar (süper admin belge ağacı) — başta tanımlı olmalı
let _globalDocOpen={};           // klasör aç/kapa durumu (yerel, kalıcı değil — varsayılan KAPALI)
let _docTreeOpen={};             // Şirket belge ağacı açık/kapalı durumları — başta tanımlı olmalı
let _docSearch='';               // Belgeler arama sorgusu
let _docSelectMode=false;        // Çoklu seçim modu (belge taşı/sil)
let _docSelected=new Set();      // Seçili belgeler "folderId::docId"
let _gdocSearch='';              // Genel evraklar arama sorgusu
let _listener=null;
let _fbConnected=false;   // Firebase sunucu bağlantısı var mı
let _authReady=false;     // Anonim kimlik alındı mı (güvenlik)
let _pendingWrites=0;     // gönderilmeyi bekleyen yazma sayısı
let _syncing=false;       // şu an senkron oluyor mu

/* ── ÇOK ŞİRKET (MULTI-TENANT) ──
   Veri yapısı:
     takipet/companies/{id}  → şirket kataloğu {name, createdAt, active}
     takipet/data/{id}/...   → o şirketin İZOLE verisi (equips, reports, users...)
   S.companies: şirket listesi (süper admin görür)
   S.activeCompanyId: şu an içinde olunan şirket
   S.cur.companyId: normal kullanıcının ait olduğu şirket */
const TENANT_ROOT='takipet';
function companyDataPath(cid){ return `${TENANT_ROOT}/data/${cid}`; }


async function initFirebase(){
  // SDK yüklenene kadar bekle (max 8 saniye)
  for(let i=0; i<40; i++){
    if(typeof firebase!=='undefined') break;
    await new Promise(r=>setTimeout(r,200));
  }
  if(typeof firebase==='undefined'){
    showConnectionError('Firebase SDK yüklenemedi. İnternet bağlantısını kontrol edin.');
    return false;
  }

  try{
    // App Check
    const app = firebase.initializeApp(FIREBASE_CONFIG, 'takipet');
    try{ firebase.appCheck(app).activate(APP_CHECK_KEY, true); }catch(e){}

    // ── GÜVENLİK: Anonim kimlik doğrulama ──
    // Her cihaz arka planda Firebase kimliği alır. Rules "sadece kimliği doğrulanmış
    // istekler" diyebilir → F12 ile doğrudan DB erişimi + dışarıdan saldırı kapanır.
    try{
      const auth = firebase.auth(app);
      await auth.signInAnonymously();
      _authReady = true;
    }catch(e){
      // Auth başarısızsa (Console'da Anonymous açık değilse) uygulama yine çalışsın
      console.warn('Anonim kimlik alınamadı:', e.message);
    }

    _db  = firebase.database(app);
    _companiesRef = _db.ref(`${TENANT_ROOT}/companies`);
    // _ref (aktif şirket verisi) ŞİRKET SEÇİLİNCE bağlanır — şimdilik null
    _ref = null;

    // Firebase Storage (belge arşivi) — varsa bağla
    try{ _storage = firebase.storage(app); _storageReady = true; }catch(e){ console.warn('Storage başlatılamadı:', e.message); }

    // Çevrimdışı dayanıklılık (şirket kataloğu)
    try{ _companiesRef.keepSynced(true); }catch(e){}

    // Firebase bağlantı durumunu izle (.info/connected — gerçek sunucu bağlantısı)
    try{
      _db.ref('.info/connected').on('value', snap=>{
        _fbConnected = snap.val()===true;
        updateConnStatus();
      });
    }catch(e){}

    // Şirket kataloğunu dinle (süper admin yönetir)
    _companiesListener = _companiesRef.on('value', snap=>{
      const d = snap && snap.exists() ? snap.val() : {};
      S.companies = toArr(d).filter(c=>c && c.id);
      // Süper admin şirket listesi ekranındaysa güncelle
      if(S.cur && S.cur.isSuper && !S.activeCompanyId){ try{ renderCompaniesScreen&&renderCompaniesScreen(); }catch(e){} }
    }, err=>{
      console.error('[Companies]', err.code, err.message);
    });

    S.fbReady = true;
    return true;
  }catch(e){
    console.error('[Firebase init]', e.message);
    showConnectionError('Firebase bağlantı hatası: '+e.message);
    return false;
  }
}

/* ── AKTİF ŞİRKETİN VERİSİNE BAĞLAN ──
   Süper admin bir şirket seçince VEYA normal kullanıcı giriş yapınca çağrılır.
   _ref'i o şirketin köküne kurar, listener'ı bağlar. */
async function bindCompanyData(companyId){
  if(!companyId){ throw new Error('Şirket ID gerekli'); }
  // Önceki şirketin listener'ını kapat
  detachCompanyData();
  S.activeCompanyId = companyId;
  _ref = _db.ref(companyDataPath(companyId));
  try{ _ref.keepSynced(true); }catch(e){}

  // Realtime listener — o şirketin verisi değişince güncelle
  _listener = _ref.on('value', snap=>{
    const d = (snap && snap.exists()) ? snap.val() : {};
    if(typeof d !== 'object' || d===null) return;
    S.users    = d.users    ? toArr(d.users)    : [];
    S.mahals   = d.mahals   ? toArr(d.mahals)   : [];
    S.equips   = d.equips   ? toArr(d.equips)   : [];
    S.reports  = d.reports  ? toArr(d.reports)  : [];
    S.logs     = d.logs     ? toArr(d.logs)     : [];
    S.activity = d.activity ? toArr(d.activity) : [];
    S.notifications = d.notifications ? toArr(d.notifications) : [];
    S.customCats = d.customCats ? toArr(d.customCats) : [];
    S.catForms = d.catForms || {};
    S.catOverrides = d.catOverrides || {};
    S.rolePerms = d.rolePerms || {};
    S.contactInfo = d.contactInfo || {};
    S.quotaLimits = d.quotaLimits || {};
    S.catPeriods = d.catPeriods || {};
    S.customRoles = d.customRoles || {};  // OBJE (id→rol) — toArr KULLANMA, rol id'leri kaybolur
    S.catMaintenance = d.catMaintenance || {};
    S.retention = d.retention || null;
    S.companyFolders = d.companyFolders ? toArr(d.companyFolders) : [];
    S.workOrders = d.workOrders ? toArr(d.workOrders) : [];
    rebuildCats();

    // Aktif oturumu güncelle + güvenlik (silinen/şifresi/yetkisi değişen → çıkış)
    if(S.cur && !S.cur.isSuper){
      const fresh = S.users.find(u=>u.id===S.cur.id);
      if(!fresh){ forceLogout('Hesabınız silindi. Çıkış yapıldı.'); return; }
      if(S.cur.pwHash && fresh.pwHash && S.cur.pwHash!==fresh.pwHash){ forceLogout('Şifreniz değiştirildi. Lütfen tekrar giriş yapın.'); return; }
      const oldPerms=JSON.stringify((S.cur.perms||[]).slice().sort());
      const newPerms=JSON.stringify((fresh.perms||[]).slice().sort());
      if(S.cur.role!==fresh.role || oldPerms!==newPerms){ forceLogout('Yetkileriniz güncellendi. Lütfen tekrar giriş yapın.'); return; }
      S.cur=fresh; setSession(fresh);
    }

    scheduleRender();
    if(S.cur) updateNotifBell();
    hideSyncBar();
  }, err=>{
    console.error('[Firebase data]', err.code, err.message);
    toast('❌ Firebase hatası: '+err.message, 5000);
  });

  // Şirket bazlı günlük otomatik yedek (o gün ilk giren kullanıcı tetikler)
  setTimeout(()=>autoBackupCompanyIfNeeded(companyId), 5000);
  // Çöpteki dosya boyutunu yükle → depolama barı doğru göstersin
  setTimeout(()=>{ loadCompanyTrashBytes().then(()=>{ try{ renderFbUsage(); }catch(e){} }); }, 2500);

  // Bu şirkette süper admin değilse, kullanıcılar şirkete özel. Süper admin için ayrı.
  return true;
}

/* Aktif şirket verisinden kopar (şirket değiştirirken / çıkışta) */
function detachCompanyData(){
  if(_listener && _ref){ try{ _ref.off('value', _listener); }catch(e){} }
  _listener=null;
  S.activeCompanyId=null;
}

/* ── ŞİRKET YÖNETİMİ (süper admin) ── */
const slugify=s=>(s||'').toLowerCase()
  .replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ş/g,'s').replace(/ü/g,'u')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);

/* Yeni şirket oluştur (sıfırdan boş bir sistem) */
async function createCompany(name){
  name=(name||'').trim();
  if(!name){ toast('⚠️ Şirket adı girin'); return null; }
  if(!_companiesRef){ console.error('[Şirket] _companiesRef YOK'); toast('❌ Bağlantı yok'); return null; }
  // Benzersiz id üret
  let base=slugify(name)||('sirket'+Date.now());
  let cid=base, n=1;
  while(S.companies.some(c=>c.id===cid)){ cid=base+'-'+(++n); }
  const company={ id:cid, name, createdAt:nowStr(), createdTs:Date.now(), active:true };
  console.log('[Şirket] yazılıyor:', cid, '→ takipet/companies/'+cid);
  try{
    await _companiesRef.child(cid).set(company);
    console.log('[Şirket] katalog yazıldı ✓');
    // Şirketin boş veri iskeletini kur (admin kullanıcısı dahil + global tür şablonu)
    const adminUser=await makeCompanyAdmin(cid, name);
    await _db.ref(companyDataPath(cid)).set({
      users:[adminUser],
      catOverrides:_globalCats.overrides||{},
      catForms:_globalCats.forms||{},
      customCats:_globalCats.custom||[],
      contactInfo:{}, _createdAt:Date.now()
    });
    console.log('[Şirket] veri iskeleti yazıldı ✓');
    toast('✅ "'+name+'" şirketi oluşturuldu');
    logSuperActivity('company_create', `Şirket oluşturuldu: ${name}`);
    return cid;
  }catch(e){
    console.error('[Şirket] YAZMA HATASI:', e.code, e.message);
    toast('❌ Şirket oluşturulamadı: '+(e.code||e.message),6000);
    return null;
  }
}

/* Yeni şirkete varsayılan admin kullanıcı (giriş için) */
async function makeCompanyAdmin(cid, companyName){
  const ap=await hashPassword('admin123');
  return {
    id:'u_admin_'+cid,
    username:'admin_'+cid,
    fullname:companyName+' Yöneticisi',
    role:'admin',
    companyId:cid,
    pwSalt:ap.salt, pwHash:ap.hash,
    createdAt:nowStr(), mustChangePw:true
  };
}

/* Şirket sil (TÜM verisiyle birlikte — geri alınamaz) */
async function deleteCompany(cid){
  const c=S.companies.find(x=>x.id===cid); if(!c) return;
  if(!await confirmDialog({title:'Şirketi Sil',message:`"${safe(c.name)}" şirketi ve TÜM verisi (ekipmanlar, denetimler, kullanıcılar, belgeler) kalıcı olarak silinecek. Bu işlem GERİ ALINAMAZ.`,danger:true,okText:'Kalıcı Sil'})) return;
  // İkinci onay (yıkıcı işlem)
  const typed=await promptDialog({title:'Emin misiniz?',message:`Onaylamak için şirket adını yazın: ${c.name}`,placeholder:c.name,okText:'Sil'});
  if(typed===null) return;
  if((typed||'').trim()!==c.name){ toast('⚠️ Şirket adı eşleşmedi, silme iptal'); return; }
  try{
    await _db.ref(companyDataPath(cid)).remove();   // tüm veri
    await _companiesRef.child(cid).remove();         // katalogtan
    // Storage'daki belgeler de silinebilir (opsiyonel — şimdilik bırak)
    toast('🗑️ "'+c.name+'" şirketi silindi');
    logSuperActivity('company_delete', `Şirket silindi: ${c.name}`);
  }catch(e){ toast('❌ Silinemedi: '+e.message,5000); }
}

/* Şirket adını düzenle */
async function renameCompany(cid){
  const c=S.companies.find(x=>x.id===cid); if(!c) return;
  const name=await promptDialog({title:'Şirket Adını Düzenle',value:c.name,okText:'Kaydet'});
  if(name===null||!name.trim()) return;
  try{ await _companiesRef.child(cid).child('name').set(name.trim()); toast('✅ Şirket adı güncellendi'); }
  catch(e){ toast('❌ '+e.message); }
}

/* Süper admin bir şirkete GİRER (o şirketin verisine bağlanır) */
async function enterCompany(cid){
  const c=S.companies.find(x=>x.id===cid); if(!c){ toast('❌ Şirket bulunamadı'); return; }
  showLoading(true);
  try{
    await bindCompanyData(cid);
    // Veri gelene kadar kısa bekle
    await new Promise(r=>setTimeout(r,600));
    S.activeCompanyName=c.name;
    if(S.cur?.isSuper){ S.cur.activeCompanyId=cid; setSession(S.cur); }
    showLoading(false);
    document.getElementById('login-screen').style.display='none';
    document.getElementById('companies-screen').style.display='none';
    document.getElementById('app').style.display='block';
    showCompanySidebar();
    applyPerms();
    updateTopbar();
    updateNotifBell();
    showPage('home');
    renderCurrent();
    toast('🏢 '+c.name+' • yönetim');
  }catch(e){ showLoading(false); toast('❌ Şirkete girilemedi: '+e.message,5000); }
}

/* Süper admin şirketten çıkar → şirket listesine döner */
function exitCompany(){
  detachCompanyData();
  S.activeCompanyId=null;
  S.activeCompanyName=null;
  // Session'dan da temizle (F5'te şirketler ekranına dönsün)
  if(S.cur?.isSuper){ delete S.cur.activeCompanyId; setSession(S.cur); }
  hideCompanySidebar();
  // State'i temizle (önceki şirketin verisi görünmesin)
  S.users=[];S.mahals=[];S.equips=[];S.reports=[];S.logs=[];S.activity=[];S.notifications=[];S.customCats=[];
  document.getElementById('app').style.display='none';
  renderCompaniesScreen();
}

/* Süper admin aktivite logu (şirketten bağımsız, global) */
function logSuperActivity(type, desc){
  if(!_companiesRef) return;
  try{
    const log={ type, desc, ts:Date.now(), at:nowStr(), by:S.cur?.username||'super' };
    _db.ref(`${TENANT_ROOT}/superlogs`).push(log);
  }catch(e){}
}

/* ── ŞİRKET PANELİ (süper admin, sol kenar sabit) ── */
function showCompanySidebar(){
  const sb=document.getElementById('company-sidebar');
  // SADECE süper admin görür (şirketler arası geçiş paneli). Normal kullanıcı ASLA görmez.
  if(sb && S.cur?.isSuper && window.innerWidth>=1280){
    sb.style.display='flex';
    document.body.classList.add('has-company-sidebar');
  } else {
    if(sb) sb.style.display='none';
    document.body.classList.remove('has-company-sidebar');
  }
  renderCompanySidebar();
  requestAnimationFrame(positionSidebar);
}
/* Paneli üst bar (mor bant + topbar) ALTINA, alt navbar ÜSTÜNE hizala.
   Topbar tam genişlik kaldığı için panel onun altından başlamalı. */
function positionSidebar(){
  const band=document.getElementById('super-company-band');
  const topbar=document.querySelector('#app .topbar');
  const bandShown = band && band.style.display!=='none';
  const bandH = bandShown ? band.offsetHeight : 0;
  // Topbar'ı bandın ALTINA sabitle: band sticky top:0, topbar sticky top:bandH → çakışma/boşluk YOK.
  // Band yoksa topbar CSS varsayılanına (top:0) döner.
  if(topbar) topbar.style.top = bandH ? bandH+'px' : '';
  // Sidebar hizalama (yalnızca geniş ekranda gösterilir)
  const sb=document.getElementById('company-sidebar');
  if(!sb || sb.style.display==='none') return;
  const nav=document.querySelector('#app .bottom-nav');
  const top = bandH + (topbar?topbar.offsetHeight:0);
  if(top>0) sb.style.top=top+'px';
  sb.style.bottom=(nav?nav.offsetHeight:0)+'px';
}
function hideCompanySidebar(){
  const sb=document.getElementById('company-sidebar');
  if(sb) sb.style.display='none';
  document.body.classList.remove('has-company-sidebar');
}
// Pencere boyutu değişince paneli uyarla (süper admin şirket içindeyse)
window.addEventListener('resize', ()=>{
  if(S.cur?.isSuper && S.activeCompanyId){ showCompanySidebar(); }
});
function renderCompanySidebar(){
  const el=document.getElementById('switcher-list');
  if(!el) return;
  const q=(document.getElementById('switcher-search')?.value||'').toLowerCase().trim();
  let list=S.companies.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','tr'));
  if(q) list=list.filter(c=>(c.name||'').toLowerCase().includes(q));
  if(!list.length){ el.innerHTML='<div style="padding:18px;text-align:center;color:var(--txt3);font-size:13px">Şirket yok</div>'; return; }
  el.innerHTML=list.map(c=>{
    const active=c.id===S.activeCompanyId;
    return `<div class="cs-item ${active?'active':''}" onclick="switchToCompany('${c.id}')">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">🏢</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(c.name)}</div>
        ${active?'<div style="font-size:10px;color:var(--accent);font-weight:600">● Aktif</div>':''}
      </div>
    </div>`;
  }).join('');
}

/* Anında şirket değiştir (kolondan tıklayınca) */
async function switchToCompany(cid){
  if(cid===S.activeCompanyId) return;
  const c=S.companies.find(x=>x.id===cid); if(!c) return;
  showLoading(true);
  try{
    await bindCompanyData(cid);
    await new Promise(r=>setTimeout(r,500));
    S.activeCompanyName=c.name;
    if(S.cur?.isSuper){ S.cur.activeCompanyId=cid; setSession(S.cur); }
    showLoading(false);
    applyPerms();
    updateTopbar();
    updateNotifBell();
    showPage('home');
    renderCurrent();
    renderCompanySidebar();
    toast('🏢 '+c.name);
  }catch(e){ showLoading(false); toast('❌ Geçilemedi: '+e.message,5000); }
}

/* ── ŞİRKETLER EKRANI (süper admin) ── */
let _companyStats={}; // {cid: {bytes, equips, reports, users}}

/* Her şirketin veri boyutunu/sayılarını Firebase'den oku */
let _trashByCid={};        // çöpteki dosyaların şirket başına boyutu (kota barları için)
let _trashGlobalBytes=0;   // genel evraklardan çöpe gidenlerin boyutu
async function loadCompanyStats(){
  if(!_db) return;
  // Çöpteki dosyalar da Storage kotasında yer kaplar — şirket başına topla
  _trashByCid={}; _trashGlobalBytes=0;
  try{
    const tSnap=await _db.ref(`${TENANT_ROOT}/trash`).once('value');
    if(tSnap.exists()) tSnap.forEach(ch=>{
      if(String(ch.key).startsWith('_')) return;
      const v=ch.val()||{};
      const cid=v.cid||'_global';
      _trashByCid[cid]=(_trashByCid[cid]||0)+(v.size||0);
    });
    _trashGlobalBytes=_trashByCid['_global']||0;
  }catch(e){}
  for(const c of S.companies){
    try{
      const snap=await _db.ref(companyDataPath(c.id)).once('value');
      if(snap.exists()){
        const d=snap.val();
        const bytes=new Blob([JSON.stringify(d)]).size;
        // Belge boyutları (storage): ekipman belgeleri + şirket klasörü belgeleri (f.docs)
        let storageBytes=_trashByCid[c.id]||0; // çöpteki dosyalar dahil
        (toArr(d.equips||[])).forEach(e=>{ (e.documents||[]).forEach(doc=>{ storageBytes+=(doc.size||0); }); });
        (toArr(d.companyFolders||[])).forEach(f=>{ (f.docs||[]).forEach(doc=>{ storageBytes+=(doc.size||0); }); });
        // Global karşılaştırma için: uygunsuz rapor sayısı, son 30 gün denetim, açık iş emri
        const reps=toArr(d.reports||[]);
        const cutoff30=Date.now()-30*86400000;
        const failReports=reps.filter(r=>r&&r.result==='fail').length;
        const recent30=reps.filter(r=>{ const t=r&&r.createdAt?Date.parse(r.createdAt):0; return t&&t>=cutoff30; }).length;
        const openWo=(toArr(d.workOrders||[])).filter(w=>w&&w.status!=='approved').length;
        _companyStats[c.id]={
          bytes, storageBytes,
          equips:(toArr(d.equips||[])).length,
          reports:reps.length,
          mahals:(toArr(d.mahals||[])).length,
          users:(toArr(d.users||[])).length,
          failReports, recent30, openWo
        };
      } else {
        _companyStats[c.id]={bytes:0,storageBytes:0,equips:0,reports:0,mahals:0,users:0,failReports:0,recent30:0,openWo:0};
      }
    }catch(e){ _companyStats[c.id]={bytes:0,equips:0,reports:0,mahals:0,users:0,failReports:0,recent30:0,openWo:0}; }
  }
  // Yeniden render et (boyutlar geldi)
  renderCompaniesScreen(true);
}

/* ── GLOBAL DASHBOARD (süper admin): şirket karşılaştırma ── */
function openGlobalDashboard(){
  const body=document.getElementById('gmodal-body');
  document.getElementById('gmodal-title').textContent='📊 Global Özet — Şirket Karşılaştırma';
  const rows=S.companies.map(c=>{
    const s=_companyStats[c.id]||{};
    const failRate=(s.reports||0)?Math.round((s.failReports||0)/s.reports*100):0;
    return { c, s, failRate };
  }).sort((a,b)=>(b.failRate-a.failRate) || ((b.s.openWo||0)-(a.s.openWo||0)));
  const tot=rows.reduce((acc,r)=>({eq:acc.eq+(r.s.equips||0), rep:acc.rep+(r.s.reports||0), fail:acc.fail+(r.s.failReports||0), r30:acc.r30+(r.s.recent30||0), wo:acc.wo+(r.s.openWo||0)}),{eq:0,rep:0,fail:0,r30:0,wo:0});
  const totRate=tot.rep?Math.round(tot.fail/tot.rep*100):0;
  body.innerHTML=`
    <div class="hstat-grid" style="margin-bottom:14px">
      <div class="hstat-card"><div class="hstat-icon">🏢</div><div class="hstat-num">${S.companies.length}</div><div class="hstat-lbl">Şirket</div></div>
      <div class="hstat-card"><div class="hstat-icon">🔧</div><div class="hstat-num">${tot.eq}</div><div class="hstat-lbl">Ekipman</div></div>
      <div class="hstat-card"><div class="hstat-icon">📋</div><div class="hstat-num">${tot.r30}</div><div class="hstat-lbl">Denetim (30g)</div></div>
      <div class="hstat-card ${totRate>10?'fail':'ok'}"><div class="hstat-icon">${totRate>10?'⚠️':'✅'}</div><div class="hstat-num">%${totRate}</div><div class="hstat-lbl">Uygunsuzluk</div></div>
      <div class="hstat-card"><div class="hstat-icon">🗂️</div><div class="hstat-num">${tot.wo}</div><div class="hstat-lbl">Açık İş Emri</div></div>
      <div class="hstat-card"><div class="hstat-icon">📑</div><div class="hstat-num">${tot.rep}</div><div class="hstat-lbl">Toplam Rapor</div></div>
    </div>
    <p class="sec-label" style="margin-bottom:8px">Şirketler (uygunsuzluk oranına göre)</p>
    <div style="display:flex;flex-direction:column;gap:6px;max-height:48vh;overflow-y:auto">
      ${rows.length?rows.map(({c,s,failRate})=>`
        <div style="border:1px solid var(--brd);border-radius:10px;padding:10px 12px;cursor:pointer" onclick="closeModal('gmodal');enterCompany('${c.id}')">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
            <span style="font-size:13px;font-weight:700;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">🏢 ${safe(c.name)}</span>
            <span style="font-size:11px;font-weight:700;color:${failRate>10?'var(--rtxt)':'var(--gtxt)'};white-space:nowrap">%${failRate} uygunsuz</span>
          </div>
          <div style="height:7px;background:var(--bg);border-radius:5px;overflow:hidden;margin-bottom:6px">
            <div style="height:100%;width:${Math.max(failRate,2)}%;background:${failRate>10?'linear-gradient(90deg,#f59e0b,#ef4444)':'linear-gradient(90deg,#22c55e,#16a34a)'}"></div>
          </div>
          <div style="font-size:11px;color:var(--txt3)">${s.equips||0} ekipman · ${s.recent30||0} denetim (30g) · ${s.openWo||0} açık iş emri · ${s.users||0} üye</div>
        </div>`).join(''):'<div style="padding:16px;text-align:center;color:var(--txt3);font-size:12.5px">Şirket yok.</div>'}
    </div>`;
  openModal('gmodal');
}

function renderCompaniesScreen(skipReload){
  const screen=document.getElementById('companies-screen');
  if(!screen) return;
  screen.style.display='block';
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='none';
  const band=document.getElementById('super-company-band'); if(band) band.style.display='none';
  // Şirketler view'ını göster (diğer view'ları gizle)
  const cv=document.getElementById('gview-companies'); if(cv) cv.style.display='block';
  // Genel evraklar ağacını çiz (hata olsa bile şirket listesi render edilsin)
  try{ renderGlobalDocs(); }catch(e){ console.warn('renderGlobalDocs:', e); }

  // İlk render'da veri boyutlarını arka planda yükle
  if(!skipReload && S.companies.length){ setTimeout(()=>loadCompanyStats(),50); }

  const q=(document.getElementById('company-search')?.value||'').toLowerCase().trim();
  let list=S.companies.slice().sort((a,b)=>(b.createdTs||0)-(a.createdTs||0));
  if(q) list=list.filter(c=>(c.name||'').toLowerCase().includes(q));

  // Toplam veri sayacı — şirket içindeki "Veri & Depolama Takibi" kutusunun BİREBİR aynısı
  let totalBytes=0, totalStorageBytes=0, totalEquips=0, totalReports=0;
  S.companies.forEach(c=>{ const s=_companyStats[c.id]; if(s){ totalBytes+=s.bytes||0; totalStorageBytes+=s.storageBytes||0; totalEquips+=s.equips||0; totalReports+=s.reports||0; } });
  // Genel evraklar (global) da Storage kotasına dahil + genel evrak çöpü
  (_globalDocs.folders||[]).forEach(f=>{ (f.docs||[]).forEach(d=>{ totalStorageBytes+=(d.size||0); }); });
  totalStorageBytes+=_trashGlobalBytes;
  const totalEl=document.getElementById('companies-total');
  if(totalEl){
    if(!S.companies.length){ totalEl.innerHTML=''; }
    else {
      const lim=getQuotaLimits();
      const dbLimit=lim.dbGB*1024*1024*1024;
      const stLimit=lim.storageGB*1024*1024*1024;
      const dbPct=Math.min(100,(totalBytes/dbLimit)*100);
      const stPct=Math.min(100,(totalStorageBytes/stLimit)*100);
      const barColor=p=> p>=90?'linear-gradient(90deg,#ef4444,#dc2626)':p>=70?'linear-gradient(90deg,#f59e0b,#ef4444)':'linear-gradient(90deg,#22c55e,#16a34a)';
      const pctTxt=p=> p<0.01?'<0.01':p.toFixed(2);
      totalEl.innerHTML=`<div class="ed-card" style="margin-bottom:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <span style="font-size:13px;font-weight:700;color:var(--txt)">📊 Tüm Şirketler — Toplam Veri & Depolama</span>
          <span style="font-size:11px;color:var(--txt3);font-weight:600">${S.companies.length} şirket · ${totalEquips} ekipman · ${totalReports} rapor</span>
        </div>
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
            <span style="font-weight:600;color:var(--txt2)">🗄️ Veritabanı (canlı veri)</span>
            <span style="font-weight:700;color:${dbPct>=90?'var(--rtxt)':'var(--txt2)'}">%${pctTxt(dbPct)}</span>
          </div>
          <div style="height:10px;background:var(--bg);border-radius:6px;overflow:hidden">
            <div style="height:100%;width:${Math.max(dbPct,0.5)}%;background:${barColor(dbPct)};transition:width .4s"></div>
          </div>
          <div style="font-size:10.5px;color:var(--txt3);margin-top:3px">${fmtBytes(totalBytes)} / ${lim.dbGB} GB</div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
            <span style="font-weight:600;color:var(--txt2)">📁 Depolama (belgeler)</span>
            <span style="font-weight:700;color:${stPct>=90?'var(--rtxt)':'var(--txt2)'}">%${pctTxt(stPct)}</span>
          </div>
          <div style="height:10px;background:var(--bg);border-radius:6px;overflow:hidden">
            <div style="height:100%;width:${Math.max(stPct,0.5)}%;background:${barColor(stPct)};transition:width .4s"></div>
          </div>
          <div style="font-size:10.5px;color:var(--txt3);margin-top:3px">${fmtBytes(totalStorageBytes)} / ${lim.storageGB} GB</div>
        </div>
      </div>`;
    }
  }

  const el=document.getElementById('companies-list');
  if(!el) return;
  if(!S.companies.length){
    el.innerHTML=`<div style="text-align:center;padding:50px 20px;color:var(--txt3)">
      <div style="font-size:44px;margin-bottom:12px">🏢</div>
      <div style="font-size:15px;font-weight:600;color:var(--txt2);margin-bottom:6px">Henüz şirket yok</div>
      <div style="font-size:13px">"+ Yeni Şirket" ile ilk şirketinizi oluşturun.</div>
    </div>`;
    return;
  }
  if(!list.length){ el.innerHTML=`<div style="text-align:center;padding:40px;color:var(--txt3)">"${safe(q)}" ile eşleşen şirket yok</div>`; return; }

  el.innerHTML=list.map(c=>{
    const s=_companyStats[c.id];
    const statLine = s ? `${s.equips} ekipman · ${s.reports} rapor · ${fmtBytes(s.bytes)}` : 'yükleniyor…';
    return `
    <div style="background:var(--bg);border:1px solid var(--brd);border-radius:14px;padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:14px">
      <div onclick="enterCompany('${c.id}')" style="flex:1;min-width:0;cursor:pointer;display:flex;align-items:center;gap:14px">
        <div style="width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">🏢</div>
        <div style="min-width:0">
          <div style="font-size:15.5px;font-weight:700;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(c.name)}</div>
          <div style="font-size:11.5px;color:var(--txt3)">${statLine}</div>
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button class="doc-mini-btn" onclick="enterCompany('${c.id}')" title="Şirkete Gir" style="font-size:18px">➡️</button>
        <button class="doc-mini-btn" onclick="renameCompany('${c.id}')" title="Adı Düzenle">✏️</button>
        <button class="doc-mini-btn" onclick="deleteCompany('${c.id}')" title="Sil">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function promptCreateCompany(){
  const modal=document.getElementById('cc-modal');
  const inp=document.getElementById('cc-name');
  const okBtn=document.getElementById('cc-ok');
  const cancelBtn=document.getElementById('cc-cancel');
  if(!modal){ console.error('cc-modal bulunamadı'); toast('❌ Modal bulunamadı'); return; }
  inp.value='';
  modal.style.display='flex';
  setTimeout(()=>inp.focus(),100);
  const close=()=>{ modal.style.display='none'; okBtn.onclick=null; cancelBtn.onclick=null; inp.onkeydown=null; };
  const submit=async()=>{
    const name=(inp.value||'').trim();
    if(!name){ toast('⚠️ Şirket adı girin'); return; }
    okBtn.disabled=true; okBtn.textContent='Oluşturuluyor…';
    console.log('[Şirket] oluşturuluyor:', name);
    try{
      const cid=await createCompany(name);
      console.log('[Şirket] sonuç cid:', cid);
      okBtn.disabled=false; okBtn.textContent='Oluştur';
      if(cid){ close(); renderCompaniesScreen(); }
    }catch(e){
      console.error('[Şirket] hata:', e);
      okBtn.disabled=false; okBtn.textContent='Oluştur';
      toast('❌ '+(e.message||'Hata'),5000);
    }
  };
  okBtn.onclick=submit;
  cancelBtn.onclick=close;
  inp.onkeydown=(e)=>{ if(e.key==='Enter') submit(); };
}

/* ── GLOBAL NAVBAR (şirketler ekranı, süper admin) ── */
function setGlobalNavActive(which){
  document.querySelectorAll('.global-nav .nav-btn').forEach(b=>{
    b.classList.toggle('active', b.getAttribute('data-gnav')===which);
  });
}

/* ── GLOBAL TÜR YÖNETİCİSİ ──
   Şirket-içi Ekipmanlar ekranının BİREBİR aynısını kullanır (tam ekran).
   Bir şirkete (aktif yoksa ilki) geçer, tür düzenlemeleri orada yapılır,
   sonra "Tüm Şirketlere Uygula" ile global'e yayılır. */
let _globalTypeMode=false;

async function openGlobalTypeManager(){
  if(!S.companies.length){ toast('⚠️ Önce en az bir şirket oluşturun'); return; }
  let cid=S.activeCompanyId;
  if(!cid){
    // Aktif şirket yok → ilk şirkete TAM geçiş yap (companies-screen gizlenir, #app gösterilir).
    cid=S.companies[0].id;
    await enterCompany(cid);
  }
  // Garanti: şirketler ekranı kapalı, ana uygulama açık olsun (Türler boş ekran bug fix).
  document.getElementById('companies-screen').style.display='none';
  document.getElementById('app').style.display='block';
  showCompanySidebar();
  _globalTypeMode=true;
  showPage('equipments');
  setTimeout(()=>{
    allCats().forEach(c=>openCats.add(c.id));
    renderEquipments();
    injectGlobalTypeBanner();
  }, 200);
}

function injectGlobalTypeBanner(){
  const container=document.querySelector('#page-equipments .container');
  if(!container) return;
  let banner=document.getElementById('global-type-banner');
  if(banner) banner.remove();
  banner=document.createElement('div');
  banner.id='global-type-banner';
  banner.style.cssText='background:linear-gradient(135deg,rgba(99,102,241,.12),rgba(139,92,246,.12));border:1px solid rgba(99,102,241,.3);border-radius:12px;padding:13px 15px;margin-bottom:14px';
  banner.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
      <span style="font-size:20px">🌐</span>
      <div style="flex:1">
        <div style="font-size:13.5px;font-weight:700;color:var(--txt)">Global Tür Yönetimi</div>
        <div style="font-size:11.5px;color:var(--txt2);line-height:1.4">Burada yaptığınız tür/form değişiklikleri "Tüm Şirketlere Uygula" ile bütün şirketlere yansır. Geçmiş raporlar korunur.</div>
      </div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary btn-sm" style="flex:1" onclick="applyTypesToAllCompanies()">🌐 Tüm Şirketlere Uygula</button>
      <button class="btn btn-secondary btn-sm" onclick="exitGlobalTypeManager()">← Şirketler</button>
    </div>`;
  container.insertBefore(banner, container.firstChild);
}

async function applyTypesToAllCompanies(){
  if(!await confirmDialog({title:'Tüm Şirketlere Uygula',message:`Bu şirketteki tür ve form ayarları ${S.companies.length} şirkete uygulanacak. Ad/ikon geçmiş raporlara da yansır; form yapısı yeni denetimlere uygulanır (geçmiş korunur). Devam?`,okText:'Uygula'})) return;
  showLoading(true);
  try{
    _globalCats.overrides=JSON.parse(JSON.stringify(S.catOverrides||{}));
    _globalCats.forms=JSON.parse(JSON.stringify(S.catForms||{}));
    _globalCats.custom=JSON.parse(JSON.stringify(S.customCats||[]));
    await saveGlobalCats();
    const n=await applyGlobalCatsToAll();
    showLoading(false);
    toast(`✅ ${n} şirkete uygulandı`);
    logSuperActivity('global_types', `Tür/form ayarları ${n} şirkete uygulandı`);
  }catch(e){ showLoading(false); toast('❌ '+e.message,5000); }
}

function exitGlobalTypeManager(){
  _globalTypeMode=false;
  const banner=document.getElementById('global-type-banner');
  if(banner) banner.remove();
  exitCompany&&exitCompany();
  renderCompaniesScreen();
}

function globalNav(which){
  setGlobalNavActive(which);
  // Tüm view'ları gizle
  ['companies','reports','profile','types'].forEach(v=>{
    const el=document.getElementById('gview-'+v);
    if(el) el.style.display='none';
  });
  if(which==='qr'){
    // QR sadece tarayıcı açar, view değiştirmez — şirketler view'ında kal
    setGlobalNavActive('companies');
    document.getElementById('gview-companies').style.display='block';
    openModal('modal-scan');
    setTimeout(()=>{ startCamera&&startCamera(); }, 350);
    return;
  }
  if(which==='types'){
    // Global tür yönetimi — şirkete GİRMEDEN, ekipman göstermeden (tam ekran, pop-up değil).
    document.getElementById('gview-types').style.display='block';
    loadGlobalCats().then(()=>renderGlobalTypesPanel());
    return;
  }
  const view=document.getElementById('gview-'+which);
  if(view) view.style.display='block';
  if(which==='companies'){ renderCompaniesScreen(); }
  if(which==='reports'){ renderGlobalReports(); }
  if(which==='profile'){ renderGlobalProfile(); }
}

function superAdminLogout(){
  S.cur=null; clearSession(); stopSessionTimer();
  detachCompanyData();
  document.getElementById('companies-screen').style.display='none';
  document.getElementById('app').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  const u=document.getElementById('login-user'); if(u) u.value='';
  const p=document.getElementById('login-pass'); if(p) p.value='';
}

/* ── GLOBAL: Üye Ekle (şirket seçimli) + Loglar + İletişim ── */
