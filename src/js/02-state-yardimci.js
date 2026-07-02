/* ══════════════════════════════════════
   STATE — sadece memory, Firebase kaynak
══════════════════════════════════════ */
const S = {
  users:[], mahals:[], equips:[], reports:[], logs:[], activity:[], notifications:[], customCats:[], catForms:{}, catOverrides:{},
  companies:[],          // şirket kataloğu (süper admin görür)
  activeCompanyId:null,  // şu an içinde olunan şirket
  cur:null,      // aktif kullanıcı (sessionStorage'da — sadece oturum boyunca)
  fbReady:false,
  page:'home',
  activeMahalId:null, activeEquipId:null, activeReportId:null,
  editMahalId:null, editEquipId:null, editUserId:null, qrEquipId:null,
  inspEquipId:null, inspAns:{}, inspPhotos:[],
  tupRows:[], tupSetupRows:[],
  pendCrit:[], editCrit:[],
  filterCat:'all', reportFilter:'all',
  searchQ:'', reportQ:'',
  reportLimit:30, reportMahalFilter:'all', rolePerms:null, contactInfo:null,
  pgIncomplete:1, pgActivity:1, pgReports:1, pgEquip:1, pgNotif:1, // sayfa numaraları
  quotaLimits:null, catPeriods:null, customRoles:null, catMaintenance:null, retention:null, // kota + periyot + roller + tür bakım + veri ömrü
  workOrders:[], // iş emirleri (to-do)
  camStream:null, scanAnimId:null,
};

// Oturum bilgisi için SADECE sessionStorage (LocalStorage değil)
// Sekme kapanınca silinir — otomatik çıkış
/* Oturum — kalıcı (localStorage). Uygulama kapanıp açılınca da hatırlar.
   Sadece oturum + tema gibi cihaz tercihleri için localStorage; veri hep Firebase'de. */
const getSession  = ()=>{ try{ const v=localStorage.getItem('te_cur')||sessionStorage.getItem('te_cur'); return v?JSON.parse(v):null; }catch{return null;} };
const setSession  = u =>{ try{ localStorage.setItem('te_cur',JSON.stringify(u)); }catch(e){ try{ sessionStorage.setItem('te_cur',JSON.stringify(u)); }catch(e2){} } };
const clearSession= ()=>{ try{ localStorage.removeItem('te_cur'); sessionStorage.removeItem('te_cur'); }catch(e){} };

// Tema için sessionStorage
const getTheme = ()=>{ try{ return localStorage.getItem('te_theme')||sessionStorage.getItem('te_theme')||'light'; }catch{return 'light';} };
const setTheme = t=>{ try{ localStorage.setItem('te_theme',t); }catch(e){ try{ sessionStorage.setItem('te_theme',t); }catch(e2){} } };

/* ══════════════════════════════════════
   YARDIMCI
══════════════════════════════════════ */
const uid    = ()=>'eq-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
const mid    = ()=>'mh-'+Date.now()+'-'+Math.random().toString(36).slice(2,5);
const rid    = ()=>'RPR-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+Math.random().toString(36).slice(2,5).toUpperCase();
const nowStr = ()=>new Date().toLocaleString('tr-TR',{hour12:false});
// XSS koruması: HTML metin VE çift-tırnaklı attribute bağlamı için & < > " kaçırılır.
// ' KAÇIRILMAZ — bazı onclick'ler safe()'i tek-tırnaklı JS string içinde kullanıyor (örn. openGuestContact).
const safe   = v=>String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// onclick="...'${jsStr(x)}'..." gibi: çift-tırnaklı attribute İÇİNDE tek-tırnaklı JS string'e
// güvenli gömme. Ters bölü/tek tırnak/çift tırnak/< hepsini kaçırır (isim/metin UI'yi kıramaz).
const jsStr  = v=>String(v==null?'':v).replace(/\\/g,'\\\\').replace(/'/g,'\\x27').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const toArr  = v=>!v?[]:(Array.isArray(v)?v:Object.values(v));

const allCats   = ()=>CATS;
const catById   = id=>allCats().find(c=>c.id===id)||{name:'—',icon:'📦'};
const mahalById = id=>S.mahals.find(m=>m.id===id);
const equipById = id=>S.equips.find(e=>e.id===id);
const rptById   = id=>S.reports.find(r=>r.id===id);
const userById  = id=>S.users.find(u=>u.id===id);
const mahalIcon = (i,m)=>(m&&m.icon)?m.icon:MAHAL_ICONS[i%MAHAL_ICONS.length];

/* ── ŞİFRE GÜVENLİĞİ: SHA-256 + Salt ──
   Eski basit hash geriye dönük uyumluluk için korunur (migration). */
function legacyHash(p){
  let h=5381;
  for(let c of String(p)){ h=((h<<5)+h)+c.charCodeAt(0)|0; }
  return 'pw'+Math.abs(h).toString(36);
}

// Rastgele salt üret (16 byte → hex)
function makeSalt(){
  const a=new Uint8Array(16);
  (crypto.getRandomValues?crypto:window.crypto).getRandomValues(a);
  return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// SHA-256(salt + şifre) → hex
async function sha256(text){
  const data=new TextEncoder().encode(text);
  const buf=await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// Yeni şifre kaydı: {salt, hash} üretir
async function hashPassword(pass, salt=null){
  const s=salt||makeSalt();
  const h=await sha256(s+'::'+pass);
  return {salt:s, hash:h};
}

// Şifre doğrula — hem yeni (salt+sha256) hem eski (legacy) formatı destekler
async function verifyPassword(pass, user){
  // Yeni format: user.pwSalt + user.pwHash (sha256)
  if(user.pwSalt && user.pwHash){
    const h=await sha256(user.pwSalt+'::'+pass);
    return h===user.pwHash;
  }
  // Eski format: sadece pwHash (legacy basit hash)
  if(user.pwHash && !user.pwSalt){
    return legacyHash(pass)===user.pwHash;
  }
  return false;
}

// Şifre güç kontrolü: min 8, harf + rakam
function checkPasswordStrength(pass){
  if(pass.length<8) return 'Şifre en az 8 karakter olmalı';
  if(!/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(pass)) return 'Şifre en az 1 harf içermeli';
  if(!/[0-9]/.test(pass)) return 'Şifre en az 1 rakam içermeli';
  return null; // geçerli
}

function canDo(action){
  if(!S.cur) return false;
  // Süper admin her zaman tam yetkili (kilitlenmeyi önler)
  if(S.cur.isSuper) return true;
  // Kişiye özel yetki override (varsa) — admin dahil
  if(S.cur.perms && Array.isArray(S.cur.perms)){
    return S.cur.perms.includes(action);
  }
  // Admin rolü: süper admin özelleştirmediyse tam yetkili
  if(S.cur.role==='admin'){
    if(S.rolePerms && S.rolePerms.admin) return S.rolePerms.admin.includes(action);
    return true; // varsayılan: admin tam yetkili
  }
  // Diğer roller
  const rp=(S.rolePerms&&S.rolePerms[S.cur.role])||DEFAULT_ROLE_PERMS[S.cur.role]||[];
  return rp.includes(action);
}

/* Bir rolün geçerli yetki listesi */
function getRolePerms(role){
  if(S.rolePerms&&S.rolePerms[role]) return S.rolePerms[role];
  return DEFAULT_ROLE_PERMS[role]||[];
}
/* Bir kullanıcının etkin yetkileri (kişisel override varsa o, yoksa rolünki) */
function getUserPerms(u){
  if(u.isSuper) return PERM_DEFS.map(p=>p.id); // süper admin tüm yetkiler
  if(u.perms&&Array.isArray(u.perms)) return u.perms;
  return getRolePerms(u.role);
}
const isAdmin = ()=>S.cur?.isSuper===true || S.cur?.role==='admin';
const isSuperAdmin = ()=>S.cur?.isSuper===true;
const SUPER_USERNAME = 'adminstatorack';

/* ── ÇOK ŞİRKET: Süper admin global saklanır (takipet/superadmin) ── */
async function ensureSuperAdminGlobal(){
  if(!_db) return;
  try{
    const ref=_db.ref(`${TENANT_ROOT}/superadmin`);
    const snap=await ref.once('value');
    if(!snap.exists()){
      const ap=await hashPassword('QsrTTshgaaD.1!..8254738');
      const su={id:'u_super',username:SUPER_USERNAME,fullname:'Sistem Süper Yöneticisi',role:'admin',isSuper:true,pwSalt:ap.salt,pwHash:ap.hash,createdAt:nowStr(),mustChangePw:false};
      await ref.set(su);
    }
  }catch(e){ console.warn('superadmin init:', e.message); }
}

/* Süper admin kaydını getir */
async function getSuperAdmin(){
  if(!_db) return null;
  try{ const snap=await _db.ref(`${TENANT_ROOT}/superadmin`).once('value'); return snap.exists()?snap.val():null; }
  catch(e){ return null; }
}

/* Bir kullanıcıyı TÜM şirketlerde ara (login için) → {user, companyId} | null */
async function findUserAcrossCompanies(username){
  if(!_db) return null;
  for(const c of S.companies){
    try{
      const snap=await _db.ref(`${companyDataPath(c.id)}/users`).once('value');
      if(snap.exists()){
        const users=toArr(snap.val());
        const u=users.find(x=>x.username===username);
        if(u){ return {user:u, companyId:c.id, companyName:c.name}; }
      }
    }catch(e){}
  }
  return null;
}

/* (eski — tek havuz için, artık şirket içi save sonrası garanti) */
async function ensureSuperAdmin(){
  // Çok şirket yapısında süper admin global. Şirket içi listede tutulmaz.
  return;
}

/* ── KOTA / VERİ TAKİP SİSTEMİ (süper admin) ── */
const FREE_DB_GB = 1;       // Spark/Blaze ücretsiz DB kotası
const FREE_STORAGE_GB = 5;  // ücretsiz Storage kotası

/* ── VERİ ÖMRÜ (otomatik temizlik) — süper admin panelinden yönetilir ──
   Süre dolan kayıtlar otomatik silinir (temizlenmediyse). Gün cinsinden. */
const DEFAULT_RETENTION = {
  reports: 365,        // raporlar 1 yıl
  documents: 730,      // belgeler 2 yıl (ileride Storage ile)
  notifications: 30,   // bildirimler 30 gün
  logs: 30,            // log/aktivite 30 gün
  workorders: 30,      // tamamlanan (onaylı) iş emirleri 30 gün
};

/* Bakım kutusu aç/kapa (ekipman türleri gibi aşağı doğru açılır) — genel */
function toggleMaintBox(contentId, chevronId){
  const c=document.getElementById(contentId);
  const ch=document.getElementById(chevronId);
  if(!c) return;
  const open=c.style.display!=='none';
  c.style.display=open?'none':'block';
  if(ch) ch.style.transform=open?'rotate(0deg)':'rotate(180deg)';
}
/* (geriye uyumluluk) */
function toggleFdMaint(){ toggleMaintBox('fd-maint-content','fd-maint-chevron'); }

/* ── ÖZEL TARİH SEÇİCİ (temaya uygun, elle giriş + takvim) ── */
let _dpTarget=null, _dpMonth=null, _dpYear=null, _dpSelected=null, _dpIsoFormat=true;
const DP_MONTHS=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
function openDatePicker(inputId, isoFormat=true, title='📅 Tarih Seç'){
  _dpTarget=inputId; _dpIsoFormat=isoFormat;
  const inp=document.getElementById(inputId);
  document.getElementById('dp-title').textContent=title;
  let d=null;
  if(inp && inp.value){
    d = parseDateStr(inp.value); // value artık TR formatında
  }
  if(!d || isNaN(d.getTime())) d=new Date();
  _dpYear=d.getFullYear(); _dpMonth=d.getMonth();
  _dpSelected=(inp&&inp.value)?new Date(d):null;
  const man=document.getElementById('dp-manual');
  if(man) man.value=_dpSelected?fmtTrDate(_dpSelected):'';
  renderDpCalendar();
  openModal('modal-datepicker');
}
function fmtTrDate(d){
  return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();
}
function renderDpCalendar(){
  document.getElementById('dp-month').textContent=DP_MONTHS[_dpMonth]+' '+_dpYear;
  const first=new Date(_dpYear,_dpMonth,1);
  let startDay=first.getDay(); startDay=(startDay===0)?6:startDay-1;
  const daysInMonth=new Date(_dpYear,_dpMonth+1,0).getDate();
  const today=new Date(); today.setHours(0,0,0,0);
  let html='';
  for(let i=0;i<startDay;i++) html+='<button class="dp-day dp-empty"></button>';
  for(let d=1;d<=daysInMonth;d++){
    const cur=new Date(_dpYear,_dpMonth,d);
    const isToday=cur.getTime()===today.getTime();
    const isSel=_dpSelected && cur.getFullYear()===_dpSelected.getFullYear() && cur.getMonth()===_dpSelected.getMonth() && cur.getDate()===_dpSelected.getDate();
    html+=`<button class="dp-day${isToday?' dp-today':''}${isSel?' dp-selected':''}" onclick="dpPickDay(${d})">${d}</button>`;
  }
  document.getElementById('dp-days').innerHTML=html;
}
function dpPickDay(d){
  _dpSelected=new Date(_dpYear,_dpMonth,d);
  document.getElementById('dp-manual').value=fmtTrDate(_dpSelected);
  renderDpCalendar();
}
function dpApply(){
  const man=document.getElementById('dp-manual').value.trim();
  let d=_dpSelected;
  if(man){
    const parsed=parseDateStr(man);
    if(parsed) d=parsed;
    else { toast('⚠️ Tarih formatı: GG.AA.YYYY'); return; }
  }
  const inp=document.getElementById(_dpTarget);
  if(inp){
    if(!d){ inp.value=''; }
    else {
      // Görünür değer TR (kullanıcı dostu); okuyan kod trToIso ile çevirir
      inp.value = fmtTrDate(d);
    }
    inp.dispatchEvent(new Event('change',{bubbles:true}));
  }
  closeModal('modal-datepicker');
}
/* TR "15.08.2026" → ISO "2026-08-15" (boşsa '') */
function trToIso(tr){
  const d=parseDateStr(tr);
  if(!d) return '';
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
/* ISO "2026-08-15" → TR "15.08.2026" (gösterim için) */
function isoToTr(iso){
  if(!iso) return '';
  const m=String(iso).match(/(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return iso;
  return m[3]+'.'+m[2]+'.'+m[1];
}
function initDatePickerControls(){
  document.getElementById('dp-prev')?.addEventListener('click',()=>{ _dpMonth--; if(_dpMonth<0){_dpMonth=11;_dpYear--;} renderDpCalendar(); });
  document.getElementById('dp-next')?.addEventListener('click',()=>{ _dpMonth++; if(_dpMonth>11){_dpMonth=0;_dpYear++;} renderDpCalendar(); });
  document.getElementById('dp-today')?.addEventListener('click',()=>{ const t=new Date(); _dpYear=t.getFullYear();_dpMonth=t.getMonth(); _dpSelected=new Date(t); document.getElementById('dp-manual').value=fmtTrDate(t); renderDpCalendar(); });
  document.getElementById('dp-clear')?.addEventListener('click',()=>{ _dpSelected=null; document.getElementById('dp-manual').value=''; renderDpCalendar(); });
  document.getElementById('dp-ok')?.addEventListener('click',dpApply);
  document.getElementById('dp-manual')?.addEventListener('input',function(){
    const p=parseDateStr(this.value.trim());
    if(p){ _dpYear=p.getFullYear();_dpMonth=p.getMonth();_dpSelected=new Date(p); renderDpCalendar(); }
  });
}

function getRetention(){
  return Object.assign({}, DEFAULT_RETENTION, S.retention||{});
}

/* Veri ömrü dolan kayıtları otomatik temizle (günde 1 kez, ilgili roller tetikler) */
async function runRetentionCleanup(){
  if(!isAdmin()) return; // sadece admin/süper admin tetikler (yazma yetkisi)
  const todayKey=new Date().toISOString().slice(0,10);
  if(S._retentionDay===todayKey) return;
  S._retentionDay=todayKey;
  const ret=getRetention();
  const now=Date.now();
  const ageDays=(dateStr, ts)=>{
    let t=ts;
    if(!t && dateStr){ const d=parseDateStr(dateStr); t=d?d.getTime():null; }
    if(!t) return null;
    return (now-t)/86400000;
  };
  let changed=false;

  // Raporlar (createdAt veya date) — tamamlanmamışları ASLA silme
  if(ret.reports>0){
    const before=S.reports.length;
    S.reports=S.reports.filter(r=>{
      if(r.incomplete) return true; // yarım raporlar korunur
      const a=ageDays(r.date, r.createdAt?Date.parse(r.createdAt):null);
      return a===null || a<=ret.reports;
    });
    if(S.reports.length!==before) changed=true;
  }
  // Bildirimler
  if(ret.notifications>0){
    const before=S.notifications.length;
    S.notifications=S.notifications.filter(n=>{
      const a=ageDays(n.date, n.ts);
      return a===null || a<=ret.notifications;
    });
    if(S.notifications.length!==before) changed=true;
  }
  // Loglar
  if(ret.logs>0){
    const beforeL=S.logs.length, beforeA=S.activity.length;
    S.logs=S.logs.filter(l=>{ const a=ageDays(l.date); return a===null||a<=ret.logs; });
    S.activity=S.activity.filter(x=>{ const a=ageDays(x.date); return a===null||a<=ret.logs; });
    if(S.logs.length!==beforeL || S.activity.length!==beforeA) changed=true;
  }
  // Tamamlanan (onaylı) iş emirleri — açık/onay bekleyenler ASLA silinmez
  if(ret.workorders>0 && Array.isArray(S.workOrders)){
    const before=S.workOrders.length;
    S.workOrders=S.workOrders.filter(w=>{
      if(w.status!=='approved') return true; // sadece onaylananlar temizlenir
      const a=ageDays(w.approvedAt, w.approvedTs||w.doneTs);
      return a===null || a<=ret.workorders;
    });
    if(S.workOrders.length!==before) changed=true;
  }
  // Belgeler: yüklenmesinin üzerinden ret.documents gün geçenler çöpe taşınır (30 gün geri alınabilir).
  // Sabitlenmiş (pinned) belgeler süresiz saklanır. Tarihi bilinmeyen eski belgeler silinmez.
  if(ret.documents>0){
    const docJobs=[];
    (S.equips||[]).forEach(e=>{
      (e.documents||[]).forEach(d=>{
        if(d.pinned) return;
        const a=ageDays(null, d.ts);
        if(a!==null && a>ret.documents) docJobs.push({holder:e, d, origin:'Ekipman: '+(e.name||''), kind:'equip'});
      });
    });
    (S.companyFolders||[]).forEach(f=>{
      (f.docs||[]).forEach(d=>{
        const a=ageDays(null, d.ts);
        if(a!==null && a>ret.documents) docJobs.push({holder:f, d, origin:'Klasör: '+(f.name||''), kind:'folder'});
      });
    });
    for(const j of docJobs){
      await trashDoc(j.d, j.origin+' · süre doldu');
      if(j.kind==='equip') j.holder.documents=(j.holder.documents||[]).filter(x=>x.id!==j.d.id);
      else j.holder.docs=(j.holder.docs||[]).filter(x=>x.id!==j.d.id);
    }
    if(docJobs.length){ changed=true; console.log('[Retention] belge çöpe taşındı:', docJobs.length); }
  }

  if(changed){
    try{ await save(); }catch(e){}
  }
}

/* Mevcut DB veri boyutunu tahmin et (byte) */
function estimateDbBytes(){
  try{
    const payload={users:S.users,mahals:S.mahals,equips:S.equips,reports:S.reports,
      logs:S.logs,activity:S.activity,notifications:S.notifications,customCats:S.customCats,
      catForms:S.catForms,catOverrides:S.catOverrides,rolePerms:S.rolePerms,
      workOrders:S.workOrders,companyFolders:S.companyFolders,customRoles:S.customRoles,
      catPeriods:S.catPeriods,catMaintenance:S.catMaintenance};
    return new Blob([JSON.stringify(payload)]).size;
  }catch(e){ return 0; }
}

/* Yüklenen belgelerin toplam boyutu (Storage) — denetim/ekipman eklerindeki dosyalardan */
let _companyTrashBytes=0; // bu şirketin çöpteki (henüz kalıcı silinmemiş) dosyalarının boyutu
function estimateStorageBytes(){
  // Gerçek belgeler e.documents[].size'da (ekipman belgeleri) + şirket klasörleri + çöpteki dosyalar.
  let total=0;
  (S.equips||[]).forEach(e=>{ (e.documents||[]).forEach(d=>{ total+=(d.size||0); }); });
  (S.companyFolders||[]).forEach(f=>{ (f.docs||[]).forEach(d=>{ total+=(d.size||0); }); });
  total+=_companyTrashBytes; // çöp 30 gün Storage'da yer kaplar
  return total;
}

/* Bu şirketin çöpteki dosya boyutunu yükle (depolama barı doğru göstersin) */
async function loadCompanyTrashBytes(){
  _companyTrashBytes=0;
  if(!_db || !S.activeCompanyId) return;
  try{
    const snap=await _db.ref(`${TENANT_ROOT}/trash`).once('value');
    if(snap.exists()) snap.forEach(ch=>{
      if(String(ch.key).startsWith('_')) return;
      const v=ch.val()||{};
      if(v.cid===S.activeCompanyId) _companyTrashBytes+=(v.size||0);
    });
  }catch(e){}
}

function getQuotaLimits(){
  const q=S.quotaLimits||{};
  return {
    dbGB: (q.dbGB!=null) ? q.dbGB : FREE_DB_GB,
    storageGB: (q.storageGB!=null) ? q.storageGB : FREE_STORAGE_GB
  };
}

/* Storage'a yükleme izni var mı (kota dolmadıysa) */
function canUploadStorage(addBytes=0){
  const lim=getQuotaLimits();
  const used=estimateStorageBytes()+addBytes;
  return used <= lim.storageGB*1024*1024*1024;
}

const fmtBytes=(b)=>{
  if(b<1024) return b+' B';
  if(b<1024*1024) return (b/1024).toFixed(1)+' KB';
  if(b<1024*1024*1024) return (b/1024/1024).toFixed(1)+' MB';
  return (b/1024/1024/1024).toFixed(2)+' GB';
};

function toast(msg, dur=3500){
  const el=document.getElementById('toast');
  if(!el) return;
  el.textContent=msg;
  el.className='toast show';
  clearTimeout(el._t);
  el._t=setTimeout(()=>el.classList.remove('show'), dur);
}

/* Kalıcı toast (yükleme ilerlemesi gibi) — manuel kapatılana kadar durur */
function showPersistentToast(msg){
  const el=document.getElementById('toast');
  if(!el) return null;
  clearTimeout(el._t);
  el.textContent=msg;
  el.className='toast show';
  return el;
}
function updatePersistentToast(el, msg){ if(el) el.textContent=msg; }
function hidePersistentToast(el){ if(el){ el.classList.remove('show'); } }

/* Haptic — mobilde hafif titreşim (destekleyen cihazlarda) */
function haptic(ms=12){
  try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){}
}

/* Arama kutusundaki × butonunu göster/gizle */
function toggleClear(inp){
  const btn=inp.parentElement?.querySelector('.search-clear');
  if(btn) btn.classList.toggle('show', inp.value.length>0);
}

/* Şık onay modalı — tarayıcının confirm() yerine
   Promise döner: kullanıcı onaylarsa true, iptal ederse false */
function confirmDialog(opts){
  return new Promise(resolve=>{
    const o=typeof opts==='string'?{message:opts}:opts;
    const ov=document.getElementById('modal-confirm');
    document.getElementById('confirm-title').textContent=o.title||'Emin misiniz?';
    document.getElementById('confirm-msg').textContent=o.message||'';
    const okBtn=document.getElementById('confirm-ok');
    const cancelBtn=document.getElementById('confirm-cancel');
    okBtn.textContent=o.okText||'Evet, Devam Et';
    cancelBtn.textContent=o.cancelText||'Vazgeç';
    okBtn.className='btn '+(o.danger?'btn-danger':'btn-primary')+' btn-full';

    const cleanup=()=>{
      ov.classList.remove('open');
      okBtn.onclick=null; cancelBtn.onclick=null;
    };
    okBtn.onclick=()=>{ haptic(15); cleanup(); resolve(true); };
    cancelBtn.onclick=()=>{ cleanup(); resolve(false); };
    ov.classList.add('open');
  });
}

/* Şık metin girişi modalı — tarayıcının prompt() yerine.
   Promise döner: metin (boş olabilir) veya iptal edilirse null */
function promptDialog(opts){
  return new Promise(resolve=>{
    const o=typeof opts==='string'?{message:opts}:opts;
    const ov=document.getElementById('modal-prompt');
    document.getElementById('prompt-title').textContent=o.title||'Giriş';
    document.getElementById('prompt-msg').textContent=o.message||'';
    const inp=document.getElementById('prompt-input');
    const isArea=o.multiline;
    inp.placeholder=o.placeholder||'';
    inp.value=o.value||'';
    const okBtn=document.getElementById('prompt-ok');
    const cancelBtn=document.getElementById('prompt-cancel');
    okBtn.textContent=o.okText||'Tamam';
    cancelBtn.textContent=o.cancelText||'Vazgeç';
    const cleanup=()=>{ ov.classList.remove('open'); okBtn.onclick=null; cancelBtn.onclick=null; };
    okBtn.onclick=()=>{ haptic(12); const v=inp.value; cleanup(); resolve(v); };
    cancelBtn.onclick=()=>{ cleanup(); resolve(null); };
    ov.classList.add('open');
    setTimeout(()=>inp.focus(),100);
  });
}

/* Aktivite logu — kim ne yaptı (admin panelinde görünür) */
function logActivity(type, desc, extra=''){
  const by=S.cur?.fullname||S.cur?.username||'—';
  S.activity.unshift({id:'a'+Date.now()+Math.random().toString(36).slice(2,5), type, by, desc, extra, date:nowStr(), bySuper:!!S.cur?.isSuper});
  if(S.activity.length>300) S.activity=S.activity.slice(0,300);
}

async function clearActivity(){
  if(!isAdmin()) return;
  if(!await confirmDialog({title:'Aktiviteler Silinsin mi?',message:'Tüm aktivite kayıtları kalıcı olarak silinecek.',danger:true,okText:'Evet, Sil'})) return;
  S.activity=[];
  try{ await save(); toast('🧹 Aktiviteler temizlendi'); renderProfile(); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* ── UYGULAMAYI İNDİR (PWA kurulum rehberi) ── */
let _deferredInstallPrompt=null;
window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); _deferredInstallPrompt=e; });

function openInstallGuide(){
  const ua=navigator.userAgent||'';
  const isIOS=/iPad|iPhone|iPod/.test(ua) || (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const isAndroid=/Android/.test(ua);
  const standalone=window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  let html='';
  if(standalone){
    html=`<div style="text-align:center;padding:10px 0">
      <div style="font-size:40px;margin-bottom:10px">✅</div>
      <p style="font-size:14px;color:var(--txt2);line-height:1.6">Uygulama zaten telefonunuza kurulu ve şu an uygulama olarak çalışıyor. 🎉</p>
    </div>`;
  } else if(_deferredInstallPrompt){
    html=`<div style="text-align:center;padding:10px 0">
      <div style="font-size:40px;margin-bottom:10px">📲</div>
      <p style="font-size:14px;color:var(--txt2);line-height:1.6;margin-bottom:18px">Tek dokunuşla TakipEt'i ana ekranınıza ekleyin — tıpkı normal bir uygulama gibi açılır.</p>
      <button class="btn btn-primary btn-full" id="btn-do-install">📥 Şimdi Kur</button>
    </div>`;
  } else if(isIOS){
    html=`<div style="padding:6px 0">
      <div style="text-align:center;font-size:40px;margin-bottom:10px">🍎</div>
      <p style="font-size:14px;color:var(--txt2);line-height:1.7;margin-bottom:14px">iPhone'a kurmak için (Safari'de):</p>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;align-items:center;gap:12px"><span style="background:var(--accent);color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">1</span><span style="font-size:13.5px;color:var(--txt)">Alttaki <strong>Paylaş</strong> butonuna dokunun (kare + yukarı ok ⬆️)</span></div>
        <div style="display:flex;align-items:center;gap:12px"><span style="background:var(--accent);color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">2</span><span style="font-size:13.5px;color:var(--txt)">Menüden <strong>"Ana Ekrana Ekle"</strong> seçin</span></div>
        <div style="display:flex;align-items:center;gap:12px"><span style="background:var(--accent);color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">3</span><span style="font-size:13.5px;color:var(--txt)">Sağ üstte <strong>"Ekle"</strong>ye dokunun</span></div>
      </div>
      <p style="font-size:12px;color:var(--txt3);margin-top:14px;line-height:1.5">💡 Bu adımları görmüyorsanız tarayıcınızın menüsünden "Ana Ekrana Ekle" seçeneğini arayın.</p>
    </div>`;
  } else if(isAndroid){
    html=`<div style="padding:6px 0">
      <div style="text-align:center;font-size:40px;margin-bottom:10px">🤖</div>
      <p style="font-size:14px;color:var(--txt2);line-height:1.7;margin-bottom:14px">Android'e kurmak için (Chrome'da):</p>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;align-items:center;gap:12px"><span style="background:var(--accent);color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">1</span><span style="font-size:13.5px;color:var(--txt)">Sağ üstteki <strong>⋮</strong> (üç nokta) menüsüne dokunun</span></div>
        <div style="display:flex;align-items:center;gap:12px"><span style="background:var(--accent);color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">2</span><span style="font-size:13.5px;color:var(--txt)"><strong>"Uygulamayı yükle"</strong> veya <strong>"Ana ekrana ekle"</strong> seçin</span></div>
        <div style="display:flex;align-items:center;gap:12px"><span style="background:var(--accent);color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">3</span><span style="font-size:13.5px;color:var(--txt)"><strong>"Yükle"</strong>ye dokunun</span></div>
      </div>
    </div>`;
  } else {
    html=`<div style="padding:6px 0">
      <div style="text-align:center;font-size:40px;margin-bottom:10px">💻</div>
      <p style="font-size:14px;color:var(--txt2);line-height:1.7">Bilgisayarda Chrome/Edge kullanıyorsanız, adres çubuğunun sağındaki <strong>kurulum simgesine</strong> tıklayarak uygulamayı kurabilirsiniz.</p>
    </div>`;
  }
  document.getElementById('install-body').innerHTML=html;
  openModal('modal-install');
  const ib=document.getElementById('btn-do-install');
  if(ib) ib.onclick=async()=>{
    if(!_deferredInstallPrompt) return;
    _deferredInstallPrompt.prompt();
    const {outcome}=await _deferredInstallPrompt.userChoice;
    _deferredInstallPrompt=null;
    closeModal('modal-install');
    toast(outcome==='accepted'?'✅ Uygulama kuruluyor':'Kurulum iptal edildi');
  };
}

/* ── VERİ YEDEKLEME (admin) ── */
function backupData(){
  if(!isAdmin()){ toast('🚫 Yetkiniz yok'); return; }
  const payload={
    _meta:{app:'TakipEt', ver:CFG.VER, date:nowStr(), exportedBy:S.cur?.username},
    users:S.users, mahals:S.mahals, equips:S.equips,
    reports:S.reports, logs:S.logs, activity:S.activity,
    notifications:S.notifications, customCats:S.customCats,
    catForms:S.catForms, catOverrides:S.catOverrides, rolePerms:S.rolePerms,
    contactInfo:S.contactInfo, quotaLimits:S.quotaLimits, catPeriods:S.catPeriods,
    customRoles:S.customRoles, catMaintenance:S.catMaintenance, retention:S.retention,
    companyFolders:S.companyFolders, workOrders:S.workOrders,
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`TakipEt-Yedek-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('📥 Yedek indirildi');
}

function triggerRestore(){
  if(!isAdmin()){ toast('🚫 Yetkiniz yok'); return; }
  document.getElementById('restore-file-input')?.click();
}

async function handleRestoreFile(ev){
  const file=ev.target.files[0]; if(!file) return;
  ev.target.value='';
  let data;
  try{
    const text=await file.text();
    data=JSON.parse(text);
  }catch(e){ toast('❌ Dosya okunamadı veya geçersiz'); return; }

  if(!data||!data.users||!Array.isArray(data.users)){
    toast('❌ Geçersiz yedek dosyası'); return;
  }

  const info=data._meta?`${data._meta.date||''} · ${(data.reports||[]).length} rapor · ${(data.equips||[]).length} ekipman`:'';
  const ok=await confirmDialog({
    title:'Yedekten Geri Yükle?',
    message:`MEVCUT TÜM VERİ silinip yedekteki veriyle değiştirilecek. ${info}`,
    danger:true, okText:'Evet, Geri Yükle'
  });
  if(!ok) return;

  // Geri yükle
  S.users        = toArr(data.users);
  S.mahals       = toArr(data.mahals);
  S.equips       = toArr(data.equips);
  S.reports      = toArr(data.reports);
  S.logs         = toArr(data.logs);
  S.activity     = toArr(data.activity);
  S.notifications= toArr(data.notifications);
  S.customCats   = toArr(data.customCats);
  if(data.catForms) S.catForms=data.catForms;
  if(data.catOverrides) S.catOverrides=data.catOverrides;
  if(data.rolePerms) S.rolePerms=data.rolePerms;
  if(data.contactInfo) S.contactInfo=data.contactInfo;
  if(data.quotaLimits) S.quotaLimits=data.quotaLimits;
  if(data.catPeriods) S.catPeriods=data.catPeriods;
  if(data.customRoles) S.customRoles=data.customRoles;
  if(data.catMaintenance) S.catMaintenance=data.catMaintenance;
  if(data.retention) S.retention=data.retention;
  if(data.companyFolders) S.companyFolders=toArr(data.companyFolders);
  if(data.workOrders) S.workOrders=toArr(data.workOrders);
  rebuildCats();
  await ensureSuperAdmin(); // restore sonrası süper admin garanti
  logActivity('restore', `Yedekten geri yüklendi (${S.reports.length} rapor)`);
  try{
    await save();
    toast('✅ Veriler geri yüklendi');
    renderCurrent();
  }catch(e){ toast('❌ '+e.message,5000); }
}

