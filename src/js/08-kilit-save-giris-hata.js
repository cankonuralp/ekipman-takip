/* ── EŞZAMANLI DENETİM KİLİDİ ──
   Aynı ekipmanı iki kişinin aynı anda denetlemesini önlemek için
   Firebase'de hafif "kim denetliyor" işareti tutulur (5 dk geçerli). */
let _activeInspEquip=null;
async function checkActiveInspection(equipId){
  if(!_ref || !_fbConnected) return null;
  try{
    const snap=await _ref.child('activeInspections/'+equipId).get();
    if(!snap.exists()) return null;
    const a=snap.val();
    if(!a || a.userId===S.cur?.id) return null;
    const elapsed=Date.now()-(a.ts||0);
    if(elapsed > 5*60*1000) return null; // 5 dk = terk edilmiş, yok say
    const mins=Math.floor(elapsed/60000);
    a.ago = mins<1?'az önce':`${mins} dk önce başladı`;
    return a;
  }catch(e){ return null; }
}
function registerActiveInspection(equipId){
  if(!_ref || !_fbConnected) return;
  _activeInspEquip=equipId;
  try{
    _ref.child('activeInspections/'+equipId).set({
      userId:S.cur?.id||null, by:S.cur?.fullname||S.cur?.username||'—', ts:Date.now()
    });
    _ref.child('activeInspections/'+equipId).onDisconnect().remove();
  }catch(e){}
}
function clearActiveInspection(){
  if(!_ref || !_activeInspEquip) return;
  try{ _ref.child('activeInspections/'+_activeInspEquip).remove(); }catch(e){}
  _activeInspEquip=null;
}

/* Tek bir raporu güvenli kaydet (çakışma önleme):
   Firebase'den taze reports'u çek → kendi raporunu ekle/güncelle → yaz.
   Böylece başka cihazın aynı anda eklediği BAŞKA raporlar ezilmez. */
async function saveReportSafe(rpt){
  if(!_ref){ toast('❌ Bağlantı yok'); throw new Error('no ref'); }
  // Çevrimiçi ve bağlıysa: önce taze raporları çek, birleştir
  if(_fbConnected){
    try{
      const snap=await _ref.child('reports').get();
      let fresh = snap.exists()? snap.val() : [];
      // Firebase array'i bazen obje döner — normalize et
      if(fresh && !Array.isArray(fresh)) fresh=Object.values(fresh);
      if(!Array.isArray(fresh)) fresh=[];
      // Kendi raporumu bul/güncelle
      const idx=fresh.findIndex(r=>r && r.id===rpt.id);
      if(idx>=0) fresh[idx]=rpt; else fresh.unshift(rpt);
      // Yerel state'i de taze veriyle hizala (başka cihazların raporları gelsin)
      S.reports=fresh;
      // Sadece reports dalını yaz (diğer dalları ezme)
      await _ref.child('reports').set(fresh);
      return true;
    }catch(e){
      // Taze çekme başarısızsa normal save'e düş
      console.warn('saveReportSafe merge hatası, tam kayda düşülüyor:', e.message);
    }
  }
  // Offline veya hata: normal tam kayıt (Firebase kuyruğa alır)
  return save();
}

/* Bildirimi çakışmaya karşı GÜVENLİ ekle — sadece 'notifications' dalını çek+birleştir+yaz.
   Böylece saveReportSafe/save() sırasındaki tüm-node dinleyicisi yeni bildirimi EZMEZ.
   (notifyManagers ile aynı sonuç: eklenen bildirim kaybolmadan Firebase'e yazılır.) */
async function saveNotifSafe(notif){
  if(!_ref || !notif) return;
  if(_fbConnected){
    try{
      const snap=await _ref.child('notifications').get();
      let fresh=snap.exists()?snap.val():[];
      if(fresh && !Array.isArray(fresh)) fresh=Object.values(fresh);
      if(!Array.isArray(fresh)) fresh=[];
      fresh.unshift(notif);
      if(fresh.length>100) fresh=fresh.slice(0,100);
      S.notifications=fresh;                       // yerel state'i taze veriyle hizala
      await _ref.child('notifications').set(fresh);
      return true;
    }catch(e){ console.warn('saveNotifSafe merge hatası:', e.message); }
  }
  // Offline/hata: normal ekle + tam kayıt (Firebase kuyruğa alır)
  S.notifications.unshift(notif);
  if(S.notifications.length>100) S.notifications=S.notifications.slice(0,100);
  return save();
}

/* Bağlantı/senkron durumunu üst şeride yansıt */
function updateConnStatus(){
  const el=document.getElementById('conn-status');
  if(!el) return;
  let txt, cls;
  if(!_fbConnected){
    txt = _pendingWrites>0 ? `📡 Çevrimdışı — ${_pendingWrites} kayıt bekliyor` : '📡 Çevrimdışı';
    cls='cs-offline';
  } else if(_pendingWrites>0 || _syncing){
    txt='🔄 Senkronize ediliyor…';
    cls='cs-syncing';
  } else {
    txt='🟢 Çevrimiçi';
    cls='cs-online';
  }
  el.textContent=txt;
  el.className='conn-status '+cls;
  // Çevrimiçi ve bekleyen yoksa 2 sn sonra gizle (sürekli yeşil görünmesin)
  el.style.display='block';
  clearTimeout(window._csHide);
  if(cls==='cs-online'){ window._csHide=setTimeout(()=>{ el.style.display='none'; },2500); }
}

/* ══════════════════════════════════════
   GİRİŞ / ÇIKIŞ
══════════════════════════════════════ */
/* ══════════════════════════════════════
   HATA TAKİBİ (error tracking)
   Otomatik JS hatalarını yakalar, Firebase'e kaydeder, süper admin görür
══════════════════════════════════════ */
let _errorLogThrottle={}; // aynı hatayı spam'lememek için
const MAX_ERROR_LOGS=100;

function setupErrorTracking(){
  window.addEventListener('error', (e)=>{
    try{ logAppError(e.message||'Bilinmeyen hata', (e.filename||'')+':'+(e.lineno||'')); }catch(_){}
  });
  window.addEventListener('unhandledrejection', (e)=>{
    try{
      const msg=(e.reason&&(e.reason.message||e.reason.toString()))||'Promise hatası';
      logAppError(msg, 'unhandledrejection');
    }catch(_){}
  });
}

async function logAppError(message, where){
  if(!_db) return;
  try{
    // Aynı mesajı 60 sn içinde tekrar loglama (spam önleme)
    const key=String(message).slice(0,80);
    const now=Date.now();
    if(_errorLogThrottle[key] && now-_errorLogThrottle[key]<60000) return;
    _errorLogThrottle[key]=now;
    // Bağlantı/izin hatalarını loglama (gürültü)
    const m=String(message).toLowerCase();
    if(m.includes('permission_denied')||m.includes('network error')||m.includes('quota')) return;
    const entry={
      msg:String(message).slice(0,300),
      where:String(where||'').slice(0,200),
      company:S.activeCompanyName||(S.cur?.isSuper?'(süper admin)':S.cur?.companyName||'—'),
      companyId:S.activeCompanyId||S.cur?.companyId||'',
      user:S.cur?.fullname||S.cur?.username||'—',
      device:(navigator.userAgent||'').slice(0,160),
      ts:now, at:nowStr()
    };
    const ref=_db.ref(`${TENANT_ROOT}/errorLogs`);
    await ref.push(entry);
    // Son MAX_ERROR_LOGS tut
    const snap=await ref.once('value');
    if(snap.exists()){
      const items=[]; snap.forEach(ch=>items.push({k:ch.key,ts:ch.val().ts||0}));
      items.sort((a,b)=>b.ts-a.ts);
      for(let i=MAX_ERROR_LOGS;i<items.length;i++){ await ref.child(items[i].k).remove(); }
    }
  }catch(_){}
}

/* Süper admin: Hata kayıtları ekranı */
async function openErrorLogs(){
  if(!_db){ toast('❌ Bağlantı yok'); return; }
  const body=document.getElementById('gmodal-body');
  document.getElementById('gmodal-title').textContent='🔴 Hata Kayıtları';
  body.innerHTML='<div style="padding:20px;text-align:center;color:var(--txt3)">Yükleniyor…</div>';
  openModal('gmodal');
  try{
    const snap=await _db.ref(`${TENANT_ROOT}/errorLogs`).once('value');
    const logs=[];
    if(snap.exists()) snap.forEach(ch=>logs.push(ch.val()));
    logs.sort((a,b)=>(b.ts||0)-(a.ts||0));
    if(!logs.length){
      body.innerHTML='<div class="empty-state"><div class="empty-icon">✅</div><p>Hata kaydı yok. Sistem temiz!</p></div>';
      return;
    }
    body.innerHTML=`
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <p style="font-size:12.5px;color:var(--txt2);margin:0">Son ${logs.length} hata (otomatik yakalandı)</p>
        <button class="btn btn-danger btn-sm" onclick="clearErrorLogs()" style="font-size:11px;padding:5px 10px">🗑️ Temizle</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow-y:auto">
        ${logs.map(l=>`
          <div style="background:var(--bg);border:1px solid var(--brd);border-left:3px solid #ef4444;border-radius:8px;padding:10px 12px">
            <div style="font-size:12.5px;font-weight:600;color:var(--txt);margin-bottom:4px;word-break:break-word">${safe(l.msg||'—')}</div>
            <div style="font-size:11px;color:var(--txt3);line-height:1.5">
              📅 ${safe(l.at||'')}<br>
              🏢 ${safe(l.company||'—')} · 👤 ${safe(l.user||'—')}<br>
              ${l.where?`📍 ${safe(l.where)}<br>`:''}
              📱 ${safe((l.device||'').slice(0,80))}
            </div>
          </div>`).join('')}
      </div>`;
  }catch(e){ body.innerHTML='<div style="padding:20px;color:var(--rtxt)">Hata kayıtları okunamadı: '+safe(e.message)+'</div>'; }
}

async function clearErrorLogs(){
  if(!await confirmDialog({title:'Hata Kayıtlarını Temizle',message:'Tüm hata kayıtları silinecek. Devam?',danger:true,okText:'Temizle'})) return;
  try{
    await _db.ref(`${TENANT_ROOT}/errorLogs`).remove();
    toast('🗑️ Hata kayıtları temizlendi');
    closeModal('gmodal');
  }catch(e){ toast('❌ '+e.message,5000); }
}

async function initApp(){
  setupErrorTracking();
  // Firebase'e bağlan (şirket kataloğu listener'ı da burada kurulur)
  const ok = await initFirebase();
  if(!ok) return;

  showLoading(true);
  try{
    // Süper admin global olarak var olmalı (şirketlerin üstünde)
    await ensureSuperAdminGlobal();
    // Global iletişim bilgisini yükle (giriş/misafir ekranları için)
    await loadGlobalContact();
    // Global tür şablonunu yükle
    await loadGlobalCats();
    // Genel evraklar (belge ağacı) yükle
    await loadGlobalDocs();
    // Şirket kataloğu gelene kadar kısa bekle (listener doldurur)
    await new Promise(r=>setTimeout(r,500));
  }catch(e){
    showConnectionError('Başlatma hatası: '+e.message);
    return;
  } finally{
    showLoading(false);
  }

  // Oturum kontrolü (kayıtlı oturum varsa geri yükle)
  const saved = getSession();
  if(saved){
    if(saved.isSuper){
      // Süper admin oturumu
      S.cur=saved; startSessionTimer();
      // Daha önce bir şirkete girmişse oraya geri dön (F5'te başa dönmesin)
      if(saved.activeCompanyId && S.companies.find(c=>c.id===saved.activeCompanyId)){
        try{
          await enterCompany(saved.activeCompanyId);
          setTimeout(()=>{ autoBackupIfNeeded(); purgeTrashIfNeeded(); }, 3000);
          return;
        }catch(e){ /* başarısızsa şirketler ekranına düş */ }
      }
      renderCompaniesScreen();
      setTimeout(()=>{ autoBackupIfNeeded(); purgeTrashIfNeeded(); }, 3000);
      return;
    } else if(saved.companyId){
      // Normal kullanıcı → şirketine bağlan
      S.cur=saved; startSessionTimer();
      try{
        await bindCompanyData(saved.companyId);
        await new Promise(r=>setTimeout(r,400));
        const fresh=S.users.find(u=>u.id===saved.id);
        if(fresh){ S.cur=fresh; S.cur.companyId=saved.companyId; bootApp(); checkQRDeepLink(); return; }
      }catch(e){ /* bağlanamazsa login'e düş */ }
    }
  }

  // Login ekranı
  document.getElementById('login-screen').style.display='flex';
  renderLoginContact();
  checkQRDeepLink();
}

/* Giriş ekranında iletişim bilgisi göster (admin profilinden girilir) */
function renderLoginContact(){
  const el=document.getElementById('login-contact'); if(!el) return;
  const c=S.contactInfo||{};
  const tel=(c.tel||'').trim();
  const mail=(c.mail||'').trim();
  if(!tel && !mail){ el.style.display='none'; return; }
  let html='<div class="login-contact-title">İletişim</div>';
  if(tel)  html+=`<a href="tel:${safe(tel)}" class="login-contact-row">📞 ${safe(tel)}</a>`;
  if(mail) html+=`<a href="mailto:${safe(mail)}" class="login-contact-row">✉️ ${safe(mail)}</a>`;
  el.innerHTML=html;
  el.style.display='block';
}

/* URL'de ?q=... varsa (QR ile gelindi) işle */
function checkQRDeepLink(){
  let q=null;
  try{
    const params=new URLSearchParams(window.location.search);
    q=params.get('q');
    if(!q) return;
    // URL'i temizle (tekrar tetiklenmesin, paylaşımda kalmasın)
    window.history.replaceState({}, '', window.location.pathname);
  }catch(e){ return; }
  if(!q) return;

  // Veri (S.equips) hazır olana kadar bekle, sonra işle. Takılma/siyah ekran önlemi.
  let tries=0;
  const tryHandle=()=>{
    tries++;
    // Veri yüklendiyse VEYA 6 saniye geçtiyse işle (sonsuz bekleme yok)
    if((S.fbReady && Array.isArray(S.equips)) || tries>30){
      try{ handleQRData(q); }
      catch(err){
        // Bir hata olursa kullanıcıyı asla siyah ekranda bırakma
        console.warn('QR işleme hatası:', err);
        if(!S.cur) openGuestContact(q);
        else toast('⚠️ QR işlenemedi, ana sayfaya yönlendirildiniz');
      }
      return;
    }
    setTimeout(tryHandle, 200);
  };
  setTimeout(tryHandle, 300);
}

function showLoading(show){
  const el=document.getElementById('loading-screen');
  if(el) el.style.display=show?'flex':'none';
}

// Giriş kilidi (brute-force koruması) — sessionStorage'da tutulur
function getLoginLock(){
  try{ const v=sessionStorage.getItem('te_lock'); return v?JSON.parse(v):{fails:0,until:0}; }
  catch{ return {fails:0,until:0}; }
}
function setLoginLock(d){ try{ sessionStorage.setItem('te_lock',JSON.stringify(d)); }catch(e){} }

async function doLogin(){
  const uname = document.getElementById('login-user').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const err   = document.getElementById('login-error');
  const btn   = document.getElementById('btn-login');

  // Kilit kontrolü
  const lock=getLoginLock();
  if(lock.until && Date.now()<lock.until){
    const sec=Math.ceil((lock.until-Date.now())/1000);
    err.textContent=`Çok fazla hatalı deneme. ${sec} saniye bekleyin.`;
    err.classList.add('show');
    return;
  }

  // Kilitliyse dur
  // (lock kontrolü yukarıda yapıldı)

  // ── ÇOK ŞİRKET GİRİŞ ──
  // 1) Süper admin mi? (global, şirketlerin üstünde)
  let user=null, loginCompanyId=null, isSuperLogin=false;
  const fail=()=>{
    const l=getLoginLock();
    l.fails=(l.fails||0)+1;
    if(l.fails>=5){ l.until=Date.now()+60000; l.fails=0; err.textContent='5 hatalı deneme. 60 saniye kilitlendi.'; }
    else { err.textContent=`Kullanıcı adı veya şifre hatalı. (${5-l.fails} deneme kaldı)`; }
    setLoginLock(l);
    err.classList.add('show');
  };

  if(btn){ btn.disabled=true; btn.textContent='Kontrol ediliyor…'; }

  // ── 0) GÜVENLİ BULUT GİRİŞİ (FAZ 2) ──
  // Cloud Function kullanıcıyı SUNUCUDA arar+doğrular, özel token döner.
  // Fonksiyona ulaşılamazsa (ağ/deploy) eski yerel yönteme düşer — kimse dışarıda kalmaz.
  let cloudDone=false;
  if(_fns){
    try{
      const res=await _fns.httpsCallable('login')({ username:uname, password:pass });
      const d=res&&res.data;
      if(d&&d.token){
        try{ await firebase.auth(firebase.app('takipet')).signInWithCustomToken(d.token); }
        catch(e){ console.warn('Özel token girişi:', e.message); }
        user=d.user; loginCompanyId=d.companyId||null; isSuperLogin=!!d.isSuper;
        cloudDone=true;
      }
    }catch(e){
      const code=String((e&&e.code)||'');
      if(code.includes('unauthenticated')){
        // Sunucu 'kullanıcı adı/şifre hatalı' dedi — yerel fallback DENENMEZ (güvenlik)
        if(btn){ btn.disabled=false; btn.textContent='Giriş Yap →'; } fail(); return;
      }
      if(code.includes('resource-exhausted')){
        if(btn){ btn.disabled=false; btn.textContent='Giriş Yap →'; }
        err.textContent=e.message||'Çok fazla hatalı deneme. Biraz bekleyin.'; err.classList.add('show'); return;
      }
      console.warn('Bulut girişi kullanılamadı, yerel yönteme dönülüyor:', code||e.message);
    }
  }

  if(!cloudDone){
    if(uname===SUPER_USERNAME){
      const su=await getSuperAdmin();
      if(su){ user=su; isSuperLogin=true; }
    } else {
      // Normal kullanıcı: tüm şirketlerde ara (eski yöntem — bulut kapalıysa)
      const found=await findUserAcrossCompanies(uname);
      if(found){ user=found.user; loginCompanyId=found.companyId; }
    }
    if(!user){ if(btn){ btn.disabled=false; btn.textContent='Giriş Yap →'; } fail(); return; }
    const ok = await verifyPassword(pass, user);
    if(!ok){ if(btn){ btn.disabled=false; btn.textContent='Giriş Yap →'; } fail(); return; }
  }
  if(btn){ btn.disabled=false; btn.textContent='Giriş Yap →'; }

  // Başarılı — kilidi sıfırla
  setLoginLock({fails:0,until:0});
  err.classList.remove('show');
  haptic(15);

  if(isSuperLogin){
    // Süper admin → şirket listesi ekranı
    S.cur=user; setSession(user);
    startSessionTimer();
    document.getElementById('login-screen').style.display='none';
    renderCompaniesScreen();
    // Otomatik yedekleme (günlük, arka planda)
    setTimeout(()=>{ autoBackupIfNeeded(); purgeTrashIfNeeded(); }, 3000);
    return;
  }

  // Normal kullanıcı → kendi şirketine bağlan
  S.cur=user;
  S.cur.companyId=loginCompanyId;
  user.companyId=loginCompanyId;
  setSession(S.cur);
  try{ closeModal('modal-guest'); }catch(e){}
  startSessionTimer();
  showLoading(true);
  try{
    await bindCompanyData(loginCompanyId);
    await new Promise(r=>setTimeout(r,500));
  }catch(e){ showLoading(false); toast('❌ Şirket verisine bağlanılamadı: '+e.message,5000); return; }
  showLoading(false);
  bootApp();
  // Girişsiz QR sonrası yönlendirme
  let pq=_pendingQR;
  if(!pq){ try{ pq=sessionStorage.getItem('te_pendingQR'); }catch(e){} }
  if(pq){
    _pendingQR=null;
    try{ sessionStorage.removeItem('te_pendingQR'); }catch(e){}
    let t=0;
    const proc=()=>{ t++; if((S.fbReady && Array.isArray(S.equips)) || t>40){ try{ handleQRData(pq); }catch(e){} return; } setTimeout(proc,150); };
    setTimeout(proc, 500);
  }
}

function doLogout(reason){
  S.cur=null; clearSession();
  stopSessionTimer();
  detachCompanyData();
  // Firebase oturumunu anonime döndür (özel token'lı oturum cihazda kalmasın)
  try{
    const a=firebase.auth(firebase.app('takipet'));
    if(a.currentUser && !a.currentUser.isAnonymous){ a.signOut().then(()=>a.signInAnonymously()).catch(()=>{}); }
  }catch(e){}
  const cs=document.getElementById('companies-screen'); if(cs) cs.style.display='none';
  document.getElementById('app').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('login-user').value='';
  document.getElementById('login-pass').value='';
  if(reason==='timeout') setTimeout(()=>toast('⏱️ Hareketsizlik nedeniyle oturum kapatıldı',5000),300);
}

/* Güvenlik kaynaklı zorunlu çıkış (silme/şifre/yetki değişimi) */
let _forcedLogout=false;
function forceLogout(message){
  if(_forcedLogout) return; // tekrar tetiklenmesin
  _forcedLogout=true;
  // Açık denetim oturumunu temiz kapat (silineni diriltme)
  try{ detachCollabListener(); clearActiveInspection(); }catch(e){}
  try{ document.querySelectorAll('.modal-ov.open').forEach(m=>m.classList.remove('open')); }catch(e){}
  doLogout('forced');
  setTimeout(()=>{ toast('🔒 '+(message||'Oturumunuz sonlandırıldı.'), 6000); _forcedLogout=false; }, 300);
}

/* ── OTURUM ZAMAN AŞIMI (15 dk hareketsizlik) ── */
const SESSION_TIMEOUT = 15*60*1000;  // 15 dakika
let _sessionTimer=null;

function startSessionTimer(){
  stopSessionTimer();
  resetSessionTimer();
  // Kullanıcı etkileşimlerini dinle
  ['click','keydown','touchstart','scroll'].forEach(ev=>
    document.addEventListener(ev, resetSessionTimer, {passive:true}));
}
function resetSessionTimer(){
  if(!S.cur) return;
  clearTimeout(_sessionTimer);
  _sessionTimer=setTimeout(()=>{ if(S.cur) doLogout('timeout'); }, SESSION_TIMEOUT);
}
function stopSessionTimer(){
  clearTimeout(_sessionTimer);
  ['click','keydown','touchstart','scroll'].forEach(ev=>
    document.removeEventListener(ev, resetSessionTimer));
}

function bootApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='block';
  hideCompanySidebar();   // normal kullanıcı süper admin panelini görmez (önceki oturumdan kalmasın)
  applyPerms();
  updateTopbar();
  updateNotifBell();
  showPage('home');
  // Denetim hatırlatması — giriş sonrası
  setTimeout(()=>{
    const due=getDueEquips().filter(x=>x.st.state==='overdue'||x.st.state==='never');
    if(due.length) toast(`⏰ ${due.length} ekipman denetim bekliyor (Ekipmanlar sekmesi)`, 5000);
    checkOverdueNotifications();
    checkMaintenanceWarnings();
    runRetentionCleanup();
  }, 1500);
}

/* Periyodu geçen ekipmanlar için yönetici+denetçilere bildirim (günde 1 kez) */
async function checkOverdueNotifications(){
  if(!isAdmin() && !canDo('inspect')) return; // sadece ilgili roller tetikler
  const todayKey=new Date().toISOString().slice(0,10);
  if(S._overdueCheckedDay===todayKey) return; // bu oturumda zaten kontrol edildi
  S._overdueCheckedDay=todayKey;

  const overdue=S.equips.filter(e=>inspectStatus(e).state==='overdue');
  if(!overdue.length) return;

  let added=false;
  overdue.forEach(e=>{
    const st=inspectStatus(e);
    const m=mahalById(e.mahalId);
    // Aynı ekipman için bugün zaten bildirim varsa tekrar ekleme
    const exists=(S.notifications||[]).some(n=>n.type==='overdue' && n.equipId===e.id && (n.date||'').startsWith(todayKey.split('-').reverse().join('.')) );
    const todayTr=new Date().toLocaleDateString('tr-TR');
    const already=(S.notifications||[]).some(n=>n.type==='overdue'&&n.equipId===e.id&&n.dayKey===todayKey);
    if(already) return;
    S.notifications.unshift({
      id:'n'+Date.now()+Math.random().toString(36).slice(2,5),
      type:'overdue', equipId:e.id, equipName:e.name, mahalName:m?.name||'—',
      note:`⏰ ${m?.name||''} lokasyonundaki "${e.name}" denetimi ${st.days} gün gecikti (periyot: ${periodLabel(st.period)}).`,
      date:todayTr, dayKey:todayKey, ts:Date.now(), readBy:[]
    });
    added=true;
  });
  if(added){
    if(S.notifications.length>100) S.notifications=S.notifications.slice(0,100);
    try{ await save(); updateNotifBell(); }catch(e){}
  }
}

/* "2026-07-15" → Date */
function parseMaintDate(str){
  if(!str) return null;
  const m=String(str).match(/(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return null;
  return new Date(+m[1], +m[2]-1, +m[3]);
}
/* "2026-07-15" → "15.07.2026" */
function fmtMaintDate(str){
  const d=parseMaintDate(str);
  if(!d) return str||'—';
  return d.toLocaleDateString('tr-TR');
}
/* Bir kullanıcı bakım uyarısı alacak mı? (rol ayarında 'maint_warn' yetkisi) */
function getsMaintWarning(u){
  if(u.isSuper) return true;
  return getUserPerms(u).includes('maint_warn');
}
/* Bakım tarihi yaklaşan ekipmanlar için uyarı üret */
async function checkMaintenanceWarnings(force=false){
  if(!S.cur) return;
  const todayKey=new Date().toISOString().slice(0,10);
  if(!force && S._maintCheckedDay===todayKey) return;
  S._maintCheckedDay=todayKey;
  // Sadece bakım uyarısı alması gereken kullanıcı tetiklesin (bildirim oluşturma)
  if(!isAdmin() && !getsMaintWarning(S.cur)) return;

  let added=false;
  S.equips.forEach(e=>{
    if(!e.maintenance || !e.maintenance.date) return;
    const md=parseMaintDate(e.maintenance.date);
    if(!md) return;
    const daysLeft=Math.ceil((md.getTime()-Date.now())/86400000);
    const warnDays=e.maintenance.warnDays||15;
    // Uyarı penceresi: tarihten warnDays gün önce ile tarih arası (veya geçmiş)
    if(daysLeft<=warnDays){
      // Bu ekipman+tarih için bugün zaten bildirim var mı?
      const already=(S.notifications||[]).some(n=>n.type==='maintenance'&&n.equipId===e.id&&n.maintDate===e.maintenance.date&&n.dayKey===todayKey);
      if(already) return;
      const m=mahalById(e.mahalId);
      const msg = daysLeft<0
        ? `🔧 ${m?.name||''} "${e.name}" bakım tarihi ${-daysLeft} gün geçti (${fmtMaintDate(e.maintenance.date)}).`
        : `🔧 ${m?.name||''} "${e.name}" bakımı yaklaşıyor — ${daysLeft} gün kaldı (${fmtMaintDate(e.maintenance.date)}).`;
      S.notifications.unshift({
        id:'n'+Date.now()+Math.random().toString(36).slice(2,5),
        type:'maintenance', equipId:e.id, equipName:e.name, mahalName:m?.name||'—',
        maintDate:e.maintenance.date,
        note:msg + (e.maintenance.firm?` Firma: ${e.maintenance.firm}.`:''),
        date:new Date().toLocaleDateString('tr-TR'), dayKey:todayKey, ts:Date.now(), readBy:[], deletedBy:[]
      });
      added=true;
    }
  });
  if(added){
    if(S.notifications.length>100) S.notifications=S.notifications.slice(0,100);
    try{ await save(); updateNotifBell(); }catch(e){}
  }
}

function updateNotifBell(){
  const btn=document.getElementById('btn-notif');
  const badge=document.getElementById('notif-badge');
  if(!btn||!badge) return;
  const cnt=unreadNotifCount();
  // Yönetici+/yetkili HER ZAMAN zili görür; diğerleri hedefli bildirimi (iş emri vb.) varsa görür
  const gate = S.cur?.isSuper || roleLevel(S.cur?.role)>=3 || getUserPerms(S.cur||{}).includes('view_notifications') || getsMaintWarning(S.cur||{});
  if(gate || cnt>0){
    btn.style.display='';
    if(cnt>0){ badge.style.display='flex'; badge.textContent=cnt>9?'9+':cnt; }
    else badge.style.display='none';
  } else btn.style.display='none';
}

