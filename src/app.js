/**
 * TakipEt v7.0 — Sadece Firebase, LocalStorage YOK
 */
'use strict';

/* ══════════════════════════════════════
   FİREBASE CONFIG (kodda gömülü)
══════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey:           'AIzaSyCzNioHFZ2THtSDtp8JRBXYpLYQg1_X2zQ',
  authDomain:       'takip-et-app.firebaseapp.com',
  databaseURL:      'https://takip-et-app-default-rtdb.europe-west1.firebasedatabase.app',
  projectId:        'takip-et-app',
  storageBucket:    'takip-et-app.firebasestorage.app',
  messagingSenderId:'76177253474',
  appId:            '1:76177253474:web:e3bfc281b31e1a1c949d3b',
};
const APP_CHECK_KEY = '6LcLFC0tAAAAAIFzcIZlOfn5s06_P6gVsJyLYI7K';

/* ══════════════════════════════════════
   SABİTLER
══════════════════════════════════════ */
const CFG = {
  VER:'7.0',
  PHOTOS_ENABLED: false,  // Denetim fotoğrafı özelliği — true yapınca geri açılır
};

const BASE_CATS = [
  {id:'kazan',      name:'Kazan Dairesi',                 icon:'🔥'},
  {id:'jenerator',  name:'Jeneratörler',                  icon:'⚡'},
  {id:'yangin-alg', name:'Yangın Algılama ve Tahliye',    icon:'🚨'},
  {id:'tup-dolap',  name:'Yangın Tüp Dolabı',             icon:'🧯'},
  {id:'yangin-su',  name:'Yangın Su Deposu ve Pompaları', icon:'💧'},
  {id:'elektrik',   name:'Elektrik Panoları',             icon:'🔌'},
];

// CATS = sabit kategoriler + Firebase'den gelen özel kategoriler
let CATS = [...BASE_CATS];
function rebuildCats(){
  // Temel türlere override (ad/ikon) uygula
  const base=BASE_CATS.map(c=>{
    const ov=S.catOverrides&&S.catOverrides[c.id];
    return ov?{...c, name:ov.name||c.name, icon:ov.icon||c.icon}:c;
  });
  CATS = [...base, ...(S.customCats||[])];
}
const isBaseCat = id => BASE_CATS.some(c=>c.id===id);

/* Profilde tür listesi — form düzenle / sil */
function renderCatManageList(){
  const html=CATS.map(c=>{
    const count=S.equips.filter(e=>e.cat===c.id).length;
    const base=isBaseCat(c.id);
    return `<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--brd)">
      <span style="font-size:20px">${c.icon||'📦'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13.5px;font-weight:600;color:var(--txt)">${safe(c.name)}</div>
        <div style="font-size:11px;color:var(--txt3)">${count} ekipman${base?' · varsayılan':''}</div>
      </div>
      <button class="fd-mini" onclick="openEditCat('${c.id}')" title="Ad/ikon düzenle">✏️</button>
      <button class="fd-mini" onclick="openFormDesigner('${c.id}','${jsStr(c.name)}',false)" title="Formu düzenle">🛠️</button>
      ${!base?`<button class="fd-mini fd-del" onclick="deleteCat('${c.id}')" title="Türü sil">🗑️</button>`:''}
    </div>`;
  }).join('');
  // Hem profil (eski) hem tür yöneticisi modalı için
  const a=document.getElementById('cat-manage-list'); if(a) a.innerHTML=html;
  const b=document.getElementById('type-manager-list'); if(b) b.innerHTML=html;
}

/* Süper admin global iletişim bilgilerini kaydet (TÜM giriş ekranlarında görünür) */
async function saveContactInfo(){
  if(!isSuperAdmin()){ toast('🚫 Yetkiniz yok'); return; }
  const tel=document.getElementById('ci-tel')?.value.trim()||'';
  const mail=document.getElementById('ci-mail')?.value.trim()||'';
  S.contactInfo={tel, mail};
  try{
    // Global yere yaz (şirketten bağımsız) — herkes buradan okur
    await _db.ref(`${TENANT_ROOT}/globalContact`).set({tel, mail});
    toast('✅ İletişim bilgileri kaydedildi (tüm şirketler için)');
  }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* Global iletişim bilgisini yükle (giriş/misafir ekranları için) */
async function loadGlobalContact(){
  if(!_db) return;
  try{
    const snap=await _db.ref(`${TENANT_ROOT}/globalContact`).once('value');
    if(snap.exists()){ S.contactInfo=snap.val()||{}; }
  }catch(e){}
}

/* Tür adı + ikon düzenle (temel türler dahil) */
/* Tür ad/ikon/periyot düzenle — sıralı prompt yerine güzel modal (ikon seçici dahil) */
function openEditCat(catId){
  if(!canDo('manage_types')){ toast('🚫 Yetkiniz yok'); return; }
  if(!catById(catId)) return;
  openNewCatModal('company-edit', catId);
}

async function deleteCat(catId){
  if(!canDo('manage_types')){ toast('🚫 Yetkiniz yok'); return; }
  if(isBaseCat(catId)){ toast('⚠️ Varsayılan türler silinemez'); return; }
  const c=catById(catId);
  const count=S.equips.filter(e=>e.cat===catId).length;
  if(count>0){
    toast(`⚠️ Bu türde ${count} ekipman var. Önce onları silin veya türünü değiştirin.`,5000);
    return;
  }
  if(!await confirmDialog({title:'Tür Silinsin mi?',message:`"${c.name}" türü ve denetim formu silinecek.`,danger:true,okText:'Sil'})) return;
  S.customCats=S.customCats.filter(x=>x.id!==catId);
  if(S.catForms) delete S.catForms[catId];
  rebuildCats();
  logActivity('cat_del',`"${c.name}" türü silindi`);
  try{ await save(); populateCatSelects(); renderCatManageList(); toast('🗑️ Tür silindi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

const DEF_CRIT = {
  'kazan':      ['Çalışıyor mu?','Sızıntı var mı?','Periyodik bakım yapıldı mı?','Basınç değerleri normal mi?','Su seviyesi normal mi?'],
  'jenerator':  ['Çalışıyor mu?','Yakıt seviyesi yeterli mi?','Egzoz bağlantısı tam mı?','Akü durumu iyi mi?','Son test yapıldı mı?'],
  'yangin-alg': ['Dedektörler aktif mi?','Tahliye tabelaları var mı?','Acil aydınlatma çalışıyor mu?','Alarm test edildi mi?','Kapı kilitleri çalışıyor mu?'],
  'tup-dolap':  ['Tüpler dolabın içinde mi?','Contalar sağlam mı?','Son kullanma tarihleri geçerli mi?','Manometre basıncı yeterli mi?','Emniyet pimi yerinde mi?'],
  'yangin-su':  ['Su deposu dolu mu?','Pompa çalışıyor mu?','Basınç normal mi?','Hortum hazır mı?','Son test güncel mi?'],
  'elektrik':   ['Pano kapağı kapalı mı?','Yanık izi var mı?','Sigortalar normal mi?','Topraklama yapıldı mı?'],
};

/* ══════════════════════════════════════
   DENETİM FORM MOTORU
   Form = { fields:[ {id,type,label,...} ] }
   Alan tipleri:
   - okfail      : Uygun / Uygun Değil
   - okfailna    : Uygun / Uygun Değil / Yok
   - yesno       : Evet / Hayır (+ hangisi olumsuz)
   - value       : Sayı değeri (+ min/max → aralık dışı uygunsuz)
   - select      : Açılır liste (kendi şıkları, hangileri olumsuz)
   - text        : Serbest metin (sonucu etkilemez)
   - table       : Tablo (sütunlar yine bu tiplerden)
══════════════════════════════════════ */
const FIELD_TYPES = [
  {t:'okfail',   label:'Uygun / Uygun Değil',        icon:'✅'},
  {t:'okfailna', label:'Uygun / Uygun Değil / Yok',  icon:'🔘'},
  {t:'yesno',    label:'Evet / Hayır',               icon:'❓'},
  {t:'qr',       label:'QR ile Onay (okutarak)',     icon:'📷'},
  {t:'value',    label:'Değer Girişi (sayı)',        icon:'🔢'},
  {t:'select',   label:'Açılır Liste (seçenekler)',  icon:'📋'},
  {t:'text',     label:'Serbest Metin',              icon:'✏️'},
  {t:'table',    label:'Tablo',                      icon:'▦'},
];
const fieldTypeLabel = t=>(FIELD_TYPES.find(x=>x.t===t)||{}).label||t;

const fid = ()=>'f'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);

/* Basit kriter listesinden form şeması üret (eski → yeni dönüşüm) */
function critsToForm(crits){
  return { fields:(crits||[]).map(c=>({id:fid(), type:'okfail', label:c, required:true})) };
}

/* Tüp dolabı için hazır tablo formu */
function tupDolapForm(){
  const cKap=fid(), cSkt=fid();
  return { fields:[
    { id:fid(), type:'table', label:'Tüpler', required:true,
      columns:[
        {id:cKap, type:'text',   label:'Kapasite (kg)', fixed:true},
        {id:cSkt, type:'text',   label:'Son Kul. Tarihi', fixed:true},
        {id:fid(), type:'okfail', label:'Basınç Durumu'},
        {id:fid(), type:'yesno',  label:'Sızıntı', negative:'evet'},
        {id:fid(), type:'okfail', label:'Genel Durum'},
      ],
      rows:[
        {id:fid(), label:'Tüp 1', fixed:{[cKap]:'6', [cSkt]:''}},
        {id:fid(), label:'Tüp 2', fixed:{[cKap]:'6', [cSkt]:''}},
      ]
    },
  ]};
}

/* Her tür için varsayılan form şeması */
function defaultFormFor(catId){
  if(catId==='tup-dolap') return tupDolapForm();
  return critsToForm(DEF_CRIT[catId]||[]);
}

/* Bir türün denetim formunu getir — özel kaydedilmişse onu, yoksa varsayılanı */
function getCatForm(catId){
  if(S.catForms && S.catForms[catId]) return JSON.parse(JSON.stringify(S.catForms[catId]));
  return defaultFormFor(catId);
}

/* Bir türün formunu kaydet (o türden yeni eklenenler bunu alır) */
async function setCatForm(catId, form){
  if(!S.catForms) S.catForms={};
  S.catForms[catId]=form;
  await save();
}

/* Bir alanın cevabının "olumsuz" (uygunsuz) olup olmadığını belirle */
function isFieldNegative(field, val){
  if(val===undefined||val===null||val==='') return false;
  switch(field.type){
    case 'okfail':
    case 'okfailna':
      return val==='fail';
    case 'yesno':
      return val===(field.negative||'evet') ? true : false;
    case 'value':{
      const n=parseFloat(val);
      if(isNaN(n)) return false;
      if(field.min!==undefined && field.min!=='' && n<parseFloat(field.min)) return true;
      if(field.max!==undefined && field.max!=='' && n>parseFloat(field.max)) return true;
      return false;
    }
    case 'select':
      return (field.negativeOptions||[]).includes(val);
    default:
      return false;
  }
}

/* Tablo dahil tüm cevaplardan rapor sonucu hesapla: 'ok' | 'fail' | 'pend' */
function computeFormResult(form, answers){
  if(!form||!form.fields||!form.fields.length) return 'pend';
  let answered=0, total=0, anyFail=false;
  for(const f of form.fields){
    if(f.type==='text') continue; // metin sonucu etkilemez
    if(f.type==='table'){
      const rows=answers[f.id]||[];
      for(const row of rows){
        for(const col of (f.columns||[])){
          if(col.type==='text'||col.fixed) continue; // metin ve sabit künye sonucu etkilemez
          total++;
          const v=row[col.id];
          if(v!==undefined&&v!==null&&v!=='') { answered++; if(isFieldNegative(col,v)) anyFail=true; }
        }
      }
      continue;
    }
    total++;
    const v=answers[f.id];
    if(v!==undefined&&v!==null&&v!==''){ answered++; if(isFieldNegative(f,v)) anyFail=true; }
  }
  if(anyFail) return 'fail';
  if(total>0 && answered>=total) return 'ok';
  if(answered>0) return 'pend';
  return 'pend';
}


const ROLE_LEVEL  = {admin:4, manager:3, inspector:2, viewer:1};
const ROLE_LABELS = {admin:'Admin', manager:'Yönetici', inspector:'Denetçi', viewer:'Görüntüleyici'};

/* Tüm roller (sabit + süper admin tarafından eklenen özel roller) */
function allRoles(){
  // {id, label, level, custom} dizisi
  const base=[
    {id:'admin',label:'Admin',level:4,custom:false},
    {id:'manager',label:'Yönetici',level:3,custom:false},
    {id:'inspector',label:'Denetçi',level:2,custom:false},
    {id:'viewer',label:'Görüntüleyici',level:1,custom:false},
  ];
  const custom=Object.entries(S.customRoles||{}).map(([id,r])=>({id,label:r.label,level:r.level||2,custom:true}));
  return base.concat(custom);
}
function roleLabel(role){
  if(ROLE_LABELS[role]) return ROLE_LABELS[role];
  if(S.customRoles&&S.customRoles[role]) return S.customRoles[role].label;
  return role;
}
function roleLevel(role){
  if(ROLE_LEVEL[role]!==undefined) return ROLE_LEVEL[role];
  if(S.customRoles&&S.customRoles[role]) return S.customRoles[role].level||2;
  return 1;
}

// Yetki tanımları (etiket + açıklama)
const PERM_DEFS = [
  {id:'manage_users', label:'Kullanıcı Yönetimi', desc:'Kullanıcı ekle/sil/düzenle, yetki ver'},
  {id:'add_mahal',    label:'Mahal Ekle/Düzenle', desc:'Yeni mahal oluştur, düzenle, kopyala'},
  {id:'del_mahal',    label:'Mahal Sil',          desc:'Mahal ve içindekileri sil'},
  {id:'add_equip',    label:'Ekipman Ekle/Düzenle',desc:'Ekipman ekle, düzenle, form tasarla'},
  {id:'del_equip',    label:'Ekipman Sil',        desc:'Ekipman sil'},
  {id:'inspect',      label:'Denetim Yap',        desc:'Denetim kaydet, rapor oluştur'},
  {id:'manage_types', label:'Tür & Form Yönetimi',desc:'Ekipman türü ve denetim formu düzenle'},
  {id:'delete_report',label:'Rapor Sil',          desc:'Denetim raporu sil'},
  {id:'view_notifications', label:'Bildirim Al',  desc:'Uygunsuzluk/gecikme bildirimleri alır'},
  {id:'maint_warn',   label:'Bakım Uyarısı Al',   desc:'Dış kaynaklı bakım yaklaşınca uyarı alır'},
];

// Varsayılan rol yetkileri (admin tümü; diğerleri kademeli)
const DEFAULT_ROLE_PERMS = {
  admin:     PERM_DEFS.map(p=>p.id),
  manager:   ['add_mahal','add_equip','del_equip','inspect','manage_types','delete_report','view_notifications','maint_warn'],
  inspector: ['inspect','maint_warn'],
  viewer:    [],
};
const MAHAL_ICONS = ['🏨','🏩','🏪','🏬','🏢','🏦','🏥','🏛️','🌴','🏗️','🏭','🏫','🏰','🏟️','⛪','🕌','🏬','🍽️','☕','🏊'];

// Kategori bazlı denetim periyodu (gün) — hatırlatma için
const INSPECT_PERIOD = {
  'kazan':30, 'jenerator':30, 'yangin-alg':30,
  'tup-dolap':90, 'yangin-su':30, 'elektrik':60,
};

// Bildirim alıcısı e-posta (uygunsuzluk maili buraya gider)
const NOTIFY_EMAIL = '';  // Boşsa kullanıcı mail uygulamasında alıcıyı kendi girer

// İletişim e-postası (misafir QR okutunca)
const CONTACT_EMAIL = 'cankonuralp.ck@gmail.com';

// Uygulamanın yayın adresi — QR kodları bu URL'i içerir ki normal telefon kamerası açabilsin
const APP_URL = 'https://cankonuralp.github.io/ekipman-takip/';

// QR içeriğini üret: normal kamera açınca uygulamaya gider (?q=...)
function qrPayload(data){
  return APP_URL + '?q=' + encodeURIComponent(data);
}

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
  notifications: 90,   // bildirimler 3 ay
  logs: 90,            // log/aktivite 3 ay
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
  // (Belgeler ileride Storage ile — ret.documents kullanılacak)

  if(changed){
    try{ await save(); }catch(e){}
  }
}

/* Mevcut DB veri boyutunu tahmin et (byte) */
function estimateDbBytes(){
  try{
    const payload={users:S.users,mahals:S.mahals,equips:S.equips,reports:S.reports,
      logs:S.logs,activity:S.activity,notifications:S.notifications,customCats:S.customCats,
      catForms:S.catForms,catOverrides:S.catOverrides,rolePerms:S.rolePerms};
    return new Blob([JSON.stringify(payload)]).size;
  }catch(e){ return 0; }
}

/* Yüklenen belgelerin toplam boyutu (Storage) — denetim/ekipman eklerindeki dosyalardan */
function estimateStorageBytes(){
  // Gerçek belgeler e.documents[].size'da (ekipman belgeleri) + şirket klasörleri.
  let total=0;
  (S.equips||[]).forEach(e=>{ (e.documents||[]).forEach(d=>{ total+=(d.size||0); }); });
  (S.companyFolders||[]).forEach(f=>{ (f.docs||[]).forEach(d=>{ total+=(d.size||0); }); });
  return total;
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
  rebuildCats();
  await ensureSuperAdmin(); // restore sonrası süper admin garanti
  logActivity('restore', `Yedekten geri yüklendi (${S.reports.length} rapor)`);
  try{
    await save();
    toast('✅ Veriler geri yüklendi');
    renderCurrent();
  }catch(e){ toast('❌ '+e.message,5000); }
}

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
    S.customRoles = d.customRoles ? toArr(d.customRoles) : [];
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
async function loadCompanyStats(){
  if(!_db) return;
  for(const c of S.companies){
    try{
      const snap=await _db.ref(companyDataPath(c.id)).once('value');
      if(snap.exists()){
        const d=snap.val();
        const bytes=new Blob([JSON.stringify(d)]).size;
        // Belge boyutları (storage): ekipman belgeleri + şirket klasörü belgeleri (f.docs)
        let storageBytes=0;
        (toArr(d.equips||[])).forEach(e=>{ (e.documents||[]).forEach(doc=>{ storageBytes+=(doc.size||0); }); });
        (toArr(d.companyFolders||[])).forEach(f=>{ (f.docs||[]).forEach(doc=>{ storageBytes+=(doc.size||0); }); });
        _companyStats[c.id]={
          bytes, storageBytes,
          equips:(toArr(d.equips||[])).length,
          reports:(toArr(d.reports||[])).length,
          mahals:(toArr(d.mahals||[])).length,
          users:(toArr(d.users||[])).length
        };
      } else {
        _companyStats[c.id]={bytes:0,storageBytes:0,equips:0,reports:0,mahals:0,users:0};
      }
    }catch(e){ _companyStats[c.id]={bytes:0,equips:0,reports:0,mahals:0,users:0}; }
  }
  // Yeniden render et (boyutlar geldi)
  renderCompaniesScreen(true);
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
  // Genel evraklar (global) da Storage kotasına dahil
  (_globalDocs.folders||[]).forEach(f=>{ (f.docs||[]).forEach(d=>{ totalStorageBytes+=(d.size||0); }); });
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
/* ══════════════════════════════════════
   İŞ EMİRLERİ (to-do / iş takip)
   Durum akışı: 'open' (atandı) → 'done' (tamamlandı, onay bekliyor) → 'approved' (onaylı, üstü çizili)
══════════════════════════════════════ */
let _woNew=null;   // oluşturma taslağı {id, photos:[]}
let _woDone=null;  // tamamlama taslağı {woId, id, photos:[]}
let _woPhotoTarget=null;

function woStatusBadge(st){
  if(st==='approved') return `<span style="font-size:10.5px;font-weight:700;color:var(--gtxt);background:var(--gbg);padding:3px 8px;border-radius:20px;white-space:nowrap">✔ Onaylı</span>`;
  if(st==='done')     return `<span style="font-size:10.5px;font-weight:700;color:var(--otxt);background:var(--obg);padding:3px 8px;border-radius:20px;white-space:nowrap">⏳ Onay bekliyor</span>`;
  return `<span style="font-size:10.5px;font-weight:700;color:var(--blue-txt);background:var(--blue-bg);padding:3px 8px;border-radius:20px;white-space:nowrap">🔧 Açık</span>`;
}

/* Ana sayfa iş takip paneli */
function renderWorkOrders(){
  const wrap=document.getElementById('workorder-wrap');
  if(!wrap) return;
  const me=S.cur;
  const canCreate = isAdmin() || roleLevel(me?.role)>=2; // denetçi ve üzeri oluşturur
  const seesAll = me?.isSuper || roleLevel(me?.role)>=3;  // yönetici+ tümünü görür
  const visible=(S.workOrders||[]).filter(w=> seesAll || w.byId===me?.id || (w.assignees||[]).includes(me?.id));
  const active=visible.filter(w=>w.status!=='approved').sort((a,b)=>(b.ts||0)-(a.ts||0));
  const done=visible.filter(w=>w.status==='approved').sort((a,b)=>(b.approvedTs||b.ts||0)-(a.approvedTs||a.ts||0));
  wrap.innerHTML=`<div style="background:var(--card);border-radius:14px;overflow:hidden;box-shadow:var(--sh1)">
    <div style="padding:13px 16px;border-bottom:1px solid var(--brd);display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:13.5px;font-weight:700;color:var(--txt)">🗂️ İş Emirleri</span>
      ${visible.length?`<span style="font-size:11px;color:var(--txt3)">${active.length} aktif${done.length?' · '+done.length+' bitti':''}</span>`:''}
    </div>
    <div style="padding:10px 12px">
      ${canCreate?`<button class="btn btn-accent btn-full btn-sm" style="margin-bottom:10px" onclick="openAddWorkOrder()">➕ İş Emri Ekle</button>`:''}
      ${active.length?active.map(w=>woRowHTML(w)).join(''):'<div style="padding:10px 4px;font-size:12.5px;color:var(--txt3);text-align:center">Aktif iş emri yok.</div>'}
      ${done.length?`<div style="font-size:11px;font-weight:700;color:var(--txt3);margin:12px 0 6px;text-transform:uppercase;letter-spacing:.5px">✓ Tamamlanan</div>${done.map(w=>woRowHTML(w)).join('')}`:''}
    </div>
  </div>`;
}
function woRowHTML(w){
  const doneStyle=w.status==='approved';
  const names=(w.assignees||[]).map(id=>{ const u=userById(id); return u?(u.fullname||u.username):'?'; }).join(', ');
  return `<div onclick="openWorkOrderDetail('${w.id}')" style="display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid var(--brd);border-radius:9px;margin-bottom:6px;cursor:pointer;${doneStyle?'opacity:.65':''}">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${doneStyle?'text-decoration:line-through':''}">${safe(w.title)}</div>
      <div style="font-size:11px;color:var(--txt3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${names?('👤 '+safe(names)):'atanmadı'} · ${w.createdAt||''}</div>
    </div>
    ${woStatusBadge(w.status)}
  </div>`;
}

/* Yeni iş emri oluştur */
function openAddWorkOrder(){
  if(!(isAdmin()||roleLevel(S.cur?.role)>=2)){ toast('🚫 Yetkiniz yok'); return; }
  _woNew={ id:'wo'+Date.now()+Math.random().toString(36).slice(2,5), photos:[] };
  document.getElementById('wo-title').textContent='🗂️ Yeni İş Emri';
  renderWoCreateBody();
  openModal('modal-workorder');
}
function renderWoCreateBody(){
  const body=document.getElementById('wo-body'); if(!body) return;
  const members=(S.users||[]).filter(u=>!u.isSuper);
  body.innerHTML=`
    <div class="form-group"><label class="form-label">İŞ / NOT</label>
      <textarea class="form-textarea" id="wo-note" rows="5" placeholder="Yapılacak işi yazın…"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">📷 Fotoğraf <span style="font-weight:400;text-transform:none;color:var(--txt3)">(isteğe bağlı)</span></label>
      <div id="wo-photos" style="display:flex;flex-wrap:wrap;gap:8px;margin:6px 0">${(_woNew.photos||[]).map((u,i)=>woPhotoThumb(u,i,'new')).join('')}</div>
      <button class="btn btn-secondary btn-sm" onclick="woPickPhoto('new')">📷 Fotoğraf Ekle</button>
    </div>
    <div class="form-group">
      <label class="form-label">👥 Kimler görsün / görevli</label>
      <p style="font-size:11.5px;color:var(--txt3);margin-bottom:6px">İşi görecek/yapacak kişileri seçin (seçilenlere bildirim gider).</p>
      <div style="display:flex;flex-direction:column;gap:4px;max-height:30vh;overflow-y:auto">
        ${members.length?members.map(u=>`<label class="perm-item" style="cursor:pointer">
          <input type="checkbox" class="wo-assignee" value="${u.id}"/>
          <div><div class="perm-label">👤 ${safe(u.fullname||u.username)}</div><div class="perm-desc">${roleLabel(u.role)}</div></div>
        </label>`).join(''):'<div style="font-size:12px;color:var(--txt3);padding:8px">Bu şirkette üye yok.</div>'}
      </div>
    </div>
    <button class="btn btn-primary btn-full" style="margin-top:6px" onclick="saveWorkOrder()">✅ İş Emrini Oluştur</button>`;
}
async function saveWorkOrder(){
  const note=(document.getElementById('wo-note')?.value||'').trim();
  if(!note){ toast('⚠️ İş / not yazın'); return; }
  const assignees=[...document.querySelectorAll('.wo-assignee:checked')].map(c=>c.value);
  const wo={ id:_woNew.id, title:note, photos:_woNew.photos||[],
    by:S.cur?.fullname||S.cur?.username||'—', byId:S.cur?.id||null,
    assignees, status:'open', createdAt:nowStr(), ts:Date.now() };
  if(!S.workOrders) S.workOrders=[];
  S.workOrders.unshift(wo);
  try{
    await save();
    closeModal('modal-workorder'); _woNew=null;
    renderWorkOrders();
    toast('✅ İş emri oluşturuldu');
    if(assignees.length){
      await saveNotifSafe({ id:'n'+Date.now(), type:'wo_new', woId:wo.id, toIds:assignees,
        equipName:'🗂️ Yeni İş Emri', mahalName:wo.title, by:wo.by,
        note:`🗂️ Size yeni bir iş emri atandı: "${wo.title}"`, date:nowStr(), ts:Date.now(), readBy:[] });
    }
    updateNotifBell();
  }catch(e){ toast('❌ '+e.message,5000); }
}

/* İş emri detayı */
function openWorkOrderDetail(id){
  const w=(S.workOrders||[]).find(x=>x.id===id); if(!w) return;
  const me=S.cur;
  const isAssignee=(w.assignees||[]).includes(me?.id);
  const isOwner = w.byId===me?.id || isAdmin() || me?.isSuper;
  const names=(w.assignees||[]).map(uid=>{ const u=userById(uid); return u?(u.fullname||u.username):'?'; }).join(', ')||'—';
  const stTxt = w.status==='approved'?'✔ Onaylandı':w.status==='done'?'⏳ Tamamlandı — onay bekliyor':'🔧 Açık';
  document.getElementById('wo-title').textContent='🗂️ İş Emri';
  document.getElementById('wo-body').innerHTML=`
    <div style="font-size:12px;color:var(--txt3);margin-bottom:8px">${stTxt} · ${safe(w.by)} · ${w.createdAt||''}</div>
    <div style="font-size:14px;color:var(--txt);white-space:pre-wrap;background:var(--bg);border-radius:10px;padding:12px;margin-bottom:10px">${safe(w.title)}</div>
    ${(w.photos||[]).length?`<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">${w.photos.map(u=>`<img src="${u}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="window.open('${u}','_blank')"/>`).join('')}</div>`:''}
    <div style="font-size:12.5px;color:var(--txt2);margin-bottom:6px">👤 Görevli: <b>${safe(names)}</b></div>
    ${(w.status==='done'||w.status==='approved')?`<div class="divider"></div>
      <p class="sec-label" style="margin-top:6px">✅ Tamamlama</p>
      <div style="font-size:12px;color:var(--txt3);margin-bottom:6px">${safe(w.doneBy||'')} · ${w.doneAt||''}</div>
      <div style="font-size:14px;color:var(--txt);white-space:pre-wrap;background:var(--gbg);border-radius:10px;padding:12px;margin-bottom:10px">${safe(w.doneNote||'—')}</div>
      ${(w.donePhotos||[]).length?`<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">${w.donePhotos.map(u=>`<img src="${u}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="window.open('${u}','_blank')"/>`).join('')}</div>`:''}
      ${w.status==='approved'?`<div style="font-size:12px;color:var(--gtxt);font-weight:600">👍 ${safe(w.approvedBy||'')} onayladı · ${w.approvedAt||''}</div>`:''}`:''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
      ${(w.status==='open'&&isAssignee)?`<button class="btn btn-primary" style="flex:1" onclick="openCompleteWorkOrder('${w.id}')">✅ İş Tamamlandı</button>`:''}
      ${(w.status==='done'&&isOwner)?`<button class="btn btn-primary" style="flex:1" onclick="approveWorkOrder('${w.id}')">👍 Onayla</button>`:''}
      ${isOwner?`<button class="btn btn-danger btn-sm" onclick="deleteWorkOrder('${w.id}')" title="Sil">🗑️</button>`:''}
    </div>`;
  openModal('modal-workorder');
}

/* İşi tamamla (atanan kişi) */
function openCompleteWorkOrder(id){
  _woDone={ woId:id, id:id, photos:[] };
  document.getElementById('wo-title').textContent='✅ İşi Tamamla';
  renderWoCompleteBody(id);
  openModal('modal-workorder');
}
function renderWoCompleteBody(id){
  const body=document.getElementById('wo-body'); if(!body) return;
  body.innerHTML=`
    <div class="form-group"><label class="form-label">Tamamlama notu</label>
      <textarea class="form-textarea" id="wo-done-note" rows="5" placeholder="Yapılan işi yazın…"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">📷 Fotoğraf <span style="font-weight:400;text-transform:none;color:var(--txt3)">(isteğe bağlı)</span></label>
      <div id="wo-photos" style="display:flex;flex-wrap:wrap;gap:8px;margin:6px 0">${(_woDone.photos||[]).map((u,i)=>woPhotoThumb(u,i,'done')).join('')}</div>
      <button class="btn btn-secondary btn-sm" onclick="woPickPhoto('done')">📷 Fotoğraf Ekle</button>
    </div>
    <button class="btn btn-primary btn-full" onclick="saveCompleteWorkOrder('${id}')">✅ Tamamla</button>`;
}
async function saveCompleteWorkOrder(id){
  const w=(S.workOrders||[]).find(x=>x.id===id); if(!w) return;
  const note=(document.getElementById('wo-done-note')?.value||'').trim();
  if(!note){ toast('⚠️ Tamamlama notu yazın'); return; }
  w.status='done'; w.doneNote=note; w.donePhotos=_woDone.photos||[];
  w.doneBy=S.cur?.fullname||S.cur?.username||'—'; w.doneById=S.cur?.id||null; w.doneAt=nowStr(); w.doneTs=Date.now();
  try{
    await save();
    closeModal('modal-workorder'); _woDone=null;
    renderWorkOrders();
    toast('✅ İş tamamlandı — yönetici onayı bekleniyor');
    if(w.byId){
      await saveNotifSafe({ id:'n'+Date.now(), type:'wo_done', woId:w.id, toIds:[w.byId],
        equipName:'✅ İş Tamamlandı', mahalName:w.title, by:w.doneBy,
        note:`✅ "${w.title}" işi tamamlandı (${w.doneBy}) — onayınızı bekliyor.`, date:nowStr(), ts:Date.now(), readBy:[] });
    }
    updateNotifBell();
  }catch(e){ toast('❌ '+e.message,5000); }
}
/* İşi onayla (oluşturan/yönetici) → üstü çizili "tamamlanan" tarafa geçer */
async function approveWorkOrder(id){
  const w=(S.workOrders||[]).find(x=>x.id===id); if(!w) return;
  w.status='approved'; w.approvedBy=S.cur?.fullname||S.cur?.username||'—'; w.approvedAt=nowStr(); w.approvedTs=Date.now();
  try{
    await save();
    closeModal('modal-workorder'); renderWorkOrders();
    toast('👍 Onaylandı — tamamlananlara taşındı');
    if(w.doneById && w.doneById!==S.cur?.id){
      await saveNotifSafe({ id:'n'+Date.now(), type:'wo_approved', woId:w.id, toIds:[w.doneById],
        equipName:'👍 İş Onaylandı', mahalName:w.title, by:w.approvedBy,
        note:`👍 "${w.title}" işiniz onaylandı.`, date:nowStr(), ts:Date.now(), readBy:[] });
    }
    updateNotifBell();
  }catch(e){ toast('❌ '+e.message,5000); }
}
async function deleteWorkOrder(id){
  const w=(S.workOrders||[]).find(x=>x.id===id); if(!w) return;
  if(!await confirmDialog({title:'İş Emrini Sil',message:`"${safe(w.title)}" iş emri silinecek.`,danger:true,okText:'Sil'})) return;
  S.workOrders=S.workOrders.filter(x=>x.id!==id);
  try{ await save(); closeModal('modal-workorder'); renderWorkOrders(); toast('🗑️ Silindi'); }catch(e){ toast('❌ '+e.message,5000); }
}

/* ── İş emri fotoğrafları (Storage) ── */
function woPickPhoto(target){ _woPhotoTarget=target; const inp=document.getElementById('wo-photo-input'); if(inp){ inp.value=''; inp.click(); } }
function woPhotoThumb(url,i,target){
  return `<div style="position:relative;width:66px;height:66px;border-radius:8px;overflow:hidden;border:1px solid var(--brd)">
    <img src="${url}" style="width:100%;height:100%;object-fit:cover;cursor:pointer" onclick="window.open('${url}','_blank')"/>
    <button onclick="woRemovePhoto(${i},'${target}')" title="Kaldır" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;line-height:1;cursor:pointer">✕</button>
  </div>`;
}
function woRemovePhoto(i,target){
  const draft=target==='new'?_woNew:_woDone; if(!draft) return;
  draft.photos.splice(i,1);
  if(target==='new') renderWoCreateBody(); else renderWoCompleteBody(_woDone.woId);
}
async function onWoPhotoSelected(ev){
  const file=ev.target.files&&ev.target.files[0]; if(!file) return;
  const target=_woPhotoTarget;
  const draft=target==='new'?_woNew:_woDone;
  if(!draft){ return; }
  if(!_storage){ toast('❌ Depolama hazır değil'); return; }
  const t=showPersistentToast('⬆️ Fotoğraf yükleniyor…');
  try{
    let blob=file;
    if((file.type||'').startsWith('image/')){ try{ blob=await compressImage(file); }catch(e){} }
    const cid=S.activeCompanyId||S.cur?.companyId||'_ortak';
    const pid='p'+Date.now()+Math.random().toString(36).slice(2,5);
    const path=`belgeler/${cid}/_workorders/${draft.id||'d'}/${pid}.jpg`;
    const ref=_storage.ref(path);
    await ref.put(blob,{contentType:'image/jpeg'});
    const url=await ref.getDownloadURL();
    if(!draft.photos) draft.photos=[];
    draft.photos.push(url);
    hidePersistentToast(t);
    if(target==='new') renderWoCreateBody(); else renderWoCompleteBody(_woDone.woId);
    toast('✅ Fotoğraf eklendi');
  }catch(e){ hidePersistentToast(t); toast('❌ Yüklenemedi: '+(e.message||''),5000); }
}

/* ── ŞİRKET BELGE AĞACI (ana sayfa sağ) ──
   Otomatik dosyalama: ekipmana belge eklenince Mahal>Ekipman>Tür yapısında saklanır
   + manuel klasör/belge */
function renderCompanyDocs(){
  const wrap=document.getElementById('company-docs-wrap');
  if(!wrap) return;
  // Otomatik ağaç: mahallere göre grupla → ekipman belgeleri
  const tree=buildCompanyDocTree();
  wrap.innerHTML=`
    <div style="background:var(--bg);border:1px solid var(--brd);border-radius:14px;overflow:hidden">
      <div style="padding:13px 15px;border-bottom:1px solid var(--brd);display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:13.5px;font-weight:700;color:var(--txt)">📁 Belgeler</span>
        <button class="doc-mini-btn" onclick="addCompanyFolder()" title="Klasör Ekle" style="font-size:15px">➕</button>
      </div>
      <div style="padding:8px;max-height:60vh;overflow-y:auto">
        ${tree.length?tree.map(node=>renderDocNode(node,0)).join(''):'<div style="padding:20px;text-align:center;color:var(--txt3);font-size:12px">Henüz belge yok.<br>Ekipmanlara belge ekleyince otomatik dosyalanır.</div>'}
      </div>
    </div>`;
}

/* Belge ağacını kur: otomatik (mahal>ekipman) + manuel klasörler */
function buildCompanyDocTree(){
  const nodes=[];
  // Otomatik: her mahal → ekipmanları → belgeleri
  (S.mahals||[]).forEach(m=>{
    const equipsWithDocs=(S.equips||[]).filter(e=>e.mahalId===m.id && (e.documents||[]).length>0);
    if(!equipsWithDocs.length) return;
    const mahalNode={ id:'auto_m_'+m.id, name:m.name, icon:'🏢', auto:true, children:[], open:_docTreeOpen['auto_m_'+m.id] };
    equipsWithDocs.forEach(e=>{
      const catName=(catById(e.cat)||{}).name||'Diğer';
      const eqNode={ id:'auto_e_'+e.id, name:e.name+' · '+catName, icon:'🔧', auto:true, docs:(e.documents||[]).map(d=>({...d, _equipId:e.id})), open:_docTreeOpen['auto_e_'+e.id] };
      mahalNode.children.push(eqNode);
    });
    nodes.push(mahalNode);
  });
  // Manuel klasörler
  (S.companyFolders||[]).forEach(f=>{
    nodes.push({ id:'man_'+f.id, name:f.name, icon:'📁', manual:true, folderId:f.id, docs:f.docs||[], open:_docTreeOpen['man_'+f.id] });
  });
  return nodes;
}

function renderDocNode(node, depth){
  const open=!!node.open;
  const hasChildren=(node.children&&node.children.length)||(node.docs&&node.docs.length);
  const pad=depth*16;
  let html=`
    <div class="doc-tree-folder">
      <div class="doc-tree-row" style="padding-left:${9+pad}px" onclick="toggleDocNode('${node.id}')">
        <span class="doc-tree-chevron ${open?'open':''}">▶</span>
        <span style="font-size:15px">${open?'📂':(node.icon||'📁')}</span>
        <span style="flex:1;font-size:12.5px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(node.name)}</span>
        ${node.manual?`<button class="doc-mini-btn" onclick="event.stopPropagation();renameCompanyFolder('${node.folderId}')" title="Yeniden Adlandır" style="font-size:13px">✏️</button>
        <button class="doc-mini-btn" onclick="event.stopPropagation();uploadToCompanyFolder('${node.folderId}')" title="Belge Yükle" style="font-size:13px">⬆️</button>
        <button class="doc-mini-btn" onclick="event.stopPropagation();deleteCompanyFolder('${node.folderId}')" title="Sil" style="font-size:13px">🗑️</button>`:''}
      </div>`;
  if(open){
    // Alt klasörler (ekipmanlar)
    if(node.children){ node.children.forEach(ch=>{ html+=renderDocNode(ch, depth+1); }); }
    // Belgeler
    if(node.docs){
      node.docs.forEach(d=>{
        html+=`<div class="doc-tree-row" style="padding-left:${9+pad+20}px">
          <span style="font-size:13px">${d.type==='application/pdf'?'📄':'🖼️'}</span>
          <span style="flex:1;font-size:12px;color:var(--txt2);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" onclick="window.open('${d.url}','_blank')">${safe(d.name)}</span>
          ${node.manual?`<button class="doc-mini-btn" onclick="moveCompanyDoc('${node.folderId}','${d.id}')" title="Başka klasöre taşı" style="font-size:12px">➡️</button>
          <button class="doc-mini-btn" onclick="deleteCompanyDoc('${node.folderId}','${d.id}')" title="Sil" style="font-size:12px">🗑️</button>`:''}
        </div>`;
      });
    }
    // Manuel klasöre net "Belge Ekle" butonu
    if(node.manual){
      html+=`<div style="padding:4px 0 4px ${9+pad+20}px"><button class="btn btn-secondary btn-sm" style="width:calc(100% - 10px);justify-content:center" onclick="uploadToCompanyFolder('${node.folderId}')">📎 Belge Ekle</button></div>`;
    }
  }
  html+=`</div>`;
  return html;
}

function toggleDocNode(id){ _docTreeOpen[id]=!_docTreeOpen[id]; renderCompanyDocs(); }

async function addCompanyFolder(){
  const name=await promptDialog({title:'Yeni Klasör',message:'Klasör adı:',placeholder:'örn: Genel Belgeler',okText:'Oluştur'});
  if(name===null||!name.trim()) return;
  if(!S.companyFolders) S.companyFolders=[];
  S.companyFolders.push({ id:'cf'+Date.now(), name:name.trim(), docs:[] });
  try{ await save(); renderCompanyDocs(); toast('✅ Klasör oluşturuldu'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

async function deleteCompanyFolder(fid){
  const f=(S.companyFolders||[]).find(x=>x.id===fid); if(!f) return;
  if(!await confirmDialog({title:'Klasörü Sil',message:`"${safe(f.name)}" ve içindeki ${(f.docs||[]).length} belge silinecek.`,danger:true,okText:'Sil'})) return;
  for(const d of (f.docs||[])){ try{ if(d.path) await _storage.ref(d.path).delete(); }catch(e){} }
  S.companyFolders=S.companyFolders.filter(x=>x.id!==fid);
  try{ await save(); renderCompanyDocs(); toast('🗑️ Silindi'); }catch(e){ toast('❌ '+e.message); }
}

/* Klasör adını değiştir (şirket manuel klasörü) */
async function renameCompanyFolder(fid){
  const f=(S.companyFolders||[]).find(x=>x.id===fid); if(!f) return;
  const name=await promptDialog({title:'Klasör Adını Değiştir',message:'Yeni klasör adı:',value:f.name,okText:'Kaydet'});
  if(name===null||!name.trim()) return;
  f.name=name.trim();
  try{ await save(); renderCompanyDocs(); toast('✅ Klasör adı güncellendi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* Basit klasör seçici → seçilen klasör id'sini döndürür (gmodal) */
function pickFolderDialog(title, folders){
  return new Promise(resolve=>{
    const body=document.getElementById('gmodal-body');
    document.getElementById('gmodal-title').textContent=title||'Klasör Seç';
    body.innerHTML=`<div style="display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow-y:auto">
      ${folders.map(f=>`<button class="btn btn-secondary btn-full" style="justify-content:flex-start" onclick="window._pickFolder('${f.id}')">📁 ${safe(f.name)}</button>`).join('')}
    </div>`;
    window._pickFolder=(id)=>{ closeModal('gmodal'); delete window._pickFolder; resolve(id); };
    openModal('gmodal');
  });
}

/* Belgeyi başka klasöre taşı (şirket manuel klasörleri arası) */
async function moveCompanyDoc(fromFid, docId){
  const from=(S.companyFolders||[]).find(x=>x.id===fromFid); if(!from) return;
  const doc=(from.docs||[]).find(d=>d.id===docId); if(!doc) return;
  const targets=(S.companyFolders||[]).filter(x=>x.id!==fromFid);
  if(!targets.length){ toast('⚠️ Taşınacak başka klasör yok — önce klasör ekleyin'); return; }
  const toId=await pickFolderDialog('📁 Hangi klasöre taşınsın?', targets);
  if(!toId) return;
  const to=S.companyFolders.find(x=>x.id===toId); if(!to) return;
  from.docs=(from.docs||[]).filter(d=>d.id!==docId);
  if(!to.docs) to.docs=[];
  to.docs.unshift(doc);
  try{ await save(); renderCompanyDocs(); toast('✅ Belge taşındı: '+to.name); }
  catch(e){ toast('❌ '+e.message,5000); }
}

let _companyUploadFolder=null;
function uploadToCompanyFolder(fid){
  _companyUploadFolder=fid;
  const input=document.getElementById('company-doc-input');
  if(input){ input.value=''; input.click(); }
}

async function onCompanyDocSelected(ev){
  const file=ev.target.files&&ev.target.files[0];
  if(!file||!_companyUploadFolder) return;
  const fid=_companyUploadFolder; _companyUploadFolder=null;
  const f=(S.companyFolders||[]).find(x=>x.id===fid); if(!f) return;
  if(file.size>3*1024*1024){ toast('⚠️ Dosya 3MB\'tan büyük olamaz'); return; }
  if(!_storage){ toast('❌ Depolama hazır değil'); return; }
  const t=showPersistentToast('⬆️ Yükleniyor… %0');
  try{
    const ext=file.type==='application/pdf'?'pdf':(file.type.split('/')[1]||'bin');
    const docId='cd'+Date.now()+Math.random().toString(36).slice(2,6);
    const cid=S.activeCompanyId||S.cur?.companyId||'_ortak';
    const path=`belgeler/${cid}/_folders/${fid}/${docId}.${ext}`;
    const ref=_storage.ref(path);
    const task=ref.put(file,{contentType:file.type});
    await new Promise((res,rej)=>{ task.on('state_changed', s=>{ updatePersistentToast(t,`⬆️ Yükleniyor… %${Math.round(s.bytesTransferred/s.totalBytes*100)}`); }, rej, res); });
    const url=await ref.getDownloadURL();
    if(!f.docs) f.docs=[];
    f.docs.push({ id:docId, name:file.name, type:file.type, path, url, size:(file.size||0), ts:Date.now() });
    await save();
    hidePersistentToast(t);
    renderCompanyDocs();
    try{ renderFbUsage(); }catch(e){}   // depolama barını hemen güncelle
    toast('✅ Belge yüklendi');
  }catch(e){ hidePersistentToast(t); toast('❌ Yükleme başarısız: '+(e.message||''),5000); }
}

async function deleteCompanyDoc(fid, docId){
  const f=(S.companyFolders||[]).find(x=>x.id===fid); if(!f) return;
  const d=(f.docs||[]).find(x=>x.id===docId); if(!d) return;
  if(!await confirmDialog({title:'Belgeyi Sil',message:`"${safe(d.name)}" silinecek.`,danger:true,okText:'Sil'})) return;
  try{ if(d.path) await _storage.ref(d.path).delete(); }catch(e){}
  f.docs=f.docs.filter(x=>x.id!==docId);
  try{ await save(); renderCompanyDocs(); toast('🗑️ Silindi'); }catch(e){ toast('❌ '+e.message); }
}



async function loadGlobalDocs(){
  if(!_db) return;
  try{
    const snap=await _db.ref(`${TENANT_ROOT}/globalDocs`).once('value');
    if(snap.exists()){ const d=snap.val(); _globalDocs={ folders:toArr(d.folders||[]) }; }
  }catch(e){}
}

async function saveGlobalDocs(){
  if(!_db) return;
  await _db.ref(`${TENANT_ROOT}/globalDocs`).set({ folders:_globalDocs.folders||[], updatedAt:Date.now() });
}

function renderGlobalDocs(){
  const wrap=document.getElementById('global-docs-wrap');
  if(!wrap) return;
  const folders=_globalDocs.folders||[];
  wrap.innerHTML=`
    <div style="background:var(--bg);border:1px solid var(--brd);border-radius:14px;overflow:hidden">
      <div style="padding:13px 16px;border-bottom:1px solid var(--brd);display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:13.5px;font-weight:700;color:var(--txt)">📁 Genel Evraklar</span>
        <button class="doc-mini-btn" onclick="addGlobalFolder()" title="Klasör Ekle" style="font-size:16px">➕</button>
      </div>
      <div style="padding:8px">
        ${folders.length?folders.map(f=>renderGlobalFolder(f)).join(''):'<div style="padding:18px;text-align:center;color:var(--txt3);font-size:12.5px">Henüz klasör yok. ➕ ile ekleyin.</div>'}
      </div>
    </div>`;
}

function renderGlobalFolder(f){
  const open=!!_globalDocOpen[f.id];
  const docs=f.docs||[];
  return `
    <div style="margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:8px;cursor:pointer;background:${open?'var(--bg2)':'transparent'}" onclick="toggleGlobalFolder('${f.id}')">
        <span style="font-size:13px;color:var(--txt3);display:inline-block;transform:rotate(${open?'90':'0'}deg);transition:transform .15s">▶</span>
        <span style="font-size:16px">${open?'📂':'📁'}</span>
        <span style="flex:1;font-size:13px;font-weight:600;color:var(--txt)">${safe(f.name)}</span>
        <span style="font-size:11px;color:var(--txt3)">${docs.length}</span>
        <button class="doc-mini-btn" onclick="event.stopPropagation();renameGlobalFolder('${f.id}')" title="Yeniden Adlandır">✏️</button>
        <button class="doc-mini-btn" onclick="event.stopPropagation();uploadToGlobalFolder('${f.id}')" title="Belge Yükle">⬆️</button>
        <button class="doc-mini-btn" onclick="event.stopPropagation();deleteGlobalFolder('${f.id}')" title="Sil">🗑️</button>
      </div>
      ${open?`<div style="padding:2px 0 6px 30px">
        ${docs.length?docs.map(d=>`
          <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px">
            <span style="font-size:14px">${d.type==='application/pdf'?'📄':'🖼️'}</span>
            <span style="flex:1;font-size:12.5px;color:var(--txt2);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" onclick="window.open('${d.url}','_blank')">${safe(d.name)}</span>
            <button class="doc-mini-btn" onclick="sendGlobalDocToCompany('${f.id}','${d.id}')" title="Şirkete Gönder" style="font-size:13px">📤</button>
            <button class="doc-mini-btn" onclick="deleteGlobalDoc('${f.id}','${d.id}')" title="Sil" style="font-size:13px">🗑️</button>
          </div>`).join(''):'<div style="padding:8px 10px;font-size:12px;color:var(--txt3)">Boş klasör</div>'}
        <button class="btn btn-secondary btn-sm" style="margin-top:6px;width:100%;justify-content:center" onclick="uploadToGlobalFolder('${f.id}')">📎 Belge Ekle</button>
      </div>`:''}
    </div>`;
}

async function addGlobalFolder(){
  const name=await promptDialog({title:'Yeni Klasör',message:'Klasör adı:',placeholder:'örn: Sözleşmeler',okText:'Oluştur'});
  if(name===null||!name.trim()) return;
  if(!_globalDocs.folders) _globalDocs.folders=[];
  _globalDocs.folders.push({ id:'gf'+Date.now(), name:name.trim(), open:true, docs:[] });
  try{ await saveGlobalDocs(); renderGlobalDocs(); toast('✅ Klasör oluşturuldu'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* Genel evrak klasörünün adını değiştir */
async function renameGlobalFolder(fid){
  const f=(_globalDocs.folders||[]).find(x=>x.id===fid); if(!f) return;
  const name=await promptDialog({title:'Klasör Adını Değiştir',message:'Yeni klasör adı:',value:f.name,okText:'Kaydet'});
  if(name===null||!name.trim()) return;
  f.name=name.trim();
  try{ await saveGlobalDocs(); renderGlobalDocs(); toast('✅ Klasör adı güncellendi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* Çoklu şirket seçici (checkbox + Tümünü Seç, tema uyumlu) → seçilen cid dizisini döndürür */
function pickCompaniesMultiDialog(title){
  return new Promise(resolve=>{
    const body=document.getElementById('gmodal-body');
    document.getElementById('gmodal-title').textContent=title||'Şirket Seç';
    const list=S.companies.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','tr'));
    body.innerHTML=`
      <label class="perm-item" style="cursor:pointer;background:var(--bg2);border-color:var(--accent)">
        <input type="checkbox" id="pick-all-comp" onchange="document.querySelectorAll('.pick-comp').forEach(c=>c.checked=this.checked)"/>
        <div><div class="perm-label">✔️ Tümünü Seç</div><div class="perm-desc">${list.length} şirket</div></div>
      </label>
      <div style="display:flex;flex-direction:column;gap:4px;max-height:45vh;overflow-y:auto;margin-top:8px">
        ${list.map(c=>`<label class="perm-item" style="cursor:pointer">
          <input type="checkbox" class="pick-comp" value="${c.id}"/>
          <div><div class="perm-label">🏢 ${safe(c.name)}</div></div>
        </label>`).join('')}
      </div>
      <button class="btn btn-primary btn-full" style="margin-top:14px" onclick="window._pickCompaniesDone&&window._pickCompaniesDone()">📤 Seçilenlere Gönder</button>`;
    window._pickCompaniesDone=()=>{
      const ids=[...document.querySelectorAll('.pick-comp:checked')].map(c=>c.value);
      if(!ids.length){ toast('⚠️ En az bir şirket seçin'); return; }
      closeModal('gmodal'); delete window._pickCompaniesDone; resolve(ids);
    };
    openModal('gmodal');
  });
}

/* Genel evrağı seçilen ŞİRKET(LER)E gönder → her birinde "Gelenler" klasörüne düşer.
   Dosya Storage'da kalır; şirkete sadece referans (url/path) eklenir. */
async function sendGlobalDocToCompany(fid, docId){
  const f=(_globalDocs.folders||[]).find(x=>x.id===fid); if(!f) return;
  const doc=(f.docs||[]).find(d=>d.id===docId); if(!doc) return;
  if(!S.companies.length){ toast('⚠️ Şirket yok'); return; }
  const cids=await pickCompaniesMultiDialog('📤 Hangi şirket(ler)e gönderilsin?');
  if(!cids||!cids.length) return;
  showLoading(true);
  let sent=0;
  try{
    for(const cid of cids){
      const ref=_db.ref(companyDataPath(cid)+'/companyFolders');
      const snap=await ref.get();
      let folders=snap.exists()?snap.val():[];
      if(folders && !Array.isArray(folders)) folders=Object.values(folders);
      if(!Array.isArray(folders)) folders=[];
      let inbox=folders.find(x=>x && x.name==='Gelenler');
      if(!inbox){ inbox={id:'cf'+Date.now()+Math.random().toString(36).slice(2,4), name:'Gelenler', docs:[]}; folders.push(inbox); }
      if(!Array.isArray(inbox.docs)) inbox.docs=[];
      inbox.docs.unshift({ id:'cd'+Date.now()+Math.random().toString(36).slice(2,5),
        name:doc.name, type:doc.type, path:doc.path, url:doc.url, size:doc.size||0, ts:Date.now(), fromGlobal:true });
      await ref.set(folders);
      sent++;
    }
    showLoading(false);
    toast(`✅ "${doc.name}" → ${sent} şirkete gönderildi (Gelenler)`);
    logSuperActivity('doc_push', `Genel evrak "${doc.name}" → ${sent} şirkete gönderildi`);
  }catch(e){ showLoading(false); toast('❌ Gönderilemedi: '+(e.message||''),5000); }
}

function toggleGlobalFolder(fid){
  _globalDocOpen[fid]=!_globalDocOpen[fid];
  renderGlobalDocs();
}

async function deleteGlobalFolder(fid){
  const f=(_globalDocs.folders||[]).find(x=>x.id===fid);
  if(!f) return;
  if(!await confirmDialog({title:'Klasörü Sil',message:`"${safe(f.name)}" klasörü ve içindeki ${(f.docs||[]).length} belge silinecek.`,danger:true,okText:'Sil'})) return;
  for(const d of (f.docs||[])){ try{ if(d.path) await _storage.ref(d.path).delete(); }catch(e){} }
  _globalDocs.folders=_globalDocs.folders.filter(x=>x.id!==fid);
  try{ await saveGlobalDocs(); renderGlobalDocs(); toast('🗑️ Klasör silindi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

let _uploadTargetFolder=null;
function uploadToGlobalFolder(fid){
  _uploadTargetFolder=fid;
  const input=document.getElementById('global-doc-input');
  if(input){ input.value=''; input.click(); }
}

async function onGlobalDocSelected(ev){
  const file=ev.target.files&&ev.target.files[0];
  if(!file||!_uploadTargetFolder) return;
  const fid=_uploadTargetFolder; _uploadTargetFolder=null;
  const f=(_globalDocs.folders||[]).find(x=>x.id===fid);
  if(!f) return;
  if(file.size>3*1024*1024){ toast('⚠️ Dosya 3MB\'tan büyük olamaz'); return; }
  if(!_storage){ toast('❌ Depolama hazır değil'); return; }
  const t=showPersistentToast('⬆️ Yükleniyor… %0');
  try{
    const ext=file.type==='application/pdf'?'pdf':(file.type.split('/')[1]||'bin');
    const docId='gd'+Date.now()+Math.random().toString(36).slice(2,6);
    const path=`belgeler/_global/${fid}/${docId}.${ext}`;
    const ref=_storage.ref(path);
    const task=ref.put(file,{contentType:file.type});
    await new Promise((res,rej)=>{ task.on('state_changed', s=>{ updatePersistentToast(t,`⬆️ Yükleniyor… %${Math.round(s.bytesTransferred/s.totalBytes*100)}`); }, rej, res); });
    const url=await ref.getDownloadURL();
    if(!f.docs) f.docs=[];
    f.docs.push({ id:docId, name:file.name, type:file.type, path, url, size:(file.size||0), ts:Date.now() });
    await saveGlobalDocs();
    hidePersistentToast(t);
    renderGlobalDocs();
    toast('✅ Belge yüklendi');
  }catch(e){ hidePersistentToast(t); toast('❌ Yükleme başarısız: '+(e.message||''),5000); }
}

async function deleteGlobalDoc(fid, docId){
  const f=(_globalDocs.folders||[]).find(x=>x.id===fid);
  if(!f) return;
  const d=(f.docs||[]).find(x=>x.id===docId);
  if(!d) return;
  if(!await confirmDialog({title:'Belgeyi Sil',message:`"${safe(d.name)}" silinecek.`,danger:true,okText:'Sil'})) return;
  try{ if(d.path) await _storage.ref(d.path).delete(); }catch(e){}
  f.docs=f.docs.filter(x=>x.id!==docId);
  try{ await saveGlobalDocs(); renderGlobalDocs(); toast('🗑️ Belge silindi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* ── OTOMATİK YEDEKLEME SİSTEMİ (süper admin) ──
   takipet/backups/system → tüm sistemin son 5 yedeği
   takipet/backups/company/{cid} → her şirketin son 5 yedeği
   takipet/backups/mahal/{cid}/{mahalId} → mahal yedekleri */
const MAX_BACKUPS=5;

/* Bir şirketin verisinin yedeğini al */
async function backupCompany(cid){
  if(!_db) return null;
  try{
    const snap=await _db.ref(companyDataPath(cid)).once('value');
    const data=snap.exists()?snap.val():{};
    const backup={ ts:Date.now(), at:nowStr(), cid, data };
    const ref=_db.ref(`${TENANT_ROOT}/backups/company/${cid}`);
    await ref.push(backup);
    await trimBackups(ref);
    return backup;
  }catch(e){ console.warn('backupCompany:', e.message); return null; }
}

/* Tüm sistemin yedeğini al (tüm şirketler + global) */
async function backupSystem(){
  if(!_db) return null;
  try{
    const snap=await _db.ref(TENANT_ROOT).once('value');
    const full=snap.exists()?snap.val():{};
    // backups'ın kendisini yedeğe dahil etme (sonsuz büyümesin)
    const data={...full}; delete data.backups;
    const backup={ ts:Date.now(), at:nowStr(), data };
    const ref=_db.ref(`${TENANT_ROOT}/backups/system`);
    await ref.push(backup);
    await trimBackups(ref);
    return backup;
  }catch(e){ console.warn('backupSystem:', e.message); return null; }
}

/* Eski yedekleri buda (sadece son MAX_BACKUPS kalsın) */
async function trimBackups(ref){
  try{
    const snap=await ref.once('value');
    if(!snap.exists()) return;
    const entries=[];
    snap.forEach(ch=>{ entries.push({key:ch.key, ts:ch.val().ts||0}); });
    entries.sort((a,b)=>b.ts-a.ts);
    for(let i=MAX_BACKUPS;i<entries.length;i++){ await ref.child(entries[i].key).remove(); }
  }catch(e){}
}

/* Bir şirketi son yedeğine geri yükle */
async function restoreCompanyLatest(cid){
  const c=S.companies.find(x=>x.id===cid);
  if(!c){ toast('❌ Şirket bulunamadı'); return; }
  if(!await confirmDialog({title:'Son Yedeğe Geri Yükle',message:`"${safe(c.name)}" şirketi SON YEDEĞE geri yüklenecek. Mevcut veri yedekteki ile değiştirilecek. Devam edilsin mi?`,danger:true,okText:'Geri Yükle'})) return;
  showLoading(true);
  try{
    const snap=await _db.ref(`${TENANT_ROOT}/backups/company/${cid}`).once('value');
    if(!snap.exists()){ showLoading(false); toast('⚠️ Bu şirkete ait yedek yok'); return; }
    let latest=null;
    snap.forEach(ch=>{ const v=ch.val(); if(!latest||(v.ts||0)>(latest.ts||0)) latest=v; });
    if(!latest||!latest.data){ showLoading(false); toast('⚠️ Geçerli yedek bulunamadı'); return; }
    await _db.ref(companyDataPath(cid)).set(latest.data);
    showLoading(false);
    toast(`✅ "${c.name}" geri yüklendi (${latest.at})`);
    logSuperActivity('restore_company', `${c.name} son yedeğe geri yüklendi`);
  }catch(e){ showLoading(false); toast('❌ '+e.message,5000); }
}

/* Sistem yedeğinden bir şirketin son yedek verisini bul */
async function getCompanyBackupData(cid){
  // Önce şirkete özel yedek varsa onu kullan
  try{
    const cSnap=await _db.ref(`${TENANT_ROOT}/backups/company/${cid}`).once('value');
    if(cSnap.exists()){
      let latest=null;
      cSnap.forEach(ch=>{ const v=ch.val(); if(!latest||(v.ts||0)>(latest.ts||0)) latest=v; });
      if(latest&&latest.data) return latest.data;
    }
  }catch(e){}
  // Yoksa sistem yedeğinden o şirketin verisini çıkar
  try{
    const sSnap=await _db.ref(`${TENANT_ROOT}/backups/system`).once('value');
    if(sSnap.exists()){
      let latest=null;
      sSnap.forEach(ch=>{ const v=ch.val(); if(!latest||(v.ts||0)>(latest.ts||0)) latest=v; });
      if(latest&&latest.data&&latest.data.data&&latest.data.data[cid]) return latest.data.data[cid];
    }
  }catch(e){}
  return null;
}

/* Tek MAHAL geri yükle — sadece o mahalı (diğer mahallere dokunma) */
async function restoreMahal(cid, mahalId){
  const bData=await getCompanyBackupData(cid);
  if(!bData){ toast('⚠️ Bu şirkete ait yedek bulunamadı'); return; }
  const mahals=toArr(bData.mahals||[]);
  const backupMahal=mahals.find(m=>m&&m.id===mahalId);
  if(!backupMahal){ toast('⚠️ Bu mahal yedekte yok'); return; }
  const mName=backupMahal.name||'mahal';
  if(!await confirmDialog({title:'Mahalı Geri Yükle',message:`Sadece "${safe(mName)}" mahalı son yedeğe döndürülecek. Bu mahala ait ekipmanlar ve raporlar da yedekteki haline döner. Diğer mahaller etkilenmez. Devam?`,danger:true,okText:'Geri Yükle'})) return;
  showLoading(true);
  try{
    // Mevcut canlı veriyi al
    const liveSnap=await _db.ref(companyDataPath(cid)).once('value');
    const live=liveSnap.exists()?liveSnap.val():{};
    const liveMahals=toArr(live.mahals||[]);
    const liveEquips=toArr(live.equips||[]);
    const liveReports=toArr(live.reports||[]);
    const bEquips=toArr(bData.equips||[]);
    const bReports=toArr(bData.reports||[]);
    // 1) Mahalı değiştir (yoksa ekle)
    const mi=liveMahals.findIndex(m=>m&&m.id===mahalId);
    if(mi>=0) liveMahals[mi]=backupMahal; else liveMahals.push(backupMahal);
    // 2) Bu mahala ait ekipmanları yedektekiyle değiştir
    const otherEquips=liveEquips.filter(e=>e&&e.mahalId!==mahalId);
    const restoredEquips=bEquips.filter(e=>e&&e.mahalId===mahalId);
    const newEquips=[...otherEquips, ...restoredEquips];
    const restoredEquipIds=new Set(restoredEquips.map(e=>e.id));
    // 3) Bu mahalın ekipmanlarına ait raporları yedektekiyle değiştir
    const otherReports=liveReports.filter(r=>r&&!restoredEquipIds.has(r.equipId));
    const restoredReports=bReports.filter(r=>r&&restoredEquipIds.has(r.equipId));
    const newReports=[...otherReports, ...restoredReports];
    // Yaz
    await _db.ref(`${companyDataPath(cid)}/mahals`).set(liveMahals);
    await _db.ref(`${companyDataPath(cid)}/equips`).set(newEquips);
    await _db.ref(`${companyDataPath(cid)}/reports`).set(newReports);
    showLoading(false);
    toast(`✅ "${mName}" mahalı geri yüklendi`);
    logSuperActivity('restore_mahal', `${mName} mahalı geri yüklendi`);
  }catch(e){ showLoading(false); toast('❌ '+e.message,5000); }
}

/* Tek ÜYE geri yükle — sadece o üyeyi (diğer üyelere dokunma) */
async function restoreUser(cid, userId){
  const bData=await getCompanyBackupData(cid);
  if(!bData){ toast('⚠️ Bu şirkete ait yedek bulunamadı'); return; }
  const users=toArr(bData.users||[]);
  const backupUser=users.find(u=>u&&u.id===userId);
  if(!backupUser){ toast('⚠️ Bu üye yedekte yok'); return; }
  const uName=backupUser.fullname||backupUser.username||'üye';
  if(!await confirmDialog({title:'Üyeyi Geri Yükle',message:`Sadece "${safe(uName)}" üyesi son yedeğe döndürülecek (rol, yetki, şifre dahil). Diğer üyeler etkilenmez. Devam?`,danger:true,okText:'Geri Yükle'})) return;
  showLoading(true);
  try{
    const liveSnap=await _db.ref(`${companyDataPath(cid)}/users`).once('value');
    const liveUsers=liveSnap.exists()?toArr(liveSnap.val()):[];
    const ui=liveUsers.findIndex(u=>u&&u.id===userId);
    if(ui>=0) liveUsers[ui]=backupUser; else liveUsers.push(backupUser);
    await _db.ref(`${companyDataPath(cid)}/users`).set(liveUsers);
    showLoading(false);
    toast(`✅ "${uName}" üyesi geri yüklendi`);
    logSuperActivity('restore_user', `${uName} üyesi geri yüklendi`);
  }catch(e){ showLoading(false); toast('❌ '+e.message,5000); }
}

/* Tüm sistemi son yedeğe geri yükle */
async function restoreSystemLatest(){
  if(!await confirmDialog({title:'TÜM SİSTEMİ Geri Yükle',message:'TÜM sistem (bütün şirketler) son yedeğe geri yüklenecek. Bu çok kapsamlı bir işlemdir. Devam edilsin mi?',danger:true,okText:'Geri Yükle'})) return;
  const typed=await promptDialog({title:'Onay',message:'Onaylamak için GERİ YÜKLE yazın:',placeholder:'GERİ YÜKLE',okText:'Onayla'});
  if((typed||'').trim().toLocaleUpperCase('tr')!=='GERİ YÜKLE'){ toast('İptal edildi'); return; }
  showLoading(true);
  try{
    const snap=await _db.ref(`${TENANT_ROOT}/backups/system`).once('value');
    if(!snap.exists()){ showLoading(false); toast('⚠️ Sistem yedeği yok'); return; }
    let latest=null;
    snap.forEach(ch=>{ const v=ch.val(); if(!latest||(v.ts||0)>(latest.ts||0)) latest=v; });
    if(!latest||!latest.data){ showLoading(false); toast('⚠️ Geçerli yedek yok'); return; }
    // Her ana dalı geri yaz (backups hariç)
    const d=latest.data;
    for(const key of Object.keys(d)){
      if(key==='backups') continue;
      await _db.ref(`${TENANT_ROOT}/${key}`).set(d[key]);
    }
    showLoading(false);
    toast(`✅ Sistem geri yüklendi (${latest.at})`);
    logSuperActivity('restore_system', `Tüm sistem son yedeğe geri yüklendi`);
  }catch(e){ showLoading(false); toast('❌ '+e.message,5000); }
}

/* Otomatik yedekleme — her gün TR saati 03:00'ten sonra bir kez
   (PWA olduğu için tarayıcı kapalıyken çalışamaz; süper admin 03:00 sonrası
    ilk girişinde o günün yedeği alınmamışsa otomatik alınır) */
function trBackupDayKey(){
  // TR saati (UTC+3). 03:00'ten önceyse "dünün günü" sayılır (gece yarısı sonrası ama 03 öncesi)
  const now=new Date();
  const trMs=now.getTime() + (now.getTimezoneOffset()*60000) + (3*3600000); // UTC+3
  const tr=new Date(trMs);
  // 03:00'ten önce ise bir önceki güne ait say
  if(tr.getHours()<3){ tr.setDate(tr.getDate()-1); }
  return tr.getFullYear()+'-'+String(tr.getMonth()+1).padStart(2,'0')+'-'+String(tr.getDate()).padStart(2,'0');
}

async function autoBackupIfNeeded(){
  if(!_db || !S.cur?.isSuper) return;
  try{
    const todayKey=trBackupDayKey();
    const metaSnap=await _db.ref(`${TENANT_ROOT}/backups/_lastAutoDay`).once('value');
    const lastDay=metaSnap.exists()?metaSnap.val():'';
    if(lastDay===todayKey) return; // bugünün yedeği zaten alınmış
    await backupSystem();
    await _db.ref(`${TENANT_ROOT}/backups/_lastAutoDay`).set(todayKey);
    console.log('[Otomatik yedek] alındı:', todayKey);
  }catch(e){}
}

/* Yedekleme yönetim ekranı (süper admin) — katmanlı geri yükleme */
function openBackupManager(){
  const body=document.getElementById('gmodal-body');
  document.getElementById('gmodal-title').textContent='💾 Yedekleme & Geri Yükleme';
  const companyOpts=S.companies.map(c=>`<option value="${c.id}">${safe(c.name)}</option>`).join('');
  body.innerHTML=`
    <p style="font-size:12.5px;color:var(--txt2);line-height:1.5;margin-bottom:14px">
      Sistem her gün TR saati <b>03:00</b>'te otomatik yedeklenir (son ${MAX_BACKUPS} yedek saklanır). Aşağıdan şirket, mahal veya üye bazında tek tek geri yükleyebilirsiniz.
    </p>
    <p class="sec-label" style="margin-bottom:8px">Manuel Yedek</p>
    <div class="ed-card" style="margin-bottom:14px">
      <button class="btn btn-primary btn-full btn-sm" onclick="manualBackupSystem()">📦 Şimdi Tam Yedek Al</button>
    </div>
    <p class="sec-label" style="margin-bottom:8px">Katmanlı Geri Yükleme</p>
    <div class="ed-card">
      <div class="form-group"><label class="form-label">1) ŞİRKET SEÇ</label>
        <select class="form-input" id="backup-company-sel" onchange="onBackupCompanyChange()">
          <option value="">— Şirket seçin —</option>${companyOpts}
        </select>
      </div>
      <div id="backup-layer-actions" style="display:none">
        <button class="btn btn-danger btn-full btn-sm" style="margin-bottom:10px" onclick="restoreSelectedCompany()">↩️ Tüm Şirketi Geri Yükle</button>
        <div class="form-group"><label class="form-label">2) MAHAL (tek mahal geri yükle)</label>
          <div style="display:flex;gap:6px">
            <select class="form-input" id="backup-mahal-sel" style="flex:1"><option value="">— Mahal —</option></select>
            <button class="btn btn-secondary btn-sm" onclick="restoreSelectedMahal()">↩️</button>
          </div>
        </div>
        <div class="form-group"><label class="form-label">3) ÜYE (tek üye geri yükle)</label>
          <div style="display:flex;gap:6px">
            <select class="form-input" id="backup-user-sel" style="flex:1"><option value="">— Üye —</option></select>
            <button class="btn btn-secondary btn-sm" onclick="restoreSelectedUser()">↩️</button>
          </div>
        </div>
      </div>
    </div>`;
  openModal('gmodal');
}

/* Şirket seçilince o şirketin mahal+üye listesini yedekten doldur */
async function onBackupCompanyChange(){
  const cid=document.getElementById('backup-company-sel')?.value;
  const actions=document.getElementById('backup-layer-actions');
  if(!cid){ if(actions) actions.style.display='none'; return; }
  if(actions) actions.style.display='block';
  const mSel=document.getElementById('backup-mahal-sel');
  const uSel=document.getElementById('backup-user-sel');
  if(mSel) mSel.innerHTML='<option value="">Yükleniyor…</option>';
  if(uSel) uSel.innerHTML='<option value="">Yükleniyor…</option>';
  const bData=await getCompanyBackupData(cid);
  if(!bData){
    if(mSel) mSel.innerHTML='<option value="">— Yedek yok —</option>';
    if(uSel) uSel.innerHTML='<option value="">— Yedek yok —</option>';
    return;
  }
  const mahals=toArr(bData.mahals||[]);
  const users=toArr(bData.users||[]);
  if(mSel) mSel.innerHTML='<option value="">— Mahal seç —</option>'+mahals.map(m=>`<option value="${m.id}">${safe(m.name||m.id)}</option>`).join('');
  if(uSel) uSel.innerHTML='<option value="">— Üye seç —</option>'+users.map(u=>`<option value="${u.id}">${safe(u.fullname||u.username||u.id)}</option>`).join('');
}

function restoreSelectedMahal(){
  const cid=document.getElementById('backup-company-sel')?.value;
  const mid=document.getElementById('backup-mahal-sel')?.value;
  if(!cid||!mid){ toast('⚠️ Şirket ve mahal seçin'); return; }
  restoreMahal(cid, mid);
}
function restoreSelectedUser(){
  const cid=document.getElementById('backup-company-sel')?.value;
  const uid=document.getElementById('backup-user-sel')?.value;
  if(!cid||!uid){ toast('⚠️ Şirket ve üye seçin'); return; }
  restoreUser(cid, uid);
}

async function manualBackupSystem(){
  showLoading(true);
  const r=await backupSystem();
  showLoading(false);
  toast(r?'✅ Sistem yedeği alındı':'❌ Yedek alınamadı');
}
async function manualBackupCompany(){
  const cid=document.getElementById('backup-company-sel')?.value;
  if(!cid){ toast('⚠️ Şirket seçin'); return; }
  showLoading(true);
  const r=await backupCompany(cid);
  showLoading(false);
  toast(r?'✅ Şirket yedeği alındı':'❌ Yedek alınamadı');
}
function restoreSelectedCompany(){
  const cid=document.getElementById('backup-company-sel')?.value;
  if(!cid){ toast('⚠️ Şirket seçin'); return; }
  closeModal('gmodal');
  restoreCompanyLatest(cid);
}

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
          setTimeout(()=>autoBackupIfNeeded(), 3000);
          return;
        }catch(e){ /* başarısızsa şirketler ekranına düş */ }
      }
      renderCompaniesScreen();
      setTimeout(()=>autoBackupIfNeeded(), 3000);
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

  if(uname===SUPER_USERNAME){
    const su=await getSuperAdmin();
    if(su){ user=su; isSuperLogin=true; }
  } else {
    // 2) Normal kullanıcı: tüm şirketlerde ara
    const found=await findUserAcrossCompanies(uname);
    if(found){ user=found.user; loginCompanyId=found.companyId; }
  }

  if(!user){ if(btn){ btn.disabled=false; btn.textContent='Giriş Yap →'; } fail(); return; }

  const ok = await verifyPassword(pass, user);
  if(btn){ btn.disabled=false; btn.textContent='Giriş Yap →'; }
  if(!ok){ fail(); return; }

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
    setTimeout(()=>autoBackupIfNeeded(), 3000);
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

/* ══════════════════════════════════════
   MAHAL SAYFASI
══════════════════════════════════════ */
function renderMahalPage(){
  const m=mahalById(S.activeMahalId); if(!m) return;
  let eq=S.equips.filter(e=>e.mahalId===m.id);
  const idx=S.mahals.findIndex(x=>x.id===m.id);
  document.getElementById('mahal-detail-hdr').innerHTML=`
    <div class="mdh-icon">${mahalIcon(idx,m)}</div>
    <div class="mdh-info">
      <h2>${safe(m.name)}</h2><p>${safe(m.desc||'')}</p>
      <div class="mdh-stats">
        <span class="mdh-badge ms-ok">✅ ${eq.filter(e=>getStatus(e)==='ok').length}</span>
        <span class="mdh-badge ms-fail">❌ ${eq.filter(e=>getStatus(e)==='fail').length}</span>
        <span class="mdh-badge ms-pend">⏳ ${eq.filter(e=>getStatus(e)==='pend').length}</span>
      </div>
    </div>`;
  // Ekle + Kümele butonları
  const wrap=document.getElementById('mahal-add-equip-wrap');
  const canManage=canDo('add_equip');
  wrap.style.display=canManage?'flex':'none';
  wrap.style.gap='8px'; wrap.style.flexWrap='wrap';
  if(canManage && !document.getElementById('btn-cluster-mahal')){
    const cb=document.createElement('button');
    cb.className='btn btn-secondary'; cb.id='btn-cluster-mahal'; cb.style.maxWidth='200px';
    cb.textContent='🗂️ Kümele';
    cb.onclick=()=>openClusterModal();
    wrap.appendChild(cb);
  }
  const listEl=document.getElementById('mahal-equip-list');
  if(!eq.length){
    listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">🔧</div><p>Bu mahalde ekipman yok.</p></div>`;
    return;
  }
  // ── Durum filtresi (Tümü / Uygun / Uygunsuz / Bekliyor) ──
  if(!S.mahalFilter) S.mahalFilter='all';
  const cOk=eq.filter(e=>getStatus(e)==='ok').length;
  const cFail=eq.filter(e=>getStatus(e)==='fail').length;
  const cPend=eq.filter(e=>getStatus(e)==='pend').length;
  const filterRow=`<div class="status-filter-row" style="margin-bottom:12px">${[
    ['all','Tümü ('+eq.length+')'],['ok','✅ Uygun ('+cOk+')'],['fail','❌ Uygunsuz ('+cFail+')'],['pend','⏳ Bekliyor ('+cPend+')']
  ].map(([id,l])=>`<button class="sfilter-btn${S.mahalFilter===id?' active':''}" data-mf="${id}">${l}</button>`).join('')}</div>`;
  // Filtreyi uygula
  if(S.mahalFilter!=='all') eq=eq.filter(e=>getStatus(e)===S.mahalFilter);
  // Filtre aktifken sıralama/sürükleme kapalı (kısmi liste)
  const canReorder=canManage && S.mahalFilter==='all';
  if(!eq.length){
    listEl.innerHTML=filterRow+`<div class="empty-state" style="padding:24px 0"><p>Bu filtrede ekipman yok.</p></div>`;
    listEl.querySelectorAll('.sfilter-btn').forEach(b=>b.addEventListener('click',()=>{ S.mahalFilter=b.dataset.mf; renderMahalPage(); }));
    return;
  }
  // order alanına göre sırala (yoksa mevcut sıra korunur)
  eq=eq.map((e,i)=>({e,o:(e.order!=null?e.order:i)})).sort((a,b)=>a.o-b.o).map(x=>x.e);
  // Kümelere göre grupla (küme yoksa "kümesiz")
  const groups=[]; const gmap={};
  eq.forEach(e=>{
    const key=e.cluster||'__none__';
    if(!gmap[key]){ gmap[key]={name:e.cluster||null, items:[]}; groups.push(gmap[key]); }
    gmap[key].items.push(e);
  });
  const hasClusters=groups.some(g=>g.name);
  let html='';
  groups.forEach(g=>{
    if(!hasClusters){
      // Hiç küme yok → düz liste (başlıksız)
      html+=`<div class="equip-list" data-cluster="">${g.items.map((e,i)=>mahalEquipRowHTML(e,i,g.items.length,canReorder)).join('')}</div>`;
      return;
    }
    // Küme(ler) var → Ekipmanlar sekmesindeki gibi AÇILIR-KAPANIR bölüm (cat-section)
    const key=g.name||'__none__';
    const isOpen=!_clusterClosed.has(key);
    html+=`<div class="cat-section">
      <div class="cat-section-title" data-cluster="${safe(key)}" style="cursor:pointer">
        <span class="cat-sec-icon">${g.name?'🗂️':'📋'}</span>
        <span class="cat-sec-name">${safe(g.name||'Kümesiz')}</span>
        ${(g.name&&canManage)?`<span class="cat-mng">
          <button class="cat-mng-btn" data-act="rename" title="Küme adını değiştir">✏️</button>
          <button class="cat-mng-btn" data-act="dissolve" title="Kümeyi dağıt (ekipmanlar kalır)">🗑️</button>
        </span>`:''}
        <span class="cat-section-count">${g.items.length}</span>
        <span class="cat-arrow">${isOpen?'▲':'▼'}</span>
      </div>
      <div class="cat-equip-body" style="display:${isOpen?'block':'none'}">
        <div class="equip-list" data-cluster="${safe(g.name||'')}">
          ${g.items.map((e,i)=>mahalEquipRowHTML(e,i,g.items.length,canReorder)).join('')}
        </div>
      </div>
    </div>`;
  });
  listEl.innerHTML=filterRow+html;
  listEl.querySelectorAll('.sfilter-btn').forEach(b=>b.addEventListener('click',()=>{ S.mahalFilter=b.dataset.mf; renderMahalPage(); }));
  // Küme başlığı: tıkla → aç/kapa; ✏️/🗑️ → yönet
  listEl.querySelectorAll('.cat-section-title').forEach(t=>{
    t.addEventListener('click',ev=>{
      const mng=ev.target.closest('.cat-mng-btn');
      const key=t.getAttribute('data-cluster');
      if(mng){
        ev.stopPropagation();
        const cname=(key==='__none__')?null:key;
        if(cname){ mng.dataset.act==='rename'?renameCluster(cname):dissolveCluster(cname); }
        return;
      }
      _clusterClosed.has(key)?_clusterClosed.delete(key):_clusterClosed.add(key);
      renderMahalPage();
    });
  });
  listEl.querySelectorAll('.equip-row').forEach(row=>row.addEventListener('click',ev=>{
    if(ev.target.closest('.eq-reorder')||ev.target.closest('.eq-drag')) return;
    openEquipDetail(row.dataset.eid);
  }));
  if(canReorder) wireEquipDragDrop(listEl);
}

/* Mahal ekipman satırı — yönetici için sürükle tutamacı + ▲▼ sıra butonlarıyla sarılır */
function mahalEquipRowHTML(e, i, total, canManage){
  if(!canManage) return equipRowHTML(e);
  return `<div class="eq-sortable" draggable="true" data-eid="${e.id}">
    <span class="eq-drag" title="Sürükle-bırak">⠿</span>
    <div class="eq-sortable-body">${equipRowHTML(e)}</div>
    <span class="eq-reorder">
      <button class="eq-ord-btn" ${i===0?'disabled':''} onclick="event.stopPropagation();moveEquip('${e.id}',-1)" title="Yukarı">▲</button>
      <button class="eq-ord-btn" ${i===total-1?'disabled':''} onclick="event.stopPropagation();moveEquip('${e.id}',1)" title="Aşağı">▼</button>
    </span>
  </div>`;
}

/* ▲▼ ile sıra değiştir (aynı mahal + aynı küme içinde) */
async function moveEquip(eid, dir){
  const e=equipById(eid); if(!e) return;
  const m=mahalById(S.activeMahalId); if(!m) return;
  let group=S.equips.filter(x=>x.mahalId===m.id && (x.cluster||null)===(e.cluster||null));
  group=group.map((x,i)=>({x,o:(x.order!=null?x.order:i)})).sort((a,b)=>a.o-b.o).map(x=>x.x);
  const i=group.findIndex(x=>x.id===eid), j=i+dir;
  if(i<0||j<0||j>=group.length) return;
  [group[i],group[j]]=[group[j],group[i]];
  group.forEach((x,k)=>{ x.order=k; });
  try{ await save(); renderMahalPage(); }catch(err){ toast('❌ '+err.message,5000); }
}

/* ── SÜRÜKLE-BIRAK (HTML5) — masaüstü; mobilde ▲▼ butonları ── */
function _dragAfterEl(list, y){
  const rows=[...list.querySelectorAll('.eq-sortable:not(.dragging)')];
  let closest=null, closestOffset=-Infinity;
  rows.forEach(row=>{
    const box=row.getBoundingClientRect();
    const offset=y-box.top-box.height/2;
    if(offset<0 && offset>closestOffset){ closestOffset=offset; closest=row; }
  });
  return closest;
}
function wireEquipDragDrop(container){
  let dragEl=null;
  container.querySelectorAll('.eq-sortable[draggable="true"]').forEach(row=>{
    row.addEventListener('dragstart', e=>{ dragEl=row; setTimeout(()=>row.classList.add('dragging'),0); try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',row.dataset.eid); }catch(_){} });
    row.addEventListener('dragend', ()=>{ row.classList.remove('dragging'); if(dragEl){ dragEl=null; persistEquipOrderFromDOM(container); } });
  });
  container.querySelectorAll('.equip-list').forEach(list=>{
    list.addEventListener('dragover', e=>{ e.preventDefault(); if(!dragEl) return; const after=_dragAfterEl(list, e.clientY); if(after==null) list.appendChild(dragEl); else list.insertBefore(dragEl, after); });
  });
}
/* Sürükleme sonrası DOM sırasını ekipmanlara yaz (küme değişmişse onu da) */
async function persistEquipOrderFromDOM(container){
  container.querySelectorAll('.equip-list').forEach(list=>{
    const cname=list.getAttribute('data-cluster')||'';
    [...list.querySelectorAll('.eq-sortable[data-eid]')].forEach((row,k)=>{
      const e=equipById(row.getAttribute('data-eid'));
      if(e){ e.order=k; if(cname) e.cluster=cname; else delete e.cluster; }
    });
  });
  try{ await save(); renderMahalPage(); }catch(err){ toast('❌ '+err.message,5000); }
}

/* ── KÜMELEME ── */
function openClusterModal(){
  const m=mahalById(S.activeMahalId); if(!m) return;
  const eq=S.equips.filter(e=>e.mahalId===m.id);
  if(!eq.length){ toast('⚠️ Bu mahalde ekipman yok'); return; }
  const existing=[...new Set(eq.map(e=>e.cluster).filter(Boolean))];
  const body=document.getElementById('gmodal-body');
  document.getElementById('gmodal-title').textContent='🗂️ Kümele';
  body.innerHTML=`
    <p style="font-size:12.5px;color:var(--txt2);margin-bottom:10px;line-height:1.5">Bir küme adı girin ve bu kümeye koymak istediğiniz ekipmanları işaretleyin. İşaretlemedikleriniz olduğu gibi (kümesiz) kalır.</p>
    <div class="form-group"><label class="form-label">KÜME ADI</label>
      <input class="form-input" id="cluster-name" list="cluster-existing" placeholder="örn: 2. Kat · A Blok · Kazan Grubu" autocomplete="off"/>
      <datalist id="cluster-existing">${existing.map(c=>`<option value="${safe(c)}"></option>`).join('')}</datalist>
    </div>
    <label class="form-label">EKİPMANLAR</label>
    <div style="display:flex;flex-direction:column;gap:4px;max-height:42vh;overflow-y:auto;margin-top:6px">
      ${eq.map(e=>`<label class="perm-item" style="cursor:pointer">
        <input type="checkbox" class="cluster-eq" value="${e.id}"/>
        <div><div class="perm-label">${catById(e.cat).icon||'📦'} ${safe(e.name)}</div><div class="perm-desc">${e.cluster?('şu an: '+safe(e.cluster)):'kümesiz'}</div></div>
      </label>`).join('')}
    </div>
    <button class="btn btn-primary btn-full" style="margin-top:14px" onclick="saveClusterAssign()">✅ Kümeye Koy</button>`;
  openModal('gmodal');
}
async function saveClusterAssign(){
  const name=(document.getElementById('cluster-name')?.value||'').trim();
  if(!name){ toast('⚠️ Küme adı girin'); return; }
  const ids=[...document.querySelectorAll('.cluster-eq:checked')].map(c=>c.value);
  if(!ids.length){ toast('⚠️ En az bir ekipman seçin'); return; }
  ids.forEach(id=>{ const e=equipById(id); if(e) e.cluster=name; });
  try{ await save(); closeModal('gmodal'); renderMahalPage(); toast(`✅ ${ids.length} ekipman "${name}" kümesine kondu`); }
  catch(e){ toast('❌ '+e.message,5000); }
}
async function renameCluster(oldName){
  const name=await promptDialog({title:'Küme Adını Değiştir',message:'Yeni küme adı:',value:oldName,okText:'Kaydet'});
  if(name===null||!name.trim()) return;
  S.equips.forEach(e=>{ if(e.cluster===oldName) e.cluster=name.trim(); });
  try{ await save(); renderMahalPage(); toast('✅ Küme adı güncellendi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}
async function dissolveCluster(name){
  if(!await confirmDialog({title:'Kümeyi Dağıt',message:`"${safe(name)}" kümesi dağıtılacak. Ekipmanlar SİLİNMEZ, sadece kümesiz olur.`,okText:'Dağıt'})) return;
  S.equips.forEach(e=>{ if(e.cluster===name) delete e.cluster; });
  try{ await save(); renderMahalPage(); toast('✅ Küme dağıtıldı'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* ══════════════════════════════════════
   EKİPMAN LİSTESİ
══════════════════════════════════════ */
const openCats=new Set();
const _clusterClosed=new Set(); // kapalı kümeler (varsayılan açık)
const _catPage={}; // her kategori için ekipman sayfa no

function renderEquipments(){
  const mt=document.getElementById('btn-new-type');
  if(mt) mt.style.display=canDo('manage_types')?'':'none';
  renderStatusFilter();
  renderDueReminder();
  const q=S.searchQ.toLowerCase();
  let list=[...S.equips];
  if(S.filterCat==='ok')   list=list.filter(e=>getStatus(e)==='ok');
  else if(S.filterCat==='fail') list=list.filter(e=>getStatus(e)==='fail');
  else if(S.filterCat==='pend') list=list.filter(e=>getStatus(e)==='pend');
  else if(S.filterCat==='due') list=list.filter(e=>{const st=inspectStatus(e).state; return st==='overdue'||st==='never'||st==='soon';});
  if(q) list=list.filter(e=>e.name.toLowerCase().includes(q));
  if(q||S.filterCat!=='all') allCats().forEach(c=>openCats.add(c.id));

  const el=document.getElementById('cat-equip-list');
  el.innerHTML='';
  // Arama/filtre sonucu boşsa "bulunamadı" göster
  if(!list.length && (q || S.filterCat!=='all')){
    el.innerHTML=`<div class="empty-state"><div class="empty-icon">🔍</div><p>Sonuç bulunamadı.</p></div>`;
    return;
  }

  // FİLTRE/ARAMA AKTİF → tür başlıkları olmadan düz liste (sadece eşleşen ekipmanlar), 10'ar sayfalı
  if(q || S.filterCat!=='all'){
    const PER=10;
    const pages=Math.ceil(list.length/PER)||1;
    if(S.pgEquip>pages) S.pgEquip=pages;
    if(S.pgEquip<1) S.pgEquip=1;
    const start=(S.pgEquip-1)*PER;
    const slice=list.slice(start, start+PER);
    const flat=document.createElement('div');
    flat.className='equip-list';
    flat.innerHTML=slice.map(e=>equipRowHTML(e,true)).join('')
      + pagerHTML(list.length, S.pgEquip, PER, 'S.pgEquip=%P%;renderEquipments()');
    el.appendChild(flat);
    el.querySelectorAll('.equip-row').forEach(r=>r.addEventListener('click',()=>openEquipDetail(r.dataset.eid)));
    return;
  }

  allCats().forEach(cat=>{
    const equips=list.filter(e=>e.cat===cat.id);
    const isOpen=openCats.has(cat.id);
    const hasFail=equips.some(e=>getStatus(e)==='fail');
    const canManage=canDo('manage_types');
    const base=isBaseCat(cat.id);
    const section=document.createElement('div');
    section.className='cat-section';
    section.innerHTML=`
      <div class="cat-section-title" data-catid="${cat.id}">
        <span class="cat-sec-icon">${cat.icon}</span>
        <span class="cat-sec-name">${safe(cat.name)}</span>
        ${hasFail?'<span class="cat-warn-badge">⚠️</span>':''}
        ${canManage?`<span class="cat-mng">
          <button class="cat-mng-btn" data-act="edit" data-cat="${cat.id}" title="Ad/ikon düzenle">✏️</button>
          <button class="cat-mng-btn" data-act="form" data-cat="${cat.id}" title="Formu düzenle">🛠️</button>
          ${!base?`<button class="cat-mng-btn" data-act="del" data-cat="${cat.id}" title="Türü sil">🗑️</button>`:''}
        </span>`:''}
        <span class="cat-section-count">${equips.length}</span>
        <span class="cat-arrow">${isOpen?'▲':'▼'}</span>
      </div>
      <div class="cat-equip-body" style="display:${isOpen?'block':'none'}">
        ${canDo('add_equip')?`<div style="padding:8px 0 10px">
          <button class="btn btn-accent btn-sm btn-add-cat" data-cat="${cat.id}">➕ ${safe(cat.name)} Ekle</button>
        </div>`:''}
        <div class="equip-list">
          ${(()=>{
            if(!equips.length) return '<div style="padding:10px 0;font-size:13px;color:var(--txt3)">Bu kategoride ekipman yok.</div>';
            const PER=10;
            if(!_catPage[cat.id]) _catPage[cat.id]=1;
            let pg=_catPage[cat.id];
            const pages=Math.ceil(equips.length/PER)||1;
            if(pg>pages){ pg=pages; _catPage[cat.id]=pg; }
            const start=(pg-1)*PER;
            return equips.slice(start,start+PER).map(e=>equipRowHTML(e,true)).join('')
              + pagerHTML(equips.length, pg, PER, `_catPage['${cat.id}']=%P%;renderEquipments()`);
          })()}
        </div>
      </div>`;
    section.querySelector('.cat-section-title').addEventListener('click',ev=>{
      if(ev.target.closest('.btn-add-cat')||ev.target.closest('.cat-mng')) return;
      openCats.has(cat.id)?openCats.delete(cat.id):openCats.add(cat.id);
      renderEquipments();
    });
    // Tür yönetim simgeleri
    section.querySelectorAll('.cat-mng-btn').forEach(btn=>{
      btn.addEventListener('click',ev=>{
        ev.stopPropagation();
        const act=btn.dataset.act, cid=btn.dataset.cat;
        if(act==='edit') openEditCat(cid);
        else if(act==='form'){ const c=catById(cid); openFormDesigner(cid, c.name, false); }
        else if(act==='del') deleteCat(cid);
      });
    });
    section.querySelector('.btn-add-cat')?.addEventListener('click',ev=>{
      ev.stopPropagation();
      openAddEquipModal();
      setTimeout(()=>{ const s=document.getElementById('inp-equip-cat'); if(s){s.value=cat.id;onCatChange();} },60);
    });
    el.appendChild(section);
  });
  el.querySelectorAll('.equip-row').forEach(r=>r.addEventListener('click',()=>openEquipDetail(r.dataset.eid)));
}

function renderDueReminder(){
  const el=document.getElementById('due-reminder-box'); if(!el) return;
  const due=getDueEquips();
  const overdue=due.filter(x=>x.st.state==='overdue'||x.st.state==='never');
  if(!overdue.length){ el.innerHTML=''; return; }
  el.innerHTML=`<div onclick="S.filterCat='due';S.pgEquip=1;renderEquipments();" style="background:var(--obg);border:1px solid rgba(245,158,11,.3);border-radius:var(--r12);padding:12px 14px;margin-bottom:14px;cursor:pointer">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:700;color:var(--otxt);font-size:13.5px">
      <span>⏰ ${overdue.length} ekipman denetim bekliyor</span>
      <span style="font-size:12px;font-weight:600">Göster →</span>
    </div>
    <div style="font-size:12px;color:var(--txt2);margin-top:6px;line-height:1.6">
      ${overdue.slice(0,3).map(x=>`• ${safe(x.e.name)} ${x.st.state==='never'?'(hiç denetlenmedi)':`(${x.st.days} gün gecikmiş)`}`).join('<br/>')}
      ${overdue.length>3?`<br/>…ve ${overdue.length-3} tane daha`:''}
    </div>
  </div>`;
}

function renderStatusFilter(){
  const w=document.getElementById('status-filter-row'); if(!w) return;
  const opts=[{id:'all',l:'Tümü'},{id:'due',l:'⏰ Denetlenmeli'},{id:'ok',l:'✅ Uygun'},{id:'fail',l:'❌ Sorunlu'},{id:'pend',l:'⏳ Bekliyor'}];
  w.innerHTML=opts.map(o=>`<button class="sfilter-btn${S.filterCat===o.id?' active':''}" data-sf="${o.id}">${o.l}</button>`).join('');
  w.querySelectorAll('.sfilter-btn').forEach(b=>b.addEventListener('click',()=>{S.filterCat=b.dataset.sf;S.pgEquip=1;renderEquipments();}));
}

/* ══════════════════════════════════════
   EKİPMAN DETAY
══════════════════════════════════════ */
let _maintOpen=false;
let _docsOpen=false;
function openEquipDetail(id){ S.activeEquipId=id; _maintOpen=false; _docsOpen=false; renderEquipDetail(); showPage('equip-detail'); }

function renderEquipDetail(){
  const e=equipById(S.activeEquipId); if(!e) return;
  const cat=catById(e.cat);
  const m=mahalById(e.mahalId);
  const myRpts=[...S.reports].filter(r=>r.equipId===e.id).sort((a,b)=>b.createdAt>a.createdAt?1:-1).slice(0,10);

  let tupHTML='';
  if(e.cat==='tup-dolap'&&e.tupRows?.length){
    tupHTML=`<div class="divider"></div><p class="sec-label">Tüp Kayıtları</p>
    <div class="hist-wrap"><table class="hist-table">
      <tr><th>Tüp No</th><th>Kapasite</th><th>SKT</th><th>Basınç</th><th>Sızıntı</th><th>Durum</th></tr>
      ${e.tupRows.map(r=>`<tr class="${r.durum==='ok'?'ok-row':r.durum==='fail'?'fail-row':''}">
        <td>${safe(r.tupNo)}</td><td>${r.kapasite||''}kg</td><td>${r.tarih||'—'}</td>
        <td>${r.basinc?r.basinc+' bar':'—'}</td>
        <td>${r.sizinti==='evet'?'⚠️ Evet':'✅ Hayır'}</td>
        <td style="font-weight:700">${r.durum==='ok'?'✅ Uygun':r.durum==='fail'?'❌ Uygun Değil':'⏳ Bekliyor'}</td>
      </tr>`).join('')}
    </table></div>`;
  }

  let histHTML='';
  if(myRpts.length){
    histHTML=`<div class="divider"></div><p class="sec-label">Denetim Geçmişi (${myRpts.length})</p>
    <div class="hist-wrap"><table class="hist-table">
      <tr><th>Rapor</th><th>Tarih</th><th>Denetleyen</th><th>Sonuç</th></tr>
      ${myRpts.map(r=>`<tr class="${r.result}-row" data-rid="${r.id}">
        <td style="color:var(--accent);font-weight:700;font-size:11px">${r.id}</td>
        <td>${r.date}</td><td>${safe(r.by)}</td>
        <td style="font-weight:700;color:${r.result==='ok'?'var(--gtxt)':'var(--rtxt)'}">${r.result==='ok'?'✅':'❌'}</td>
      </tr>`).join('')}
    </table></div>`;
  }

  const imgHTML=e.imageUrl?`<img src="${e.imageUrl}" style="width:100%;max-height:180px;object-fit:cover;border-radius:var(--r12);margin-bottom:12px" onerror="this.style.display='none'">`:'';

  document.getElementById('equip-detail-container').innerHTML=`
    <button class="page-back-btn" onclick="goBack()">← Geri</button>
    <div class="ed-card">
      ${imgHTML}
      <div class="ed-hdr">
        <div class="ed-icon">${cat.icon}</div>
        <div class="ed-titles">
          <h2>${safe(e.name)}</h2>
          <div class="sub">${cat.name} · ${m?safe(m.name):'—'}</div>
          <div style="margin-top:8px">${statusBadge(e)}</div>
        </div>
      </div>
      ${e.desc?`<div style="font-size:13px;color:var(--txt2);padding:10px 12px;background:var(--bg);border-radius:var(--r8);margin-bottom:12px">${safe(e.desc)}</div>`:''}
      ${(()=>{
        // Son denetim bilgisi: lastInsp yoksa tamamlanmış raporlardan
        let lastDate=e.lastInsp?e.lastInsp.date:null, lastBy=e.lastInsp?e.lastInsp.by:null;
        const reps=S.reports.filter(r=>r&&r.equipId===e.id && !r.incomplete).sort((a,b)=>(parseDateStr(b.date)||0)-(parseDateStr(a.date)||0));
        if(reps.length && (!lastDate || (parseDateStr(reps[0].date)||0) > (parseDateStr(lastDate)||0))){
          lastDate=reps[0].date; lastBy=reps[0].by;
        }
        return `<div class="info-row"><span class="ir-key">Son Denetim</span><span class="ir-val">${lastDate||'—'}</span></div>
      <div class="info-row"><span class="ir-key">Denetleyen</span><span class="ir-val">${lastBy?safe(lastBy):'—'}</span></div>`;
      })()}
      <div class="info-row"><span class="ir-key">Kontrol Periyodu</span><span class="ir-val">${periodLabel(equipPeriod(e))}${(e.period===undefined||e.period===null)?' (varsayılan)':''}</span></div>
      ${e.maintenance&&e.maintenance.date?(()=>{
        const md=parseMaintDate(e.maintenance.date);
        const daysLeft=md?Math.ceil((md.getTime()-Date.now())/86400000):null;
        let badge='';
        if(daysLeft!==null){
          if(daysLeft<0) badge=`<span style="color:#ef4444;font-weight:700">⚠️ ${-daysLeft} gün geçti</span>`;
          else if(daysLeft<=(e.maintenance.warnDays||15)) badge=`<span style="color:var(--otxt);font-weight:700">🔧 ${daysLeft} gün kaldı</span>`;
          else badge=`<span style="color:var(--txt2)">${daysLeft} gün kaldı</span>`;
        }
        const open=_maintOpen;
        return `<div style="border:1px solid var(--brd);border-radius:12px;margin-bottom:10px;overflow:hidden">
          <div onclick="_maintOpen=!_maintOpen;renderEquipDetail()" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 14px;cursor:pointer;background:var(--bg)">
            <span style="font-size:13.5px;font-weight:600;color:var(--txt)">🔧 Bakım Bilgileri</span>
            <span style="display:flex;align-items:center;gap:8px">${badge}<span style="color:var(--txt3);transform:rotate(${open?'180':'0'}deg);transition:transform .2s">▾</span></span>
          </div>
          <div style="display:${open?'block':'none'};padding:4px 14px 10px">
            <div class="info-row"><span class="ir-key">Tarih</span><span class="ir-val">${fmtMaintDate(e.maintenance.date)}</span></div>
            ${e.maintenance.firm?`<div class="info-row"><span class="ir-key">Firma</span><span class="ir-val">${safe(e.maintenance.firm)}</span></div>`:''}
            <div class="info-row"><span class="ir-key">Uyarı</span><span class="ir-val">${e.maintenance.warnDays||15} gün önce</span></div>
            ${e.maintenance.note?`<div style="font-size:12.5px;color:var(--txt2);padding:8px 12px;background:var(--bg);border-radius:8px;margin-top:6px">📝 ${safe(e.maintenance.note)}</div>`:''}
          </div>
        </div>`;
      })():''}
      ${(()=>{ const st=inspectStatus(e); if(st.state==='overdue') return `<div class="fail-alert" style="background:rgba(245,158,11,.15);color:var(--otxt)">⏰ Denetim ${st.days} gün gecikti!</div>`; if(st.state==='soon') return `<div style="font-size:12px;color:var(--otxt);padding:8px 12px;background:rgba(245,158,11,.1);border-radius:8px;margin-bottom:8px">⏳ ${st.days} gün içinde denetlenmeli</div>`; return ''; })()}
      ${getStatus(e)==='fail'?'<div class="fail-alert">⚠️ BU EKİPMAN UYGUN DEĞİL</div>':''}
      ${tupHTML}${histHTML}
      ${renderEquipDocs(e)}
      <div class="ed-actions">
        ${canDo('inspect')?`<button class="btn btn-primary" id="ed-insp">🔍 Denetim Yap</button>`:''}
        <button class="btn btn-secondary btn-sm" id="ed-qr">📎 QR</button>
        ${hasUnits(e)?`<button class="btn btn-secondary btn-sm" id="ed-qr-all">🖨️ Tüm Birim QR</button>`:''}
        ${(canDo('add_equip')||canDo('del_equip'))?`<button class="btn btn-secondary btn-sm" id="ed-edit">✏️ Düzenle</button>`:''}
      </div>
    </div>`;

  document.getElementById('ed-qr')?.addEventListener('click',()=>showQRModal(e.id));
  document.getElementById('ed-qr-all')?.addEventListener('click',()=>printAllUnitQRs(e.id));
  document.getElementById('ed-insp')?.addEventListener('click',()=>{
    openInspection(e.id);
  });
  document.getElementById('ed-edit')?.addEventListener('click',()=>openEditEquip(e.id));
  document.querySelectorAll('#equip-detail-container tr[data-rid]').forEach(tr=>tr.addEventListener('click',()=>openReportDetail(tr.dataset.rid)));
}

/* ══════════════════════════════════════
   EKİPMAN BELGELERİ (Firebase Storage arşivi)
   - Max 10 belge, sabitleme (📌 hep üstte), tarih
   - Cihazdan seç veya tarayıcı (çoklu sayfa → PDF)
   ══════════════════════════════════════ */
const MAX_DOCS=10;
const MAX_DOC_MB=3;

function getEquipDocs(e){
  return Array.isArray(e.documents)?e.documents.slice():[];
}
function renderEquipDocs(e){
  const docs=getEquipDocs(e);
  // Sabitlenenler üstte, sonra tarihe göre yeni→eski
  docs.sort((a,b)=>{
    if((b.pinned?1:0)!==(a.pinned?1:0)) return (b.pinned?1:0)-(a.pinned?1:0);
    return (b.ts||0)-(a.ts||0);
  });
  const open=_docsOpen;
  const canManage=canDo('add_equip')||canDo('inspect');
  const rows = docs.length ? docs.map(d=>{
    const dt=d.ts?new Date(d.ts).toLocaleDateString('tr-TR'):'';
    const icon=d.type==='application/pdf'?'📄':(d.type&&d.type.startsWith('image/')?'🖼️':'📎');
    return `<div style="padding:10px 12px;border-bottom:1px solid var(--brd)">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">${icon}</span>
        <div style="flex:1;min-width:0;cursor:pointer" onclick="openDocLink('${d.id}')">
          <div style="font-size:13.5px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.pinned?'📌 ':''}${safe(d.name)}</div>
          <div style="font-size:11px;color:var(--txt3)">${dt}</div>
        </div>
        ${canManage?`<button class="doc-mini-btn" onclick="deleteEquipDoc('${d.id}')" title="Sil">🗑️</button>`:''}
      </div>
      ${canManage?`<label style="display:flex;align-items:center;gap:7px;margin-top:7px;margin-left:28px;cursor:pointer;font-size:12.5px;color:var(--txt2);user-select:none">
        <input type="checkbox" ${d.pinned?'checked':''} onchange="toggleDocPin('${d.id}')" style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer"/>
        Sabitle <span style="font-size:11px;color:var(--txt3)">(üstte kalsın)</span>
      </label>`:''}
    </div>`;
  }).join('') : `<div style="padding:16px 12px;text-align:center;color:var(--txt3);font-size:13px">Henüz belge yok</div>`;

  return `<div style="border:1px solid var(--brd);border-radius:12px;margin-bottom:12px;overflow:hidden">
    <div onclick="_docsOpen=!_docsOpen;renderEquipDetail()" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 14px;cursor:pointer;background:var(--bg)">
      <span style="font-size:13.5px;font-weight:600;color:var(--txt)">📎 Ekipmanla İlgili Belgeler <span style="font-size:11px;color:var(--txt3);font-weight:400">(${docs.length}/${MAX_DOCS})</span></span>
      <span style="color:var(--txt3);transform:rotate(${open?'180':'0'}deg);transition:transform .2s">▾</span>
    </div>
    <div style="display:${open?'block':'none'}">
      ${rows}
      ${canManage?`<div style="display:flex;justify-content:flex-end;padding:10px 12px">
        <button class="btn btn-primary btn-sm" onclick="startDocUpload('${e.id}')" ${docs.length>=MAX_DOCS?'disabled style="opacity:.5"':''}>
          ${docs.length>=MAX_DOCS?'Limit doldu (10)':'⬆️ Belge Yükle'}
        </button>
      </div>`:''}
    </div>
  </div>`;
}

/* Belge linkini aç */
function openDocLink(docId){
  const e=equipById(S.activeEquipId); if(!e) return;
  const d=getEquipDocs(e).find(x=>x.id===docId);
  if(d&&d.url) window.open(d.url,'_blank');
}

/* Sabitle / kaldır */
async function toggleDocPin(docId){
  const e=equipById(S.activeEquipId); if(!e) return;
  if(!Array.isArray(e.documents)) return;
  const d=e.documents.find(x=>x.id===docId); if(!d) return;
  d.pinned=!d.pinned;
  try{ await save(); renderEquipDetail(); toast(d.pinned?'📌 Sabitlendi':'Sabitleme kaldırıldı'); }
  catch(err){ toast('❌ '+err.message); }
}

/* Belge sil (Storage'dan + kayıttan) */
async function deleteEquipDoc(docId){
  const e=equipById(S.activeEquipId); if(!e) return;
  const d=(e.documents||[]).find(x=>x.id===docId); if(!d) return;
  if(!await confirmDialog({title:'Belge Silinsin mi?',message:`"${safe(d.name)}" kalıcı olarak silinecek.`,danger:true,okText:'Sil'})) return;
  try{
    // Storage'dan sil (başarısız olsa bile kayıttan kaldır)
    if(_storageReady && d.path){
      try{ await _storage.ref(d.path).delete(); }
      catch(err){ console.warn('Storage silme hatası (kayıttan yine de kaldırılıyor):', err.code||err.message); }
    }
    e.documents=e.documents.filter(x=>x.id!==docId);
    await save(); renderEquipDetail(); toast('🗑️ Belge silindi');
  }catch(err){ toast('❌ Silinemedi: '+(err.message||'')); }
}

/* ── BELGE YÜKLEME AKIŞI ──
   Seçim sorar: Cihazdan / Tarayıcı. Sonra sıkıştır → Storage → kayıt. */
let _docUploading=false;       // aynı anda 2 yükleme engeli
let _docTargetEquip=null;
let _scanPages=[];             // tarayıcı: çekilen sayfalar

function startDocUpload(equipId){
  if(_docUploading){ toast('⏳ Zaten bir yükleme sürüyor, bekleyin'); return; }
  if(!_storageReady){ toast('⚠️ Belge sistemi şu an kullanılamıyor'); return; }
  const e=equipById(equipId); if(!e) return;
  if(getEquipDocs(e).length>=MAX_DOCS){ toast(`⚠️ En fazla ${MAX_DOCS} belge yüklenebilir`); return; }
  if(!_fbConnected){ toast('📡 İnternet yok — belge yüklemek için bağlantı gerekli',4000); return; }
  _docTargetEquip=equipId;
  openModal('modal-doc-source');
}

/* Cihazdan dosya seç */
function docPickFromDevice(){
  closeModal('modal-doc-source');
  const inp=document.getElementById('doc-file-input');
  if(inp){ inp.value=''; inp.click(); }
}

/* Direkt fotoğraf çek (kamera açılır, tek foto) */
function docTakePhoto(){
  closeModal('modal-doc-source');
  const inp=document.getElementById('doc-photo-input');
  if(inp){ inp.value=''; inp.click(); }
}

/* Cihazdan dosya seçilince */
async function onDocFileSelected(ev){
  const file=ev.target.files&&ev.target.files[0];
  if(!file) return;
  // Tip kontrolü
  if(file.type!=='application/pdf' && !file.type.startsWith('image/')){
    toast('⚠️ Sadece PDF ve resim yüklenebilir'); return;
  }
  // İsim sor
  // Varsayılan isim: dosya adı varsa onu kullan, kamera fotoğrafıysa tarihli isim
  let defaultName=file.name.replace(/\.[^.]+$/,'');
  if(!defaultName || /^image|^photo|^img/i.test(defaultName)){
    defaultName='Fotoğraf '+new Date().toLocaleDateString('tr-TR');
  }
  const name=await promptDialog({title:'Belge Adı',message:'Bu belge hangi isimle kaydedilsin?',placeholder:'örn: Bakım Onarım Formu',value:defaultName,okText:'Yükle'});
  if(name===null||!name.trim()) return;
  let blob=file;
  // Resimse sıkıştır
  if(file.type.startsWith('image/')){
    try{ blob=await compressImage(file); }catch(e){ /* sıkıştırma başarısızsa orijinal */ }
  }
  await uploadDocBlob(blob, name.trim(), file.type);
}

/* Resim sıkıştırma (canvas ile, max 1600px + jpeg %75) */
function compressImage(file, maxDim=1600, quality=0.75){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      URL.revokeObjectURL(url);
      let {width,height}=img;
      if(width>maxDim||height>maxDim){
        if(width>height){ height=Math.round(height*maxDim/width); width=maxDim; }
        else { width=Math.round(width*maxDim/height); height=maxDim; }
      }
      const canvas=document.createElement('canvas');
      canvas.width=width; canvas.height=height;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#fff'; ctx.fillRect(0,0,width,height);
      ctx.drawImage(img,0,0,width,height);
      canvas.toBlob(b=>{ b?resolve(b):reject(new Error('sıkıştırma hatası')); }, 'image/jpeg', quality);
    };
    img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error('resim okunamadı')); };
    img.src=url;
  });
}

/* Blob'u Storage'a yükle + ekipmana kaydet */
async function uploadDocBlob(blob, name, type){
  const equipId=_docTargetEquip;
  const e=equipById(equipId); if(!e){ return; }
  // Son kontroller (yarış önleme)
  if(_docUploading){ toast('⏳ Zaten bir yükleme sürüyor'); return; }
  if(getEquipDocs(e).length>=MAX_DOCS){ toast(`⚠️ En fazla ${MAX_DOCS} belge`); return; }
  if(!_fbConnected){ toast('📡 İnternet yok — yükleme iptal'); return; }
  // Boyut kontrolü
  const sizeMB=blob.size/(1024*1024);
  if(sizeMB>MAX_DOC_MB){
    toast(`⚠️ Belge çok büyük (${sizeMB.toFixed(1)} MB). En fazla ${MAX_DOC_MB} MB olabilir.`,5000);
    return;
  }

  _docUploading=true;
  const loadingToast=showPersistentToast('⬆️ Belge yükleniyor… %0');
  try{
    const ext = type==='application/pdf'?'pdf':(type==='image/jpeg'?'jpg':(type.split('/')[1]||'bin'));
    const docId='doc'+Date.now()+Math.random().toString(36).slice(2,6);
    // Şirkete özel yol: belgeler/{şirketId}/{equipId}/{docId}.ext (izolasyon + güvenlik kuralları)
    const cid=S.activeCompanyId||'_ortak';
    const path=`belgeler/${cid}/${equipId}/${docId}.${ext}`;
    const ref=_storage.ref(path);
    const task=ref.put(blob, {contentType:type});

    await new Promise((resolve,reject)=>{
      task.on('state_changed',
        snap=>{
          const pct=Math.round((snap.bytesTransferred/snap.totalBytes)*100);
          updatePersistentToast(loadingToast, `⬆️ Belge yükleniyor… %${pct}`);
        },
        err=>reject(err),
        ()=>resolve()
      );
    });
    const url=await ref.getDownloadURL();

    // Ekipmana kaydet
    if(!Array.isArray(e.documents)) e.documents=[];
    e.documents.push({ id:docId, name, type, path, url, size:(blob?.size||0), ts:Date.now(), by:S.cur?.username||'—', pinned:false });
    await save();
    hidePersistentToast(loadingToast);
    toast('✅ Belge yüklendi: '+name);
    renderEquipDetail();
    try{ renderFbUsage(); }catch(e){}   // depolama barını hemen güncelle
  }catch(err){
    hidePersistentToast(loadingToast);
    if(err.code==='storage/unauthorized') toast('🔒 Yetki hatası — belge yüklenemedi',5000);
    else if(err.code==='storage/canceled') toast('Yükleme iptal edildi');
    else toast('❌ Yükleme başarısız: '+(err.message||'bilinmeyen hata'),5000);
  }finally{
    _docUploading=false;
  }
}

/* ── TARAYICI (çoklu sayfa → tek PDF) ── */
let _scanStream=null;
let _scanRawPages=[];   // ham (orijinal renkli) sayfalar — filtre uygulanmadan
let _scanFilter='color'; // aktif filtre: color | enhance | gray | bw
let _scanRafId=null;     // kenar overlay animasyon

async function startScanner(){
  closeModal('modal-doc-source');
  _scanPages=[]; _scanRawPages=[]; _scanFilter='color';
  // Tam ekran tarayıcıyı aç
  const screen=document.getElementById('scanner-screen');
  if(screen) screen.style.display='flex';
  document.getElementById('scanner-camera-view').style.display='flex';
  document.getElementById('scanner-review-view').style.display='none';
  updateScanCount();
  // OpenCV'yi arka planda yüklemeye başla (kenar tespiti için, beklemeden)
  loadOpenCV().catch(()=>{});
  const video=document.getElementById('scanner-video');
  try{
    _scanStream=await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:{ideal:'environment'}, width:{ideal:1920}, height:{ideal:2560} },
      audio:false
    });
    video.srcObject=_scanStream;
    await video.play().catch(()=>{});
    startEdgeOverlay();
  }catch(err){
    toast('📷 Kamera açılamadı: '+(err.message||'izin reddedildi'),5000);
    closeScanner();
  }
}

function stopScanner(){
  if(_scanStream){ try{ _scanStream.getTracks().forEach(t=>t.stop()); }catch(e){} _scanStream=null; }
  if(_scanRafId){ cancelAnimationFrame(_scanRafId); _scanRafId=null; }
  const video=document.getElementById('scanner-video');
  if(video) video.srcObject=null;
}

function closeScanner(){
  stopScanner();
  const screen=document.getElementById('scanner-screen');
  if(screen) screen.style.display='none';
  _scanPages=[]; _scanRawPages=[];
}

function updateScanCount(){
  const el=document.getElementById('scanner-count');
  if(el) el.textContent=_scanRawPages.length+' sayfa';
  const doneBtn=document.getElementById('scanner-done');
  if(doneBtn){
    if(_scanRawPages.length>0){ doneBtn.style.opacity='1'; doneBtn.style.pointerEvents='auto'; }
    else { doneBtn.style.opacity='.4'; doneBtn.style.pointerEvents='none'; }
  }
}

/* Canlı kenar tespiti overlay (kameranın üstünde yeşil çerçeve) */
function startEdgeOverlay(){
  const video=document.getElementById('scanner-video');
  const overlay=document.getElementById('scanner-overlay');
  if(!video||!overlay) return;
  const ctx=overlay.getContext('2d');
  let frameCount=0;
  function draw(){
    if(!_scanStream){ return; }
    _scanRafId=requestAnimationFrame(draw);
    frameCount++;
    if(frameCount%6!==0) return; // performans: her 6 karede bir
    if(!video.videoWidth) return;
    overlay.width=video.clientWidth; overlay.height=video.clientHeight;
    ctx.clearRect(0,0,overlay.width,overlay.height);
    // OpenCV hazırsa kenar tespiti yap
    if(_cvReady && window.cv){
      try{
        const tmp=document.createElement('canvas');
        const sc=0.4; tmp.width=video.videoWidth*sc; tmp.height=video.videoHeight*sc;
        tmp.getContext('2d').drawImage(video,0,0,tmp.width,tmp.height);
        const src=cv.imread(tmp);
        const corners=detectDocCorners(src);
        src.delete();
        if(corners){
          // video contain → overlay ölçek hesabı
          const vw=video.videoWidth, vh=video.videoHeight;
          const ow=overlay.width, oh=overlay.height;
          const scale=Math.min(ow/vw, oh/vh);
          const offX=(ow-vw*scale)/2, offY=(oh-vh*scale)/2;
          const pts=orderCorners(corners).map(p=>({ x:(p.x/sc)*scale+offX, y:(p.y/sc)*scale+offY }));
          ctx.strokeStyle='#22c55e'; ctx.lineWidth=3; ctx.fillStyle='rgba(34,197,94,.12)';
          ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
          for(let i=1;i<4;i++) ctx.lineTo(pts[i].x,pts[i].y);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          pts.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,6,0,7); ctx.fillStyle='#22c55e'; ctx.fill(); });
        }
      }catch(e){}
    }
  }
  draw();
}

/* Sayfa çek — orijinal renkli yüksek çözünürlük yakala */
async function captureScanPage(){
  const video=document.getElementById('scanner-video');
  if(!video||!video.videoWidth){ toast('Kamera henüz hazır değil'); return; }
  haptic(20);
  const shutter=document.getElementById('scanner-shutter');
  if(shutter){ shutter.style.transform='scale(.92)'; setTimeout(()=>shutter.style.transform='',120); }
  const canvas=document.createElement('canvas');
  let w=video.videoWidth, h=video.videoHeight;
  const maxDim=2400;
  if(w>maxDim||h>maxDim){ if(w>h){ h=Math.round(h*maxDim/w); w=maxDim; } else { w=Math.round(w*maxDim/h); h=maxDim; } }
  canvas.width=w; canvas.height=h;
  canvas.getContext('2d').drawImage(video,0,0,w,h);
  let rawUrl=canvas.toDataURL('image/jpeg',0.92);
  // Otomatik kenar tespiti + perspektif düzeltme (renkli korunur)
  const t=showPersistentToast('🔍 Belge işleniyor…');
  try{ rawUrl=await cropDocument(rawUrl); }catch(e){}
  hidePersistentToast(t);
  _scanRawPages.push(rawUrl);
  updateScanCount();
  // Küçük önizleme göster
  const thumb=document.getElementById('scanner-thumb');
  if(thumb){ thumb.style.display='block'; thumb.innerHTML=`<img src="${rawUrl}" style="width:100%;height:100%;object-fit:cover"/>`; }
  toast('📄 Sayfa '+_scanRawPages.length+' eklendi');
}



/* ── PDF READER: OpenCV ile otomatik kenar tespiti + perspektif düzeltme ──
   OpenCV CDN'den LAZY LOAD edilir (sadece tarama yapılınca, ~8MB bir kez) */
let _cvLoading=false, _cvReady=false;
function loadOpenCV(){
  return new Promise((resolve,reject)=>{
    if(_cvReady && window.cv && window.cv.Mat){ resolve(); return; }
    if(_cvLoading){
      const chk=setInterval(()=>{ if(_cvReady){ clearInterval(chk); resolve(); } },200);
      setTimeout(()=>{ clearInterval(chk); if(!_cvReady) reject(new Error('OpenCV zaman aşımı')); },20000);
      return;
    }
    _cvLoading=true;
    const script=document.createElement('script');
    script.src='https://docs.opencv.org/4.10.0/opencv.js';
    script.async=true;
    script.onload=()=>{
      if(window.cv && window.cv.then){
        window.cv.then(()=>{ _cvReady=true; resolve(); });
      } else {
        const chk=setInterval(()=>{
          if(window.cv && window.cv.Mat){ clearInterval(chk); _cvReady=true; resolve(); }
        },200);
        setTimeout(()=>{ clearInterval(chk); if(!_cvReady) reject(new Error('OpenCV başlatılamadı')); },20000);
      }
    };
    script.onerror=()=>{ _cvLoading=false; reject(new Error('OpenCV indirilemedi (internet?)')); };
    document.head.appendChild(script);
  });
}

/* Belge kenarlarını tespit et → 4 köşe döner (yoksa null) */
function detectDocCorners(srcMat){
  const cv=window.cv;
  let gray=new cv.Mat(), blur=new cv.Mat(), edges=new cv.Mat();
  let contours=new cv.MatVector(), hierarchy=new cv.Mat();
  try{
    cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5,5), 0);
    cv.Canny(blur, edges, 75, 200);
    let kernel=cv.Mat.ones(5,5,cv.CV_8U);
    cv.dilate(edges, edges, kernel);
    kernel.delete();
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    let maxArea=0, best=null;
    const imgArea=srcMat.rows*srcMat.cols;
    for(let i=0;i<contours.size();i++){
      const cnt=contours.get(i);
      const area=cv.contourArea(cnt);
      if(area > imgArea*0.2){
        const peri=cv.arcLength(cnt, true);
        let approx=new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02*peri, true);
        if(approx.rows===4 && area>maxArea){
          maxArea=area;
          if(best) best.delete();
          best=approx;
        } else { approx.delete(); }
      }
      cnt.delete();
    }
    if(best){
      const corners=[];
      for(let i=0;i<4;i++){ corners.push({x:best.data32S[i*2], y:best.data32S[i*2+1]}); }
      best.delete();
      return corners;
    }
    return null;
  }catch(e){ console.warn('Kenar tespiti:', e); return null; }
  finally{ gray.delete(); blur.delete(); edges.delete(); contours.delete(); hierarchy.delete(); }
}

/* 4 köşeyi sırala (sol-üst, sağ-üst, sağ-alt, sol-alt) */
function orderCorners(pts){
  const sorted=pts.slice().sort((a,b)=>a.y-b.y);
  const top=sorted.slice(0,2).sort((a,b)=>a.x-b.x);
  const bot=sorted.slice(2,4).sort((a,b)=>a.x-b.x);
  return [top[0], top[1], bot[1], bot[0]];
}

/* Perspektif düzeltme → düz dikdörtgen belge (dataURL) */
function warpDocument(srcMat, corners){
  const cv=window.cv;
  const [tl,tr,br,bl]=orderCorners(corners);
  const wTop=Math.hypot(tr.x-tl.x, tr.y-tl.y);
  const wBot=Math.hypot(br.x-bl.x, br.y-bl.y);
  const hL=Math.hypot(bl.x-tl.x, bl.y-tl.y);
  const hR=Math.hypot(br.x-tr.x, br.y-tr.y);
  const maxW=Math.max(wTop,wBot), maxH=Math.max(hL,hR);
  const srcTri=cv.matFromArray(4,1,cv.CV_32FC2,[tl.x,tl.y, tr.x,tr.y, br.x,br.y, bl.x,bl.y]);
  const dstTri=cv.matFromArray(4,1,cv.CV_32FC2,[0,0, maxW,0, maxW,maxH, 0,maxH]);
  const M=cv.getPerspectiveTransform(srcTri, dstTri);
  let dst=new cv.Mat();
  cv.warpPerspective(srcMat, dst, M, new cv.Size(maxW,maxH));
  const canvas=document.createElement('canvas');
  cv.imshow(canvas, dst);
  const url=canvas.toDataURL('image/jpeg',0.8);
  srcTri.delete(); dstTri.delete(); M.delete(); dst.delete();
  return url;
}

/* Belgeyi kırp (kenar tespit + perspektif düzelt) — RENK KORUNUR, filtre uygulanmaz */
async function cropDocument(dataUrl){
  try{ await loadOpenCV(); }
  catch(e){ return dataUrl; }
  return new Promise((resolve)=>{
    const img=new Image();
    img.onload=()=>{
      try{
        const cv=window.cv;
        const canvas=document.createElement('canvas');
        canvas.width=img.width; canvas.height=img.height;
        canvas.getContext('2d').drawImage(img,0,0);
        const src=cv.imread(canvas);
        const corners=detectDocCorners(src);
        if(corners){
          const warped=warpDocumentMat(src, corners);
          src.delete();
          const outCanvas=document.createElement('canvas');
          cv.imshow(outCanvas, warped);
          warped.delete();
          resolve(outCanvas.toDataURL('image/jpeg',0.92)); // renkli, kırpılmış
        } else {
          src.delete();
          resolve(dataUrl); // kenar yok → orijinal renkli
        }
      }catch(e){ console.warn('crop:', e); resolve(dataUrl); }
    };
    img.onerror=()=>resolve(dataUrl);
    img.src=dataUrl;
  });
}

/* Bir sayfaya FİLTRE uygula (önizlemede seçilen) → dataURL döner */
function applyScanFilter(dataUrl, filter){
  return new Promise((resolve)=>{
    if(filter==='color'){ resolve(dataUrl); return; } // renkli = orijinal
    const img=new Image();
    img.onload=()=>{
      try{
        const canvas=document.createElement('canvas');
        canvas.width=img.width; canvas.height=img.height;
        const ctx=canvas.getContext('2d');
        ctx.drawImage(img,0,0);
        if(filter==='enhance'){
          // Renkli netleştirme: parlaklık + kontrast + doygunluk (gri DEĞİL)
          enhanceColor(ctx, canvas.width, canvas.height);
        } else if(filter==='gray'){
          grayFilter(ctx, canvas.width, canvas.height, false);
        } else if(filter==='bw'){
          // Siyah-beyaz (OpenCV adaptif eşikleme — en net belge)
          if(_cvReady && window.cv){
            try{
              const src=cv.imread(canvas);
              const bw=enhanceDocument(src); src.delete();
              cv.imshow(canvas, bw); bw.delete();
              resolve(canvas.toDataURL('image/jpeg',0.9)); return;
            }catch(e){ grayFilter(ctx,canvas.width,canvas.height,true); }
          } else { grayFilter(ctx,canvas.width,canvas.height,true); }
        }
        resolve(canvas.toDataURL('image/jpeg',0.9));
      }catch(e){ resolve(dataUrl); }
    };
    img.onerror=()=>resolve(dataUrl);
    img.src=dataUrl;
  });
}

/* Renkli netleştirme: parlaklık/kontrast/doygunluk artır (belge canlı ve net) */
function enhanceColor(ctx, w, h){
  const d=ctx.getImageData(0,0,w,h); const p=d.data;
  const contrast=1.35, brightness=12, sat=1.2;
  const f=(259*(contrast*255+255))/(255*(259-contrast*255));
  for(let i=0;i<p.length;i+=4){
    let r=p[i], g=p[i+1], b=p[i+2];
    // kontrast + parlaklık
    r=f*(r-128)+128+brightness; g=f*(g-128)+128+brightness; b=f*(b-128)+128+brightness;
    // doygunluk
    const avg=(r+g+b)/3;
    r=avg+(r-avg)*sat; g=avg+(g-avg)*sat; b=avg+(b-avg)*sat;
    p[i]=Math.max(0,Math.min(255,r)); p[i+1]=Math.max(0,Math.min(255,g)); p[i+2]=Math.max(0,Math.min(255,b));
  }
  ctx.putImageData(d,0,0);
}

/* Gri filtre (yüksek kontrastlı) */
function grayFilter(ctx, w, h, highContrast){
  const d=ctx.getImageData(0,0,w,h); const p=d.data;
  for(let i=0;i<p.length;i+=4){
    let v=0.299*p[i]+0.587*p[i+1]+0.114*p[i+2];
    if(highContrast){ v=(v-128)*1.6+128; }
    v=Math.max(0,Math.min(255,v));
    p[i]=p[i+1]=p[i+2]=v;
  }
  ctx.putImageData(d,0,0);
}



/* Perspektif düzeltme — Mat döndürür (autoScanDocument içinde iyileştirme için) */
function warpDocumentMat(srcMat, corners){
  const cv=window.cv;
  const [tl,tr,br,bl]=orderCorners(corners);
  const wTop=Math.hypot(tr.x-tl.x, tr.y-tl.y);
  const wBot=Math.hypot(br.x-bl.x, br.y-bl.y);
  const hL=Math.hypot(bl.x-tl.x, bl.y-tl.y);
  const hR=Math.hypot(br.x-tr.x, br.y-tr.y);
  const maxW=Math.max(wTop,wBot), maxH=Math.max(hL,hR);
  const srcTri=cv.matFromArray(4,1,cv.CV_32FC2,[tl.x,tl.y, tr.x,tr.y, br.x,br.y, bl.x,bl.y]);
  const dstTri=cv.matFromArray(4,1,cv.CV_32FC2,[0,0, maxW,0, maxW,maxH, 0,maxH]);
  const M=cv.getPerspectiveTransform(srcTri, dstTri);
  let dst=new cv.Mat();
  cv.warpPerspective(srcMat, dst, M, new cv.Size(maxW,maxH));
  srcTri.delete(); dstTri.delete(); M.delete();
  return dst;
}

/* Belge iyileştirme: gri + adaptif eşikleme → net, beyaz zeminli okunabilir belge */
function enhanceDocument(srcMat){
  const cv=window.cv;
  let gray=new cv.Mat();
  cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
  // Hafif bulanıklaştır (gürültü azalt)
  let blur=new cv.Mat();
  cv.GaussianBlur(gray, blur, new cv.Size(3,3), 0);
  gray.delete();
  // Adaptif eşikleme: değişken ışıkta bile net siyah-beyaz
  let thresh=new cv.Mat();
  cv.adaptiveThreshold(blur, thresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 15, 10);
  blur.delete();
  // RGBA'ya çevir (canvas için)
  let out=new cv.Mat();
  cv.cvtColor(thresh, out, cv.COLOR_GRAY2RGBA);
  thresh.delete();
  return out;
}

/* ══════ ÖNİZLEME / ONAY AKIŞI ══════ */

/* Kameradan önizleme görünümüne geç */
async function reviewScanPages(){
  if(!_scanRawPages.length){ toast('En az bir sayfa çekin'); return; }
  _scanFilter='color';
  document.getElementById('scanner-camera-view').style.display='none';
  document.getElementById('scanner-review-view').style.display='flex';
  document.getElementById('scanner-title').textContent='Önizleme';
  // Filtre butonlarını sıfırla
  document.querySelectorAll('.scan-filter-btn').forEach(b=>b.classList.toggle('active', b.dataset.filter==='color'));
  await renderReviewPages();
}

/* Önizleme görünümünden kameraya dön (devam çek) */
function backToCamera(){
  document.getElementById('scanner-camera-view').style.display='flex';
  document.getElementById('scanner-review-view').style.display='none';
  document.getElementById('scanner-title').textContent='Belge Tarayıcı';
}

/* Seçilen filtreyi tüm sayfalara uygula ve önizlemeyi yenile */
async function setScanFilter(filter){
  _scanFilter=filter;
  document.querySelectorAll('.scan-filter-btn').forEach(b=>b.classList.toggle('active', b.dataset.filter===filter));
  await renderReviewPages();
}

/* Önizleme sayfalarını filtre uygulayarak çiz */
async function renderReviewPages(){
  const wrap=document.getElementById('scanner-review-pages');
  if(!wrap) return;
  const rendered=[];
  for(let i=0;i<_scanRawPages.length;i++){
    const img=_scanRawPages[i];   // orijinal renkli (kırpılmış), filtre yok
    _scanPages[i]=img;            // PDF için sakla
    rendered.push(`
      <div class="scan-review-page">
        <span class="scan-page-num">${i+1}</span>
        <div class="scan-page-actions">
          ${i>0?`<button class="scan-page-act" onclick="moveScanPage(${i},-1)" title="Yukarı">↑</button>`:''}
          ${i<_scanRawPages.length-1?`<button class="scan-page-act" onclick="moveScanPage(${i},1)" title="Aşağı">↓</button>`:''}
          <button class="scan-page-act" onclick="deleteScanPage(${i})" title="Sil" style="background:rgba(220,38,38,.85)">🗑️</button>
        </div>
        <img src="${img}"/>
      </div>`);
  }
  wrap.innerHTML=rendered.join('');
}

function moveScanPage(i, dir){
  const j=i+dir;
  if(j<0||j>=_scanRawPages.length) return;
  [_scanRawPages[i],_scanRawPages[j]]=[_scanRawPages[j],_scanRawPages[i]];
  renderReviewPages();
}

function deleteScanPage(i){
  _scanRawPages.splice(i,1);
  _scanPages.splice(i,1);
  updateScanCount();
  if(_scanRawPages.length===0){ backToCamera(); toast('Tüm sayfalar silindi'); return; }
  renderReviewPages();
}

/* Galeriden fotoğraf seç */
function pickFromGallery(){
  const inp=document.getElementById('scanner-gallery-input');
  if(inp){ inp.value=''; inp.click(); }
}

async function onGalleryPicked(ev){
  const files=Array.from(ev.target.files||[]);
  if(!files.length) return;
  const t=showPersistentToast('🔍 Görüntüler işleniyor…');
  for(const file of files){
    try{
      const dataUrl=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
      const cropped=await cropDocument(dataUrl);
      _scanRawPages.push(cropped);
    }catch(e){}
  }
  hidePersistentToast(t);
  updateScanCount();
  toast(files.length+' görüntü eklendi');
}

/* ONAYLA → PDF oluştur ve kaydet */
async function confirmScanPdf(){
  if(!_scanPages.length){ toast('Sayfa yok'); return; }
  const name=await promptDialog({title:'Belge Adı',message:'Belge hangi isimle kaydedilsin?',placeholder:'örn: Bakım Formu',okText:'Kaydet'});
  if(name===null||!name.trim()) return;
  const pages=_scanPages.slice();
  const loading=showPersistentToast('📄 PDF oluşturuluyor…');
  try{
    if(typeof window.jspdf==='undefined'){ hidePersistentToast(loading); toast('⚠️ PDF kütüphanesi yüklenemedi'); return; }
    const { jsPDF } = window.jspdf;
    const pdf=new jsPDF({unit:'pt',format:'a4'});
    const pw=pdf.internal.pageSize.getWidth();
    const ph=pdf.internal.pageSize.getHeight();
    for(let i=0;i<pages.length;i++){
      if(i>0) pdf.addPage();
      const img=new Image(); img.src=pages[i];
      await new Promise(r=>{ img.onload=r; img.onerror=r; });
      let iw=img.width, ih=img.height;
      const ratio=Math.min(pw/iw, ph/ih);
      const dw=iw*ratio, dh=ih*ratio;
      const x=(pw-dw)/2, y=(ph-dh)/2;
      pdf.addImage(pages[i],'JPEG',x,y,dw,dh);
    }
    const blob=pdf.output('blob');
    hidePersistentToast(loading);
    closeScanner();
    await uploadDocBlob(blob, name.trim(), 'application/pdf');
  }catch(err){
    hidePersistentToast(loading);
    toast('❌ PDF oluşturulamadı: '+(err.message||''),5000);
  }
}



/* ══════════════════════════════════════
   TÜP DOLAP DENETİMİ
══════════════════════════════════════ */
function openTupForm(id){
  if(!canDo('inspect')){ toast('🚫 Yetkiniz yok'); return; }
  S.activeEquipId=id;
  const e=equipById(id);
  S.tupRows=e.tupRows?JSON.parse(JSON.stringify(e.tupRows)):[{id:uid(),tupNo:'',kapasite:'6',tarih:'',konum:'',basinc:'',sizinti:'hayir',durum:'bekliyor'}];
  document.getElementById('tup-title').textContent=`🧯 ${e.name} — Tüp Denetimi`;
  renderTupBody();
  showPage('tup');
}

function renderTupBody(){
  const e=equipById(S.activeEquipId);
  document.getElementById('tup-body').innerHTML=`
    <button class="page-back-btn" onclick="goBack()" style="margin-bottom:12px">← Geri</button>
    <p style="font-size:13px;color:var(--txt2);margin-bottom:12px">${safe(mahalById(e?.mahalId)?.name||'')} · ${safe(e?.name||'')}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      <button class="btn btn-secondary btn-sm" onclick="S.tupRows.forEach(r=>r.durum='ok');renderTupRows()">✅ Tümü Uygun</button>
      <button class="btn btn-danger btn-sm"    onclick="S.tupRows.forEach(r=>r.durum='fail');renderTupRows()">❌ Tümü Uygun Değil</button>
    </div>
    <div class="tup-wrap">
      <table class="tup-tbl">
        <thead><tr><th>Tüp No / Konum</th><th>SKT</th><th>Basınç(bar)</th><th>Sızıntı</th><th>Durum</th></tr></thead>
        <tbody id="tup-body-rows"></tbody>
      </table>
    </div>
    <div class="form-group" style="margin-top:16px">
      <label class="form-label">NOT</label>
      <textarea class="form-textarea" id="tup-note" placeholder="İsteğe bağlı…"></textarea>
    </div>
    <button class="btn btn-primary btn-full" style="margin-top:12px" onclick="saveTupForm()">💾 Denetimi Kaydet</button>`;
  renderTupRows();
}

function renderTupRows(){
  const tbody=document.getElementById('tup-body-rows'); if(!tbody) return;
  const inp=(val,idx,field,type='text',extra='')=>`<input value="${safe(val)}" type="${type}" ${extra}
    style="width:100%;padding:5px;border:1px solid var(--brd);border-radius:6px;font-size:12px;background:var(--bg);color:var(--txt)"
    oninput="S.tupRows[${idx}]['${field}']=this.value">`;
  const sel=(val,idx,field,opts,extra='')=>`<select
    style="width:100%;padding:5px;border:1px solid var(--brd);border-radius:6px;font-size:12px;background:var(--bg);color:var(--txt)"
    onchange="S.tupRows[${idx}]['${field}']=this.value;${extra}renderTupRows()">
    ${opts.map(o=>`<option value="${o.v}" ${val===o.v?'selected':''}>${o.l}</option>`).join('')}
  </select>`;

  tbody.innerHTML=S.tupRows.map((r,i)=>`
    <tr class="${r.durum==='ok'?'ok-row':r.durum==='fail'?'fail-row':''}">
      <td>
        ${inp(r.tupNo,i,'tupNo','text','placeholder="T-001"')}<br/>
        <span style="font-size:10px;color:var(--txt3)">${r.kapasite||''}kg · ${r.konum||''}</span>
      </td>
      <td>${inp(r.tarih,i,'tarih','date')}</td>
      <td>${inp(r.basinc,i,'basinc','number','placeholder="150" min="0"')}</td>
      <td>${sel(r.sizinti,i,'sizinti',[{v:'hayir',l:'✅ Hayır'},{v:'evet',l:'⚠️ Evet'}],`if(this.value==='evet')S.tupRows[${i}].durum='fail';`)}</td>
      <td>${sel(r.durum,i,'durum',[{v:'bekliyor',l:'— Girilmedi'},{v:'ok',l:'✅ Uygun'},{v:'fail',l:'❌ Uygun Değil'}],'')}</td>
    </tr>`).join('');
}

async function saveTupForm(){
  const e=equipById(S.activeEquipId); if(!e) return;
  const by=S.cur?.fullname||S.cur?.username||'Admin';
  const note=document.getElementById('tup-note')?.value.trim()||'';
  e.tupRows=JSON.parse(JSON.stringify(S.tupRows));
  e.lastInsp={date:nowStr(),by,answers:{}};
  const rpt=buildReport(e,{},note,by);
  S.reports.unshift(rpt);
  S.logs.unshift({equipId:e.id,equipName:e.name,date:nowStr(),by,status:rpt.result});
  S.activity.unshift({id:'a'+Date.now(),type:'inspect',by,desc:`"${e.name}" tüp denetimi`,extra:rpt.result,date:nowStr()});
  try{
    await save();
    toast('✅ Tüp denetimi kaydedildi');
    openEquipDetail(S.activeEquipId);
  }catch(e){
    toast('❌ Kayıt hatası: '+e.message,5000);
  }
}

/* ══════════════════════════════════════
   DENETİM MODAL
══════════════════════════════════════ */
function openInspModal(id){
  if(!canDo('inspect')){ toast('🚫 Yetkiniz yok'); return; }
  const e=equipById(id); if(!e) return;
  S.inspEquipId=id; S.inspAns={}; S.inspPhotos=[];
  // Taslak var mı? (yarıda kalmış denetim)
  const draft=loadInspDraft(id);
  if(draft) S.inspAns={...draft.answers};
  document.getElementById('insp-title').textContent=`🔍 ${e.name}`;
  const crits=e.criteria||[];
  document.getElementById('insp-body').innerHTML=`
    <div class="insp-prog-wrap"><div class="insp-prog-bar" id="insp-bar" style="width:0%"></div></div>
    <div id="insp-crits"></div>
    <div class="form-group" style="margin-top:14px">
      <label class="form-label">NOT</label>
      <textarea class="form-textarea" id="insp-note" placeholder="İsteğe bağlı…"></textarea>
    </div>
    ${CFG.PHOTOS_ENABLED?`<div class="form-group">
      <label class="form-label">📷 FOTOĞRAF (İSTEĞE BAĞLI)</label>
      <input type="file" id="insp-photo-input" accept="image/*" capture="environment" style="font-size:13px"/>
      <div id="insp-photo-preview" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"></div>
    </div>`:''}
    <div class="form-group" style="margin-top:4px">
      <label style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--obg);border-radius:var(--r8);cursor:pointer">
        <input type="checkbox" id="insp-notify" style="width:18px;height:18px;accent-color:var(--accent)"/>
        <span style="font-size:13px;font-weight:600;color:var(--txt)">🔔 Bu ekipman için yöneticilere bildirim gönder</span>
      </label>
    </div>
    <div class="form-group">
      <label class="form-label">DENETİMİ YAPAN</label>
      <input class="form-input" id="insp-by" value="${safe(S.cur?.fullname||S.cur?.username||'')}"/>
    </div>
    <button class="btn btn-primary btn-full" id="btn-save-insp">💾 Kaydet</button>`;

  document.getElementById('insp-crits').innerHTML=crits.map((c,i)=>{
    const ans=S.inspAns[c]; // taslaktan gelen cevap
    return `<div class="crit-item${ans?' ans-'+ans:''}" id="ci-${i}">
      <div class="crit-lbl">${i+1}. ${safe(c)}</div>
      <div class="crit-btns">
        <button class="tog-btn${ans==='ok'?' ok-on':''}" id="cok-${i}"   onclick="setAns(${i},'ok','${jsStr(c)}')">✅ Uygun</button>
        <button class="tog-btn${ans==='fail'?' fail-on':''}" id="cfail-${i}" onclick="setAns(${i},'fail','${jsStr(c)}')">❌ Uygun Değil</button>
      </div>
    </div>`;}).join('');
  // Taslak varsa progress bar'ı güncelle + bilgi ver
  if(Object.keys(S.inspAns).length){
    const bar=document.getElementById('insp-bar');
    if(bar) bar.style.width=Math.round(Object.keys(S.inspAns).length/(crits.length||1)*100)+'%';
    toast('📝 Yarıda kalan denetim geri yüklendi', 3000);
  }
  document.getElementById('btn-save-insp').addEventListener('click',saveInsp);
  if(CFG.PHOTOS_ENABLED) document.getElementById('insp-photo-input')?.addEventListener('change',handleInspPhoto);
  openModal('modal-insp');
}

/* Denetim taslağı — sessionStorage (yarıda kalırsa kaybolmasın) */
function saveInspDraft(){
  if(!S.inspEquipId) return;
  try{ localStorage.setItem('te_draft_'+S.inspEquipId, JSON.stringify({answers:S.inspAns, ts:Date.now()})); }catch(e){}
}
function loadInspDraft(id){
  try{
    let v=localStorage.getItem('te_draft_'+id);
    if(!v) v=sessionStorage.getItem('te_draft_'+id); // eski taslaklar
    return v?JSON.parse(v):null;
  }catch{ return null; }
}
function clearInspDraft(id){
  try{ localStorage.removeItem('te_draft_'+id); sessionStorage.removeItem('te_draft_'+id); }catch(e){}
}

// Fotoğrafı küçült (max 800px, jpeg %70) ve base64'e çevir
function handleInspPhoto(ev){
  const file=ev.target.files[0]; if(!file) return;
  if(S.inspPhotos.length>=3){ toast('⚠️ En fazla 3 fotoğraf'); return; }
  const img=new Image(), url=URL.createObjectURL(file);
  img.onload=()=>{
    const max=800;
    let{width:w,height:h}=img;
    if(w>h&&w>max){ h=h*max/w; w=max; } else if(h>max){ w=w*max/h; h=max; }
    const cvs=document.createElement('canvas'); cvs.width=w; cvs.height=h;
    cvs.getContext('2d').drawImage(img,0,0,w,h);
    const b64=cvs.toDataURL('image/jpeg',0.7);
    URL.revokeObjectURL(url);
    S.inspPhotos.push(b64);
    renderInspPhotos();
  };
  img.src=url;
  ev.target.value='';
}

function renderInspPhotos(){
  const el=document.getElementById('insp-photo-preview'); if(!el) return;
  el.innerHTML=S.inspPhotos.map((p,i)=>`
    <div style="position:relative">
      <img src="${p}" style="width:60px;height:60px;object-fit:cover;border-radius:8px"/>
      <button onclick="S.inspPhotos.splice(${i},1);renderInspPhotos()" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#ef4444;color:#fff;border:none;font-size:12px;cursor:pointer">×</button>
    </div>`).join('');
}

function setAns(idx,val,lbl){
  S.inspAns[lbl]=val;
  haptic(8);
  document.getElementById('cok-'+idx).className  ='tog-btn'+(val==='ok'  ?' ok-on':'');
  document.getElementById('cfail-'+idx).className='tog-btn'+(val==='fail'?' fail-on':'');
  const ci=document.getElementById('ci-'+idx);
  ci?.classList.remove('ans-ok','ans-fail'); ci?.classList.add('ans-'+val);
  const e=equipById(S.inspEquipId);
  const bar=document.getElementById('insp-bar');
  if(bar) bar.style.width=Math.round(Object.keys(S.inspAns).length/(e?.criteria?.length||1)*100)+'%';
  saveInspDraft(); // her cevapta taslağı kaydet
}

async function saveInsp(){
  const e=equipById(S.inspEquipId); if(!e) return;
  const crits=e.criteria||[];
  if(Object.keys(S.inspAns).length<crits.length){ toast(`⚠️ ${Object.keys(S.inspAns).length}/${crits.length} kriter yanıtlandı`); return; }
  const by=document.getElementById('insp-by')?.value.trim()||S.cur?.username||'Admin';
  const note=document.getElementById('insp-note')?.value.trim()||'';
  e.lastInsp={date:nowStr(),by,answers:{...S.inspAns}};
  const rpt=buildReport(e,S.inspAns,note,by);
  rpt.photos=S.inspPhotos||[];
  S.reports.unshift(rpt);
  S.logs.unshift({equipId:e.id,equipName:e.name,date:nowStr(),by,status:rpt.result});
  S.activity.unshift({id:'a'+Date.now(),type:'inspect',by,desc:`"${e.name}" denetlendi`,extra:rpt.result,date:nowStr()});

  // Uyarı bildirimi — checkbox işaretliyse
  const notify=document.getElementById('insp-notify')?.checked;
  if(notify){
    const m=mahalById(e.mahalId);
    // Uygunsuz kriterleri topla
    const fails=Object.entries(S.inspAns).filter(([k,v])=>v==='fail').map(([k])=>k);
    let msg;
    if(rpt.result==='fail'){
      msg=`KRİTİK BULGU: ${m?.name||''} mahalindeki "${e.name}" ekipmanında sorun var.`;
      if(fails.length) msg+=` Hatalı: ${fails.join(', ')}.`;
    } else {
      msg=`${m?.name||''} mahalindeki "${e.name}" denetlendi — uygun.`;
    }
    if(note) msg+=` Not: ${note}`;
    S.notifications.unshift({
      id:'n'+Date.now(), reportId:rpt.id, equipName:e.name, mahalName:m?.name||'—',
      result:rpt.result, by, note:msg, date:nowStr(), ts:Date.now(), readBy:[],
    });
    if(S.notifications.length>100) S.notifications=S.notifications.slice(0,100);
  }

  try{
    await save();
    clearInspDraft(S.inspEquipId);
    closeModal('modal-insp'); clearActiveInspection();
    toast((rpt.result==='ok'?'✅':'⚠️')+' Denetim kaydedildi: '+rpt.id);
    openReportDetail(rpt.id);
  }catch(err){
    toast('❌ Kayıt hatası: '+err.message,5000);
  }
}

/* ══════════════════════════════════════
   DİNAMİK DENETİM (form şemasına göre)
══════════════════════════════════════ */
let _insp = { equipId:null, form:null, answers:{}, tables:{} };

async function openInspection(equipId, fromContinue=false){
  if(!canDo('inspect')){ toast('🚫 Yetkiniz yok'); return; }
  const e=equipById(equipId); if(!e) return;

  // ORTAK ÇALIŞMA: Bu ekipmanda devam eden bir denetim oturumu var mı?
  // ÖNCE Firebase'den TAZE bak (eşzamanlı açılışta lokal state geç kalabilir)
  let rpt=S.reports.find(r=>r.equipId===equipId && r.incomplete);
  if(_fbConnected && _ref){
    try{
      const fsnap=await _ref.child('reports').get();
      let fr=fsnap.exists()?fsnap.val():[];
      if(fr && !Array.isArray(fr)) fr=Object.values(fr);
      if(Array.isArray(fr)){
        S.reports=fr; // taze listeyi al
        const freshOpen=fr.find(r=>r&&r.equipId===equipId && r.incomplete);
        if(freshOpen) rpt=freshOpen; // taze açık rapor varsa onu kullan
      }
    }catch(err){}
  }
  if(rpt && !fromContinue){
    // Başkası mı başlatmış, ben mi devam ediyorum?
    const others=await checkActiveInspection(equipId);
    if(others){
      // Aynı anda biri daha açık — ORTAK çalışmaya davet et (engelleme yok)
      const ok=await confirmDialog({
        title:'👥 Birlikte Denetim',
        message:`"${safe(others.by)}" şu anda bu ekipmanı denetliyor. Birlikte çalışabilirsiniz — herkes farklı birimleri doldurabilir, değişiklikler anında paylaşılır.\n\nKatılmak ister misiniz?`,
        okText:'✓ Katıl', cancelText:'Vazgeç'
      });
      if(!ok) return;
    } else {
      // Tek başına devam — yarım kalmış kendi/başka raporu
      const who=rpt.by?` (${safe(rpt.by)})`:'';
      const ok=await confirmDialog({
        title:'⏳ Devam Eden Denetim',
        message:`Bu ekipmanda tamamlanmamış bir denetim var${who}. Kaldığı yerden devam edebilirsiniz.`,
        okText:'▶ Devam Et', cancelText:'Vazgeç'
      });
      if(!ok) return;
    }
  }
  // Bu ekipmanı "denetiliyor" olarak işaretle (başkaları görsün)
  registerActiveInspection(equipId);
  // Ekipmanın formu yoksa türünden üret (eski ekipmanlar için)
  let form=e.form;
  if(!form || !form.fields){
    form = (e.cat==='tup-dolap' && e.tupRows!==undefined) ? tupDolapForm() : getCatForm(e.cat);
  }
  _insp={ equipId, form:JSON.parse(JSON.stringify(form)), answers:{}, tables:{} };
  // Taslak geri yükle
  const draft=loadInspDraft(equipId);
  if(draft){ _insp.answers=draft.answers||{}; _insp.tables=draft.tables||{}; if(draft.note!==undefined){ _insp.note=draft.note; _insp.noteTsNum=draft.noteTsNum||0; } }
  // Tablo alanları için satırları kalıcı tanımdan hazırla (boş başlamaz)
  _insp.form.fields.forEach(f=>{
    if(f.type!=='table') return;
    const fixedCols=(f.columns||[]).filter(c=>c.fixed);
    const buildRow=(r)=>{
      const row={ _rowId:r.id, _label:r.label };
      // Sabit künye değerlerini satır tanımından kopyala
      fixedCols.forEach(c=>{ row[c.id]=(r.fixed&&r.fixed[c.id])||''; });
      return row;
    };
    if(!_insp.tables[f.id] || !_insp.tables[f.id].length){
      const defRows=f.rows||[];
      _insp.tables[f.id]=defRows.map(buildRow);
    } else {
      // Taslaktan geldi — yeni satır tanımı eklendiyse onları da ekle, sabit künyeleri tazele
      const existing=new Set(_insp.tables[f.id].map(r=>r._rowId));
      (f.rows||[]).forEach(r=>{
        if(!existing.has(r.id)){ _insp.tables[f.id].push(buildRow(r)); }
        else {
          // Mevcut satırın sabit künyelerini güncel tanımla senkronla
          const exRow=_insp.tables[f.id].find(x=>x._rowId===r.id);
          if(exRow) fixedCols.forEach(c=>{ exRow[c.id]=(r.fixed&&r.fixed[c.id])||''; });
        }
      });
    }
  });
  // FORMLAR VARSAYILAN "UYGUN" GELSİN (QR onayı hariç) — taslak/rapor yoksa
  if(!draft){
    applyPositiveDefaults();
  }
  document.getElementById('insp-title').textContent='🔍 '+e.name;
  // ORTAK ÇALIŞMA OTURUMU başlat
  startCollabSession(equipId, rpt);
  renderInspection();
  openModal('modal-insp');
  if(draft) toast('📝 Yarıda kalan denetim geri yüklendi',3000);
}

/* ── ORTAK DENETİM OTURUMU (canlı, hücre bazında) ──
   Aynı ekipmanı birden fazla kişi aynı anda denetleyebilir.
   Her hücre değişimi anında paylaşılır, kimse kimsenin verisini ezmez. */
/* Formu varsayılan "uygun/olumlu" değerlerle doldur (QR onayı hariç).
   Denetçi sadece sorunlu olanları değiştirir — hız kazandırır. */
function applyPositiveDefaults(){
  const posVal=(type)=>{
    if(type==='okfail'||type==='okfailna') return 'ok';
    if(type==='yesno') return 'evet';
    return null; // text/value/select/qr → dokunma
  };
  _insp.form.fields.forEach(f=>{
    if(f.type==='table'){
      const cols=f.columns||[];
      (_insp.tables[f.id]||[]).forEach(row=>{
        cols.forEach(c=>{
          if(c.fixed || c.type==='qr') return; // sabit künye + QR dokunma
          const pv=posVal(c.type);
          if(pv!==null && (row[c.id]===undefined||row[c.id]==='')){
            row[c.id]=pv; row[c.id+'_ts']=Date.now();
          }
        });
      });
    } else if(f.type!=='qr' && f.type!=='text' && f.type!=='value'){
      const pv=posVal(f.type);
      if(pv!==null && (_insp.answers[f.id]===undefined||_insp.answers[f.id]==='')){
        _insp.answers[f.id]=pv; _insp.answers[f.id+'_tsNum']=Date.now();
      }
    }
  });
}
function startCollabSession(equipId, existingRpt){
  // ORTAK RAPOR ID: Aynı ekipmana aynı gün açan HERKES aynı rapora bağlansın.
  // 1) Firebase'de açık (incomplete) rapor varsa onu kullan (existingRpt)
  // 2) Yoksa ekipman+gün bazlı SABİT id üret — iki kişi aynı anda açsa bile AYNI id'yi üretir
  //    (rastgele id sorunu: eşzamanlı açılışta R1/R2 ayrışıyordu, artık ayrışmaz)
  const dayKey=new Date().toISOString().slice(0,10).replace(/-/g,''); // YYYYMMDD
  let deterministicId='RPR-'+dayKey+'-'+equipId;
  // Aynı gün bu ekipmanın deterministik id'li raporu zaten TAMAMLANMIŞSA
  // (gün içinde 2. denetim) yeni denetim için ayırt edici son ek ekle
  if(!existingRpt){
    const clash=S.reports.find(r=>r&&r.id===deterministicId);
    if(clash && clash.incomplete===false){
      deterministicId='RPR-'+dayKey+'-'+equipId+'-'+Date.now().toString(36).slice(-4);
    }
  }
  _insp.reportId = existingRpt ? existingRpt.id : deterministicId;
  _insp.isNew = !existingRpt;
  _insp._everSaved = !!existingRpt; // mevcut rapora bağlanıyorsak zaten kayıtlı
  // Mevcut yarım raporun cevaplarını yükle (başkasının girdikleri dahil)
  if(existingRpt && existingRpt.formAnswers){
    mergeAnswersIntoInsp(existingRpt.formAnswers);
  }
  // Mevcut yarım raporun GENEL NOTUNU yükle (zaman damgalı)
  if(existingRpt && existingRpt.note!==undefined){
    const remoteTs=existingRpt.noteTsNum||0, myTs=_insp.noteTsNum||0;
    if(remoteTs>=myTs){ _insp.note=existingRpt.note; _insp.noteTsNum=remoteTs; }
  }
  // Canlı dinleme başlat (başka cihaz hücre değiştirince anında gör)
  attachCollabListener();
  // Kendimi bu denetime katılımcı olarak kaydet (ilk açılışta)
  setTimeout(()=>{ doPushCollab(); }, 300);
}

/* Firebase'den gelen cevapları _insp'e birleştir (kendi dokunmadığım hücreleri güncelle) */
function mergeAnswersIntoInsp(remoteAnswers){
  if(!remoteAnswers) return;
  Object.keys(remoteAnswers).forEach(fid=>{
    const rv=remoteAnswers[fid];
    if(Array.isArray(rv)){
      // Tablo: satır satır, hücre hücre zaman damgasına göre birleştir
      if(!_insp.tables[fid]) _insp.tables[fid]=[];
      rv.forEach(remoteRow=>{
        if(!remoteRow || !remoteRow._rowId) return;
        let localRow=_insp.tables[fid].find(r=>r._rowId===remoteRow._rowId);
        if(!localRow){ _insp.tables[fid].push({...remoteRow}); return; }
        // Her veri hücresi için: uzaktaki damga daha yeniyse onu al
        Object.keys(remoteRow).forEach(k=>{
          if(k.endsWith('_ts') || k==='_rowId' || k==='_label') return; // meta atla
          const rVal=remoteRow[k];
          const rTs=remoteRow[k+'_ts']||0;
          const lTs=localRow[k+'_ts']||0;
          // Uzaktaki daha yeni yazıldıysa (veya yerel hiç yazılmadıysa) uzaktakini al
          if(rTs>lTs){
            localRow[k]=rVal;
            localRow[k+'_ts']=rTs;
          }
        });
        // QR onayı (en yeni damga kazanır)
        if(remoteRow._qrOk && (remoteRow._qrTsNum||0) > (localRow._qrTsNum||0)){
          localRow._qrOk=true; localRow._qrTs=remoteRow._qrTs; localRow._qrTsNum=remoteRow._qrTsNum;
        }
      });
    } else if(!fid.endsWith('_ts')){
      // Düz alan: zaman damgasına göre
      const rTs=remoteAnswers[fid+'_tsNum']||0;
      const lTs=_insp.answers[fid+'_tsNum']||0;
      if(rTs>lTs && rv!==undefined && rv!==''){
        _insp.answers[fid]=rv;
        _insp.answers[fid+'_tsNum']=rTs;
      }
    }
  });
}

let _collabRef=null;
function attachCollabListener(){
  detachCollabListener();
  if(!_ref || !_insp || !_insp.reportId) return;
  try{
    // Bu raporun canlı cevaplarını dinle
    _collabRef=_ref.child('reports');
    _collabListener=_collabRef.on('value', snap=>{
      if(!snap.exists() || !_insp) return;
      let reports=snap.val();
      if(reports && !Array.isArray(reports)) reports=Object.values(reports);
      if(!Array.isArray(reports)) return;
      const remote=reports.find(r=>r && r.id===_insp.reportId);
      if(remote){
        // Başka biri denetimi TAMAMLADIYSA: bu kullanıcıyı bilgilendir, ayrı rapor oluşmasını önle
        if(remote.incomplete===false && !_insp._completing){
          detachCollabListener();
          const modalOpen=document.getElementById('modal-insp')?.classList.contains('open');
          if(modalOpen){
            // Son hali göster, sonra kapat
            mergeAnswersIntoInsp(remote.formAnswers||{});
            _insp._closedByOther=true;
            closeModal('modal-insp');
            clearInspDraft(_insp.equipId);
            toast('✅ Bu denetim '+(remote.by?'"'+safe(remote.by)+'" tarafından ':'')+'tamamlandı. Ortak çalışma kapandı.', 6000);
            setTimeout(()=>{ openReportDetail(remote.id); }, 600);
          }
          return;
        }
        if(remote.formAnswers){
          // Modal açıkken canlı birleştir + yeniden çiz (etkileşim varsa beklet)
          const modalOpen=document.getElementById('modal-insp')?.classList.contains('open');
          if(modalOpen){
            mergeAnswersIntoInsp(remote.formAnswers);
            // Genel not senkron: uzaktaki daha yeniyse benimkini güncelle
            if(remote.note!==undefined){
              const remoteTs=remote.noteTsNum||0, myTs=_insp.noteTsNum||0;
              if(remoteTs>myTs){
                _insp.note=remote.note; _insp.noteTsNum=remoteTs;
                const noteEl=document.getElementById('insp-note');
                // Kullanıcı o an not alanına yazmıyorsa güncelle (yazarken imleç bozulmasın)
                if(noteEl && document.activeElement!==noteEl){ noteEl.value=remote.note; }
              }
            }
            liveRenderInspection();
          }
        }
      } else if(_insp._everSaved && !_insp._completing){
        // Rapor Firebase'den SİLİNDİ (başka cihaz/süper admin sildi).
        // Açık oturumu kapat, geri yazma (silineni diriltme) ENGELLE.
        _insp._closedByOther=true;
        detachCollabListener();
        clearInspDraft(_insp.equipId);
        const modalOpen=document.getElementById('modal-insp')?.classList.contains('open');
        if(modalOpen){
          closeModal('modal-insp');
          toast('⚠️ Bu denetim başka bir cihazda silindi. Oturum kapatıldı.', 6000);
          setTimeout(()=>showPage('equipments'), 600);
        }
      }
    });
  }catch(e){ console.warn('collab listener hatası:', e.message); }
}
let _collabListener=null;
function detachCollabListener(){
  if(_collabRef && _collabListener){ try{ _collabRef.off('value', _collabListener); }catch(e){} }
  _collabRef=null; _collabListener=null;
}

function renderInspection(){
  const e=equipById(_insp.equipId);
  const body=document.getElementById('insp-body');
  // Scroll pozisyonunu + yazılan not/denetçi değerlerini koru
  const modal=body.closest('.modal')||body.closest('.page');
  const scrollY=modal?modal.scrollTop:window.scrollY;
  const prevNote=document.getElementById('insp-note')?.value;
  const prevBy=document.getElementById('insp-by')?.value;
  const prevNotify=document.getElementById('insp-notify')?.checked;
  // Tablo yatay scroll pozisyonlarını koru (uygun sütunu sağdayken başa atmasın)
  const hScrolls={};
  body.querySelectorAll('.tup-wrap').forEach((w,idx)=>{ hScrolls[idx]=w.scrollLeft; });

  const fieldsHtml=_insp.form.fields.map(f=>renderInspField(f)).join('');
  const noteVal=prevNote!==undefined?prevNote:(_insp.note||'');
  const byVal=prevBy!==undefined?prevBy:(safe(S.cur?.fullname||S.cur?.username||''));
  // Ortak çalışma göstergesi
  const rpt=S.reports.find(r=>r.id===_insp.reportId);
  const collabCount=(rpt&&rpt.collaborators)?rpt.collaborators.length:1;
  const collabBanner = collabCount>1
    ? `<div style="background:rgba(108,142,245,.12);border:1px solid rgba(108,142,245,.3);border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:var(--accent);font-weight:600">👥 Bu denetim ${collabCount} kişiyle birlikte yürütülüyor — değişiklikler anlık paylaşılıyor</div>`
    : '';
  body.innerHTML=`
    <div style="font-size:12px;color:var(--txt2);margin-bottom:12px">${catById(e.cat).name}</div>
    ${collabBanner}
    ${fieldsHtml}
    <div class="form-group" style="margin-top:14px">
      <label class="form-label">GENEL NOT</label>
      <textarea class="form-textarea" id="insp-note" placeholder="İsteğe bağlı…" oninput="inspNoteChanged(this.value)" onfocus="markInspInteracting(4000)">${safe(noteVal)}</textarea>
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--obg);border-radius:var(--r8);cursor:pointer">
        <input type="checkbox" id="insp-notify" ${prevNotify?'checked':''} style="width:18px;height:18px;accent-color:var(--accent)"/>
        <span style="font-size:13px;font-weight:600;color:var(--txt)">🔔 Yöneticilere bildirim gönder</span>
      </label>
    </div>
    <div class="form-group">
      <label class="form-label">DENETİMİ YAPAN</label>
      <input class="form-input" id="insp-by" value="${byVal}"/>
    </div>
    <div style="display:flex;gap:8px;margin-top:6px">
      <button class="btn btn-secondary" style="flex:1" onclick="saveInspection(false)">💾 Kaydet (devam edecek)</button>
      <button class="btn btn-primary" style="flex:1" onclick="saveInspection(true)">✓ Tamamla</button>
    </div>
    <p style="font-size:11px;color:var(--txt3);text-align:center;margin-top:8px">"Kaydet" ile yarım bırakıp sonra devam edebilirsin. "Tamamla" denetimi bitirir.</p>`;
  // Scroll'u geri yükle (başa atmasın) — dikey + tablo yatay
  body.querySelectorAll('.tup-wrap').forEach((w,idx)=>{ if(hScrolls[idx]!=null) w.scrollLeft=hScrolls[idx]; });
  if(modal && scrollY){
    modal.scrollTop=scrollY;
    requestAnimationFrame(()=>{
      modal.scrollTop=scrollY;
      body.querySelectorAll('.tup-wrap').forEach((w,idx)=>{ if(hScrolls[idx]!=null) w.scrollLeft=hScrolls[idx]; });
    });
  }
  // Etkileşim koruması: bir select/input'a odaklanınca canlı render'ı beklet
  // (kullanıcı seçim yaparken dropdown kapanmasın)
  body.querySelectorAll('select, input, textarea').forEach(el=>{
    el.addEventListener('focus', ()=>markInspInteracting(4000));
    el.addEventListener('mousedown', ()=>markInspInteracting(4000));
    el.addEventListener('touchstart', ()=>markInspInteracting(4000), {passive:true});
    el.addEventListener('blur', ()=>{
      // Odak gidince kısa süre sonra bekleyen render'ı uygula
      setTimeout(()=>{ if(_pendingInspRender && !_inspInteracting){ _pendingInspRender=false; renderInspection(); } }, 300);
    });
  });
}

/* Tek bir form alanını denetim için render et */
function renderInspField(f){
  const val=_insp.answers[f.id];
  let inner='';
  if(f.type==='okfail'||f.type==='okfailna'){
    inner=`<div class="crit-btns">
      <button class="tog-btn${val==='ok'?' ok-on':''}" onclick="inspSet('${f.id}','ok')">✅ Uygun</button>
      <button class="tog-btn${val==='fail'?' fail-on':''}" onclick="inspSet('${f.id}','fail')">❌ Uygun Değil</button>
      ${f.type==='okfailna'?`<button class="tog-btn${val==='na'?' na-on':''}" onclick="inspSet('${f.id}','na')">➖ Yok</button>`:''}
    </div>`;
  } else if(f.type==='yesno'){
    inner=`<div class="crit-btns">
      <button class="tog-btn${val==='evet'?(f.negative!=='hayir'?' fail-on':' ok-on'):''}" onclick="inspSet('${f.id}','evet')">Evet</button>
      <button class="tog-btn${val==='hayir'?(f.negative==='hayir'?' fail-on':' ok-on'):''}" onclick="inspSet('${f.id}','hayir')">Hayır</button>
    </div>`;
  } else if(f.type==='value'){
    const bad=isFieldNegative(f,val);
    const range=(f.min!==undefined&&f.min!=='')||(f.max!==undefined&&f.max!=='')
      ? `<span style="font-size:11px;color:var(--txt3)"> (uygun: ${f.min!==''&&f.min!==undefined?f.min:'−∞'} – ${f.max!==''&&f.max!==undefined?f.max:'+∞'})</span>`:'';
    inner=`<input class="form-input" type="number" value="${val??''}" placeholder="Değer gir"
      style="${bad?'border-color:#ef4444;':''}"
      oninput="inspType('${f.id}',this.value)" onblur="renderInspection()"/>${range}`;
  } else if(f.type==='select'){
    inner=`<select class="form-select" onchange="inspSet('${f.id}',this.value)">
      <option value="">— Seçin —</option>
      ${(f.options||[]).map(o=>`<option value="${safe(o)}" ${val===o?'selected':''}>${safe(o)}</option>`).join('')}
    </select>`;
  } else if(f.type==='text'){
    inner=`<input class="form-input" value="${safe(val||'')}" placeholder="…" oninput="inspType('${f.id}',this.value)"/>`;
  } else if(f.type==='qr'){
    // QR ile onay: ekipman QR'ı okutulunca onaylanır
    if(val==='ok'){
      inner=`<div class="qr-confirmed">✓ QR ile onaylandı${val&&_insp.answers[f.id+'_ts']?` · ${_insp.answers[f.id+'_ts']}`:''}
        <button class="qr-undo" onclick="inspSet('${f.id}','');inspSet('${f.id}_ts','')">↺ geri al</button></div>`;
    } else {
      const SCAN_ICO='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" style="vertical-align:-3px;margin-right:5px"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>';
      const QR_ICO='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="17" height="17" style="vertical-align:-3px;margin-right:4px"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h.01M21 21v-4M17 21h.01"/></svg>';
      inner=`<div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary" style="flex:1" onclick="startQrConfirm('${f.id}')">${SCAN_ICO}QR Okut ve Onayla</button>
        <button class="btn btn-secondary btn-sm" onclick="showQRModal('${_insp.equipId}')" title="Bu ekipmanın QR'ını göster/yazdır">${QR_ICO}QR</button>
      </div>`;
    }
  } else if(f.type==='table'){
    return renderInspTable(f);
  }
  const bad=isFieldNegative(f,val);
  const invalid=(_insp.invalidFields||[]).includes(f.id);
  return `<div class="crit-item${val?(bad?' ans-fail':' ans-ok'):''}${invalid?' insp-invalid':''}" style="display:block">
    <div class="crit-lbl" style="margin-bottom:8px">${safe(f.label)}${f.required?' <span style="color:#ef4444">*</span>':''}${invalid?' <span style="font-size:11px;color:#ef4444;font-weight:600">— bu alan zorunlu</span>':''}</div>
    ${inner}
  </div>`;
}

/* Tablo alanını denetim için render et — eksik hücreler kırmızı, 20 satır sayfalı */
function renderInspTable(f){
  const rows=_insp.tables[f.id]||[];
  const cols=f.columns||[];
  // Bu tablo doğrulamada eksik işaretli mi? (eksik hücreleri kırmızı göstermek için)
  const tableInvalid=(_insp.invalidFields||[]).includes(f.id);
  // Bir hücre eksik mi? (sabit değil + boş/onaysız)
  const cellMissing=(c,row)=>{
    if(!tableInvalid||c.fixed) return false;
    if(c.type==='qr') return !row._qrOk;
    const cv=row[c.id];
    return cv===undefined||cv===null||cv==='';
  };
  // Sayfalama (20 satır)
  const PER=20;
  if(!_insp._tablePage) _insp._tablePage={};
  let page=_insp._tablePage[f.id]||1;
  const pages=Math.ceil(rows.length/PER)||1;
  if(page>pages) page=pages; if(page<1) page=1;
  _insp._tablePage[f.id]=page;
  const startIdx=(page-1)*PER;
  const pageRows=rows.map((r,i)=>({r,i})).slice(startIdx, startIdx+PER);

  const head='<th style="padding:6px 6px;font-size:10px;color:var(--txt2);text-align:left">BİRİM</th>'
    +cols.map(c=>`<th style="padding:6px 8px;font-size:10px;text-transform:uppercase;color:var(--txt2);text-align:left">${safe(c.label)}</th>`).join('');
  const body=pageRows.map(({r:row,i:ri})=>{
    const checked=row._checked;
    const cells=cols.map(c=>{
      const v=row[c.id];
      const bad=isFieldNegative(c,v);
      const miss=cellMissing(c,row);
      const bcol=miss?'#ef4444':(bad?'#ef4444':'var(--brd)');
      const cellBg=miss?'background:rgba(239,68,68,.06);border-radius:6px;':'';
      // Sabit künye sütunu — salt okunur göster (denetçi değiştiremez)
      if(c.fixed){
        return `<td style="padding:4px 6px"><span style="font-size:12px;color:var(--txt2)">${safe(v||'—')}</span></td>`;
      }
      let cell='';
      if(c.type==='okfail'||c.type==='okfailna'){
        cell=`<select onchange="inspTableSet('${f.id}',${ri},'${c.id}',this.value)" style="padding:5px;border:1.5px solid ${bcol};border-radius:6px;font-size:12px;background:var(--bg);color:var(--txt)">
          <option value="">—</option>
          <option value="ok" ${v==='ok'?'selected':''}>✅ Uygun</option>
          <option value="fail" ${v==='fail'?'selected':''}>❌ Değil</option>
          ${c.type==='okfailna'?`<option value="na" ${v==='na'?'selected':''}>➖ Yok</option>`:''}
        </select>`;
      } else if(c.type==='yesno'){
        cell=`<select onchange="inspTableSet('${f.id}',${ri},'${c.id}',this.value)" style="padding:5px;border:1.5px solid ${bcol};border-radius:6px;font-size:12px;background:var(--bg);color:var(--txt)">
          <option value="">—</option>
          <option value="evet" ${v==='evet'?'selected':''}>Evet</option>
          <option value="hayir" ${v==='hayir'?'selected':''}>Hayır</option>
        </select>`;
      } else if(c.type==='select'){
        cell=`<select onchange="inspTableSet('${f.id}',${ri},'${c.id}',this.value)" style="padding:5px;border:1.5px solid ${bcol};border-radius:6px;font-size:12px;background:var(--bg);color:var(--txt)">
          <option value="">—</option>
          ${(c.options||[]).map(o=>`<option value="${safe(o)}" ${v===o?'selected':''}>${safe(o)}</option>`).join('')}
        </select>`;
      } else if(c.type==='qr'){
        const SCAN_ICO='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>';
        const QR_ICO='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h.01M21 21v-4M17 21h.01"/></svg>';
        if(row._qrOk){
          cell=`<div style="display:flex;align-items:center;gap:4px"><span style="font-size:11px;font-weight:700;color:var(--gtxt)">✓</span><button class="qr-ico-btn" onclick="showUnitQR('${_insp.equipId}','${f.id}','${row._rowId||''}')" title="QR'ı göster/yazdır">${QR_ICO}</button></div>`;
        } else {
          cell=`<div style="display:flex;align-items:center;gap:5px${miss?';outline:1.5px solid #ef4444;outline-offset:2px;border-radius:6px':''}"><button class="qr-ico-btn qr-ico-scan" onclick="startUnitQrConfirm('${f.id}','${row._rowId||''}')" title="QR okut ve onayla">${SCAN_ICO}</button><button class="qr-ico-btn" onclick="showUnitQR('${_insp.equipId}','${f.id}','${row._rowId||''}')" title="QR'ı göster/yazdır">${QR_ICO}</button></div>`;
        }
      } else {
        cell=`<input value="${safe(v||'')}" type="${c.type==='value'?'number':'text'}" oninput="inspTableType('${f.id}',${ri},'${c.id}',this.value)" onblur="renderInspection()" style="width:78px;padding:5px;border:1.5px solid ${bcol};border-radius:6px;font-size:12px;background:var(--bg);color:var(--txt)"/>`;
      }
      return `<td style="padding:4px 6px;${cellBg}">${cell}</td>`;
    }).join('');
    const labelCell=`<td style="padding:4px 6px;white-space:nowrap">
      <div style="font-size:12.5px;font-weight:600;color:var(--txt)">${safe(row._label||('Birim '+(ri+1)))}</div>
      ${checked?`<div style="font-size:9px;font-weight:700;color:var(--gtxt)">✓ ${row._checkedAt||'kontrol edildi'}</div>`:''}
      ${row._fieldAdded?'<div style="font-size:9px;color:var(--otxt)">+ sahada eklendi</div>':''}
    </td>`;
    return `<tr style="${checked?'background:rgba(52,211,153,.06)':''}">
      ${labelCell}${cells}
    </tr>`;
  }).join('');
  const emptyTable=!rows.length && tableInvalid;
  return `<div class="crit-item${emptyTable?' insp-invalid':''}" style="display:block">
    <div class="crit-lbl" style="margin-bottom:8px">${safe(f.label)}${f.required?' <span style="color:#ef4444">*</span>':''}${tableInvalid?` <span style="font-size:11px;color:#ef4444;font-weight:600">— ${rows.length?'kırmızı hücreleri doldurun':'en az 1 birim ekleyin'}</span>`:''}</div>
    <div class="tup-wrap"><table class="tup-tbl"><thead><tr>${head}</tr></thead><tbody>${body||''}</tbody></table></div>
    ${pagerHTML(rows.length, page, PER, `_insp._tablePage['${f.id}']=%P%;renderInspection()`)}
    ${rows.length>=20?`<p style="font-size:10.5px;color:var(--txt3);margin-top:4px;text-align:center">${rows.length} birim · sayfa başına 20</p>`:''}
    <button class="btn btn-secondary btn-sm" onclick="inspAddUnit('${f.id}')" style="margin-top:8px">+ Yeni Birim Ekle (sahada)</button>
    ${(f.columns||[]).some(c=>c.type==='qr')?`<button class="btn btn-secondary btn-sm" onclick="printFieldUnitQRs('${f.id}')" style="margin-top:8px;margin-left:6px">🖨️ Bu Tablonun Tüm QR'larını Yazdır</button>`:''}
    <p style="font-size:11px;color:var(--txt3);margin-top:6px">${(f.columns||[]).some(c=>c.type==='qr')?'QR sütununda her birim için "okut" butonu var. Personel okutunca onaylanır.':'QR ile onay istiyorsanız form tasarımcısından "QR ile Onay" tipinde sütun ekleyin.'}</p>
  </div>`;
}

/* Bir tablo alanındaki tüm birimlerin QR'larını yazdır */
function printFieldUnitQRs(fieldId){
  const e=equipById(_insp.equipId); if(!e) return;
  const rows=_insp.tables[fieldId]||[];
  if(!rows.length){ toast('⚠️ Birim yok'); return; }
  const m=mahalById(e.mahalId);
  const cards=rows.map(row=>{
    const data=`TE:${e.id}:${fieldId}:${row._rowId}`;
    const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrPayload(data))}`;
    return `<div style="display:inline-block;border:1.5px dashed #bbb;border-radius:10px;padding:12px;width:200px;text-align:center;margin:6px;vertical-align:top">
      <div style="font-size:13px;font-weight:bold;color:#4f46e5;margin-bottom:6px">TakipEt</div>
      <img src="${qrUrl}" width="180" height="180"/>
      <div style="font-size:13px;font-weight:bold;margin-top:6px">${safe(e.name)}</div>
      <div style="font-size:15px;font-weight:bold;color:#4f46e5">${safe(row._label||'')}</div>
      <div style="font-size:11px;color:#888">${safe(m?.name||'')}</div>
    </div>`;
  }).join('');
  showPrintOverlay(e.name+' — Birim QR\'ları', rows.length+' birim', `<div style="text-align:center">${cards}</div>`);
}

/* Denetim sırasında sahada yeni birim ekle (kalıcı olur) */
async function inspAddUnit(fieldId){
  const label=await promptDialog({title:'Yeni Birim Ekle',message:'Birim adı (örn: T-006):',placeholder:'Birim adı'});
  if(label===null) return;
  const newId=fid();
  if(!_insp.tables[fieldId]) _insp.tables[fieldId]=[];
  _insp.tables[fieldId].push({_rowId:newId, _label:label||('Birim '+(_insp.tables[fieldId].length+1)), _fieldAdded:true});
  // Ekipmanın kalıcı form tanımına da ekle (sonraki denetimlerde gelsin)
  const e=equipById(_insp.equipId);
  if(e&&e.form){
    const ff=e.form.fields.find(x=>x.id===fieldId);
    if(ff){ if(!ff.rows)ff.rows=[]; ff.rows.push({id:newId,label:label||('Birim '+ff.rows.length+1)}); }
  }
  haptic(12);
  saveInspDraftDyn();
  renderInspection();
  toast('✅ Birim eklendi (kalıcı)');
}

/* Birim (tablo satırı) için QR üret ve göster — kalıcı rowId ile */
/* Ekipmanın tablo (birim) içeren formu var mı */
function hasUnits(e){
  const form=e.form||getCatForm(e.cat);
  return (form.fields||[]).some(f=>f.type==='table' && (f.rows||[]).length>0);
}

/* Tüm birim QR'larını tek yazdırılabilir sayfada aç */
function printAllUnitQRs(equipId){
  const e=equipById(equipId); if(!e) return;
  const form=e.form||getCatForm(e.cat);
  const m=mahalById(e.mahalId);
  // Tüm birimleri topla
  const units=[];
  (form.fields||[]).forEach(f=>{
    if(f.type==='table'){
      (f.rows||[]).forEach(r=>{ units.push({fieldId:f.id, rowId:r.id, label:r.label||'Birim', fieldLabel:f.label}); });
    }
  });
  if(!units.length){ toast('⚠️ Bu ekipmanda birim yok'); return; }

  const cards=units.map(u=>{
    const data=`TE:${equipId}:${u.fieldId}:${u.rowId}`;
    const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrPayload(data))}`;
    return `<div class="qcard">
      <div class="qtitle">TakipEt</div>
      <img src="${qrUrl}" width="180" height="180"/>
      <div class="qname">${safe(e.name)}</div>
      <div class="qunit">${safe(u.label)}</div>
      <div class="qmahal">${safe(m?.name||'')}</div>
    </div>`;
  }).join('');
  const body=`<style>
    .qgrid{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
    .qcard{border:1.5px dashed #bbb;border-radius:10px;padding:12px;width:200px;text-align:center;page-break-inside:avoid}
    .qtitle{font-size:13px;font-weight:bold;color:#6C8EF5;margin-bottom:6px}
    .qname{font-size:13px;font-weight:bold;margin-top:6px}
    .qunit{font-size:15px;font-weight:bold;color:#6C8EF5;margin-top:2px}
    .qmahal{font-size:11px;color:#888;margin-top:2px}
  </style>
  <div class="qgrid">${cards}</div>`;
  showPrintOverlay(e.name+' — QR Etiketleri', units.length+' birim', body);
  toast(`✅ ${units.length} QR etiketi hazır`);
}

function showUnitQR(equipId, fieldId, rowId){
  const e=equipById(equipId);
  const rows=_insp.tables[fieldId]||[];
  const row=rows.find(r=>r._rowId===rowId);
  const label=row?row._label:'';
  const qrData=`TE:${equipId}:${fieldId}:${rowId}`;
  const box=document.getElementById('unit-qr-box');
  box.innerHTML=''; box.style.position='relative';
  if(typeof QRCode!=='undefined'){
    try{ new QRCode(box,{text:qrPayload(qrData),width:200,height:200,colorDark:'#111827',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.H}); }
    catch{ const img=document.createElement('img'); img.src=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrPayload(qrData))}`; img.width=200;img.height=200; box.appendChild(img); }
  }
  document.getElementById('unit-qr-lbl').textContent=`${e?e.name:''} · ${label}`;
  window._unitQRData={equipId,name:e?e.name:'',label};
  openModal('modal-unit-qr');
}

function downloadUnitQR(){
  const d=window._unitQRData; if(!d) return;
  const srcCanvas=document.querySelector('#unit-qr-box canvas');
  if(!srcCanvas){ const img=document.querySelector('#unit-qr-box img'); if(img) window.open(img.src,'_blank'); return; }
  const W=300,H=360,ctx0=srcCanvas;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const ctx=cv.getContext('2d');
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#6C8EF5'; ctx.font='bold 18px Inter,sans-serif'; ctx.textAlign='center';
  ctx.fillText('TakipEt', W/2, 30);
  ctx.drawImage(srcCanvas,(W-200)/2,46,200,200);
  ctx.fillStyle='#111827'; ctx.font='bold 16px Inter,sans-serif';
  const nm=d.name.length>24?d.name.slice(0,23)+'…':d.name;
  ctx.fillText(nm, W/2, 276);
  ctx.fillStyle='#6C8EF5'; ctx.font='bold 15px Inter,sans-serif';
  ctx.fillText(d.label||'', W/2, 300);
  ctx.fillStyle='#9ca3af'; ctx.font='11px Inter,sans-serif';
  ctx.fillText('Kontrol için okutun', W/2, 324);
  const a=document.createElement('a'); a.download=`${d.name}-${(d.label||'birim').replace(/[^a-zA-Z0-9]/g,'_')}-QR.png`; a.href=cv.toDataURL('image/png'); a.click();
}

// Buton/select — anında render (kırmızı kenarlık güncellensin)
/* Kullanıcı bir alanla aktif etkileşimdeyken (select açık, input'a yazıyor)
   canlı render'ı ERTELE — dropdown kapanmasın, imleç kaymasın. */
let _inspInteracting=false;
let _pendingInspRender=false;
let _inspInteractTimer=null;
function markInspInteracting(ms=1200){
  _inspInteracting=true;
  clearTimeout(_inspInteractTimer);
  _inspInteractTimer=setTimeout(()=>{
    _inspInteracting=false;
    if(_pendingInspRender){ _pendingInspRender=false; renderInspection(); }
  }, ms);
}
/* Canlı senkron render'ı — etkileşim varsa beklet */
function liveRenderInspection(){
  if(_inspInteracting){ _pendingInspRender=true; return; }
  renderInspection();
}

function inspSet(fid,val){ _insp.answers[fid]=val; _insp.answers[fid+'_tsNum']=Date.now(); if(_insp.invalidFields)_insp.invalidFields=_insp.invalidFields.filter(x=>x!==fid); haptic(8); markInspInteracting(); saveInspDraftDyn(); pushCollabCell(); renderInspection(); }
// Text/value yazma — render YOK (imleç kaymasın), sadece veri tut
function inspType(fid,val){ _insp.answers[fid]=val; _insp.answers[fid+'_tsNum']=Date.now(); if(_insp.invalidFields&&val)_insp.invalidFields=_insp.invalidFields.filter(x=>x!==fid); markInspInteracting(); saveInspDraftDyn(); pushCollabCell(); }

/* Genel not değişti — collab senkron + taslak kaydet */
function inspNoteChanged(val){
  if(!_insp) return;
  _insp.note=val;
  _insp.noteTsNum=Date.now();
  markInspInteracting(4000);
  saveInspDraftDyn();
  pushCollabCell();
}

function inspTableSet(fid,ri,cid,val){ if(!_insp.tables[fid][ri])_insp.tables[fid][ri]={}; _insp.tables[fid][ri][cid]=val; _insp.tables[fid][ri][cid+'_ts']=Date.now(); if(_insp.invalidFields)_insp.invalidFields=_insp.invalidFields.filter(x=>x!==fid); haptic(6); markInspInteracting(); saveInspDraftDyn(); pushCollabCell(); renderInspection(); }
// Tablo içi text/value yazma — render YOK
function inspTableType(fid,ri,cid,val){ if(!_insp.tables[fid][ri])_insp.tables[fid][ri]={}; _insp.tables[fid][ri][cid]=val; _insp.tables[fid][ri][cid+'_ts']=Date.now(); markInspInteracting(); saveInspDraftDyn(); pushCollabCell(); }

/* Hücre değişimini canlı paylaş (debounce'lu — çok sık yazmasın).
   Sadece bu raporu günceller, diğer raporları/dalları ezmez. */
let _collabPushTimer=null;
function pushCollabCell(){
  if(!_insp || !_insp.reportId) return;
  clearTimeout(_collabPushTimer);
  _collabPushTimer=setTimeout(()=>{ doPushCollab(); }, 600);
}
async function doPushCollab(){
  if(!_ref || !_fbConnected || !_insp || !_insp.reportId) return;
  if(_insp._completing || _insp._closedByOther) return; // tamamlanıyor/kapandıysa yazma
  try{
    const e=equipById(_insp.equipId); if(!e) return;
    // Güncel cevapları topla
    const allAnswers={...(_insp.answers)};
    Object.keys(_insp.tables).forEach(tid=>{ allAnswers[tid]=_insp.tables[tid]; });
    // Taze raporları çek
    const snap=await _ref.child('reports').get();
    let reports=snap.exists()?snap.val():[];
    if(reports && !Array.isArray(reports)) reports=Object.values(reports);
    if(!Array.isArray(reports)) reports=[];
    let idx=reports.findIndex(r=>r&&r.id===_insp.reportId);
    const m=mahalById(e.mahalId), cat=catById(e.cat);
    if(idx<0){
      // Rapor Firebase'de YOK. İki ihtimal var:
      if(_insp._everSaved){
        // Daha önce kaydedilmişti ama şimdi yok = BAŞKASI SİLDİ.
        // Geri getirme! Oturumu kapat, kullanıcıyı bilgilendir.
        _insp._closedByOther=true;
        detachCollabListener();
        clearInspDraft(_insp.equipId);
        const modalOpen=document.getElementById('modal-insp')?.classList.contains('open');
        if(modalOpen){
          closeModal('modal-insp');
          toast('⚠️ Bu denetim başka bir cihazda silindi. Oturum kapatıldı.', 6000);
          setTimeout(()=>showPage('equipments'), 600);
        }
        return;
      }
      // İlk kez yazılıyor — yarım rapor olarak oluştur
      reports.unshift({
        id:_insp.reportId, equipId:e.id, equipName:e.name,
        mahalName:m?.name||'—', catName:cat.name, catIcon:cat.icon,
        createdAt:new Date().toISOString(), date:nowStr(),
        by:S.cur?.fullname||S.cur?.username||'—', byId:S.cur?.id||null,
        result:'pend', incomplete:true,
        form:JSON.parse(JSON.stringify(_insp.form)), formAnswers:allAnswers,
        note:_insp.note||'', noteTsNum:_insp.noteTsNum||0,
        photos:[], files:[], collaborators:[S.cur?.id]
      });
      _insp._everSaved=true; // artık kaydedildi olarak işaretle
    } else {
      // ÖNEMLİ: Rapor TAMAMLANMIŞSA üstüne yazma (yarıya çevirme)
      if(reports[idx].incomplete===false) return;
      // Uzaktaki cevaplarla benimkini hücre bazında birleştir (başka katılımcının verisi kaybolmasın)
      const remoteMerged=mergeAnswersForPush(reports[idx].formAnswers||{}, allAnswers);
      reports[idx].formAnswers=remoteMerged;
      reports[idx].incomplete=true;
      reports[idx].date=nowStr();
      // Genel not: zaman damgalı son-yazan-kazanır
      if(_insp.note!==undefined){
        const myTs=_insp.noteTsNum||0, remoteTs=reports[idx].noteTsNum||0;
        if(myTs>=remoteTs){ reports[idx].note=_insp.note; reports[idx].noteTsNum=myTs; }
      }
      if(!reports[idx].collaborators) reports[idx].collaborators=[];
      if(S.cur?.id && !reports[idx].collaborators.includes(S.cur.id)) reports[idx].collaborators.push(S.cur.id);
      _insp._everSaved=true;
    }
    S.reports=reports;
    await _ref.child('reports').set(reports);
  }catch(e){ /* sessiz geç — bir sonraki değişiklikte tekrar denenir */ }
}

/* Push sırasında: uzak (Firebase'deki) cevaplarla yerel cevapları zaman damgasına göre birleştir.
   Böylece A yazarken B'nin hücreleri ezilmez. */
function mergeAnswersForPush(remote, local){
  const out=JSON.parse(JSON.stringify(remote||{}));
  Object.keys(local).forEach(fid=>{
    const lv=local[fid];
    if(Array.isArray(lv)){
      if(!Array.isArray(out[fid])) out[fid]=[];
      lv.forEach(lRow=>{
        if(!lRow||!lRow._rowId) return;
        let oRow=out[fid].find(r=>r&&r._rowId===lRow._rowId);
        if(!oRow){ out[fid].push(JSON.parse(JSON.stringify(lRow))); return; }
        Object.keys(lRow).forEach(k=>{
          if(k==='_rowId'||k==='_label') return;
          if(k.endsWith('_ts')) return;
          const lTs=lRow[k+'_ts']||0, oTs=oRow[k+'_ts']||0;
          if(lTs>=oTs){ oRow[k]=lRow[k]; if(lRow[k+'_ts'])oRow[k+'_ts']=lRow[k+'_ts']; }
        });
        if(lRow._qrOk && (lRow._qrTsNum||0)>=(oRow._qrTsNum||0)){ oRow._qrOk=true; oRow._qrTs=lRow._qrTs; oRow._qrTsNum=lRow._qrTsNum; }
        if(!oRow._label && lRow._label) oRow._label=lRow._label;
      });
    } else if(!fid.endsWith('_tsNum')){
      const lTs=local[fid+'_tsNum']||0, oTs=out[fid+'_tsNum']||0;
      if(lTs>=oTs){ out[fid]=lv; if(local[fid+'_tsNum'])out[fid+'_tsNum']=local[fid+'_tsNum']; }
    }
  });
  return out;
}

function saveInspDraftDyn(){
  if(!_insp.equipId) return;
  try{ localStorage.setItem('te_draft_'+_insp.equipId, JSON.stringify({answers:_insp.answers, tables:_insp.tables, note:_insp.note||'', noteTsNum:_insp.noteTsNum||0, ts:Date.now()})); }catch(e){}
}

async function saveInspection(complete){
  const e=equipById(_insp.equipId); if(!e) return;
  if(complete) _insp._completing=true; // kendi tamamlamamız listener'ı tetiklemesin
  // TAMAMLAMA: denetimde açılan HER kriter doldurulmalı (tablo hücreleri dahil)
  // Kaydet (complete=false): yarım kabul edilir, kontrol yok
  if(complete){
    const missing=[];
    for(const f of _insp.form.fields){
      if(f.type==='table'){
        const rows=_insp.tables[f.id]||[];
        // Tablo boşsa eksik
        if(!rows.length){ missing.push(f.id); continue; }
        // Her birimin her (sabit olmayan) sütunu dolu olmalı
        let tableIncomplete=false;
        for(const row of rows){
          for(const c of (f.columns||[])){
            if(c.fixed) continue; // sabit künye alanları zaten kurulumda girilir
            if(c.type==='qr'){
              // QR sütunu: o birim onaylanmış olmalı
              if(!row._qrOk){ tableIncomplete=true; break; }
            } else {
              const cv=row[c.id];
              if(cv===undefined||cv===null||cv===''){ tableIncomplete=true; break; }
            }
          }
          if(tableIncomplete) break;
        }
        if(tableIncomplete) missing.push(f.id);
      } else if(f.type==='qr'){
        if(_insp.answers[f.id]!=='ok') missing.push(f.id);
      } else if(f.type!=='text'){
        // text dışı tüm alanlar (okfail, yesno, value, select) doldurulmalı
        const v=_insp.answers[f.id];
        if(v===undefined||v===null||v==='') missing.push(f.id);
      } else {
        // text alanı: sadece zorunluysa
        if(f.required){ const v=_insp.answers[f.id]; if(!v||!v.trim()) missing.push(f.id); }
      }
    }
    if(missing.length){
      _insp.invalidFields=missing; _insp._completing=false;
      renderInspection();
      toast('⚠️ Tüm kontrol kriterleri doldurulmalı (kırmızı alanlar). Yarım bırakmak için "Kaydet"i kullanın.', 5500);
      setTimeout(()=>{
        const el=document.querySelector('.insp-invalid');
        if(el) el.scrollIntoView({behavior:'smooth',block:'center'});
      },100);
      return;
    }
    _insp.invalidFields=null;
  }
  // Cevapları birleştir (alan + tablo)
  const allAnswers={...(_insp.answers)};
  Object.keys(_insp.tables).forEach(tid=>{ allAnswers[tid]=_insp.tables[tid]; });
  const result=complete?computeFormResult(_insp.form, allAnswers):'pend';
  const by=document.getElementById('insp-by')?.value.trim()||S.cur?.username||'Admin';
  const note=document.getElementById('insp-note')?.value.trim()||'';

  // ORTAK ÇALIŞMA: bu oturumun rapor id'sini kullan (canlı paylaşılan rapor)
  // Tamamlamadan önce taze veriyi çek — başka katılımcının son girdileri dahil olsun
  if(complete && _fbConnected){
    try{
      const snap=await _ref.child('reports').get();
      let fresh=snap.exists()?snap.val():[];
      if(fresh && !Array.isArray(fresh)) fresh=Object.values(fresh);
      if(Array.isArray(fresh)){
        const remote=fresh.find(r=>r&&r.id===_insp.reportId);
        // Rapor silinmiş mi? (başka cihaz/süper admin sildi)
        if(!remote && _insp._everSaved){
          _insp._completing=false; _insp._closedByOther=true;
          detachCollabListener(); clearInspDraft(_insp.equipId);
          closeModal('modal-insp');
          toast('⚠️ Bu denetim başka bir cihazda silinmiş. Tamamlanamaz, oturum kapatıldı.', 6000);
          setTimeout(()=>showPage('equipments'), 600);
          return;
        }
        if(remote && remote.formAnswers){
          mergeAnswersIntoInsp(remote.formAnswers);
          // Birleştirilmiş güncel cevapları yeniden topla
          Object.keys(_insp.tables).forEach(tid=>{ allAnswers[tid]=_insp.tables[tid]; });
          Object.keys(_insp.answers).forEach(k=>{ if(!Array.isArray(allAnswers[k])) allAnswers[k]=_insp.answers[k]; });
          // Tamamlama kontrolünü taze veriyle TEKRAR yap (başkası eksik bıraktıysa)
          const stillMissing=[];
          for(const f of _insp.form.fields){
            if(f.type==='table'){
              const rows=_insp.tables[f.id]||[];
              if(!rows.length){ stillMissing.push(f.id); continue; }
              let inc=false;
              for(const row of rows){ for(const c of (f.columns||[])){ if(c.fixed)continue; if(c.type==='qr'){if(!row._qrOk){inc=true;break;}}else{const cv=row[c.id];if(cv===undefined||cv===null||cv===''){inc=true;break;}} } if(inc)break; }
              if(inc) stillMissing.push(f.id);
            } else if(f.type==='qr'){ if(_insp.answers[f.id]!=='ok') stillMissing.push(f.id); }
            else if(f.type!=='text'){ const v=_insp.answers[f.id]; if(v===undefined||v===null||v==='') stillMissing.push(f.id); }
          }
          if(stillMissing.length){
            _insp.invalidFields=stillMissing; _insp._completing=false;
            renderInspection();
            toast('⚠️ Birlikte çalıştığınız kişide eksik kalan kısımlar var (kırmızı). Tamamlanmadan bitirilemez.', 5500);
            return;
          }
        }
      }
    }catch(e){}
  }

  // Önceki durum (uygunsuzluk giderildi mi tespiti için)
  const prevStatus=getStatus(e);

  const m=mahalById(e.mahalId);
  const cat=catById(e.cat);

  // ÇAKIŞMA KONTROLÜ: Bu rapor başka biri tarafından TAMAMLANDIYSA
  // benim "Kaydet"im onu yarıya çevirmemeli (veri tutarlılığı)
  if(_fbConnected && _insp.reportId){
    try{
      const fsnap=await _ref.child('reports').get();
      let fr=fsnap.exists()?fsnap.val():[];
      if(fr && !Array.isArray(fr)) fr=Object.values(fr);
      if(Array.isArray(fr)){
        const remoteRpt=fr.find(r=>r&&r.id===_insp.reportId);
        if(remoteRpt && remoteRpt.incomplete===false){
          // Başkası tamamlamış
          if(!complete){
            // Ben sadece kaydedip çıkıyordum → tamamlanmışın üstüne yazma
            detachCollabListener();
            closeModal('modal-insp');
            clearInspDraft(_insp.equipId);
            S.reports=fr; // taze listeyi al
            toast('✅ Bu denetim '+(remoteRpt.by?'"'+safe(remoteRpt.by)+'" tarafından ':'')+'zaten tamamlanmış. Sizin girdileriniz de dahil edildi.', 6000);
            setTimeout(()=>{ openReportDetail(remoteRpt.id); }, 600);
            return;
          }
          // Ben de tamamlıyorum → mevcut tamamlanmışı güncelle (yeni rapor AÇMA)
        }
      }
    }catch(err){}
  }

  // Ortak oturumun raporunu bul (id ile), yoksa oluştur
  let rpt=S.reports.find(r=>r.id===_insp.reportId) || S.reports.find(r=>r.equipId===e.id && r.incomplete);
  const isNew=!rpt;
  if(isNew){
    rpt={ id:_insp.reportId||rid(), equipId:e.id, equipName:e.name,
      mahalName:m?.name||'—', catName:cat.name, catIcon:cat.icon,
      createdAt:new Date().toISOString(), photos:[], files:[] };
  }
  rpt.date=nowStr();
  rpt.by=by; rpt.byId=S.cur?.id||null; rpt.note=note; rpt.result=result;
  rpt.form=JSON.parse(JSON.stringify(_insp.form));
  rpt.formAnswers=allAnswers;
  rpt.incomplete=!complete;  // true = devam ediyor, false = tamamlandı

  // Bildirimler burada TOPLANIR, rapor kaydından SONRA saveNotifSafe ile güvenli yazılır.
  // (Aksi halde saveReportSafe'in tetiklediği tüm-node dinleyicisi yeni bildirimi EZER — "kutu çalışmıyor" bug'ı.)
  const pendingNotifs=[];

  if(complete){
    // Final: ekipmanın son durumunu güncelle
    e.lastInsp={date:nowStr(),by,result,formAnswers:allAnswers};
    e.lastResult=result;
    if(isNew) S.reports.unshift(rpt);
    // İKİZ RAPOR TEMİZLİĞİ: aynı ekipmanın BAŞKA yarım raporları varsa kaldır
    // (eşzamanlı açılışta oluşmuş olabilecek mükerrer yarım raporlar)
    S.reports=S.reports.filter(r=> !(r.equipId===e.id && r.incomplete && r.id!==rpt.id) );
    S.logs.unshift({equipId:e.id,equipName:e.name,date:nowStr(),by,status:result});
    S.activity.unshift({id:'a'+Date.now(),type:'inspect',by,desc:`"${e.name}" denetlendi`,extra:result,date:nowStr()});

    // Otomatik bildirim: uygunsuzluk giderildi (önceki fail → şimdi ok)
    if(prevStatus==='fail' && result==='ok'){
      pendingNotifs.push({
        id:'n'+Date.now()+'r', reportId:rpt.id, equipName:e.name, mahalName:m?.name||'—',
        result:'resolved', type:'resolved', by,
        note:`✅ ${m?.name||''} lokasyonundaki "${e.name}" ekipmanındaki uygunsuzluk giderildi.`,
        date:nowStr(), ts:Date.now(), readBy:[]
      });
    }
    // Bildirim YALNIZCA "Yöneticilere bildirim gönder" kutusu işaretliyse gider (kutu ana anahtar).
    // İşaretlenince kimin GÖRECEĞİ alıcı-kapısında belirlenir: admin, süper admin, yönetici(rol≥3)
    // veya "Bildirim Al" yetkisi olan herkes. (fail→ok geçişi zaten "giderildi" olarak yukarıda bildirilir.)
    if(document.getElementById('insp-notify')?.checked && !(prevStatus==='fail' && result==='ok')){
      const fails=collectFailLabels(_insp.form, allAnswers);
      let msg, type;
      if(result==='fail'){ type='fail'; msg=`${fails.length?fails.join(', '):'Denetim'} sebebiyle ${m?.name||''} lokasyonundaki "${e.name}" ekipmanı uygunsuzdur.`; }
      else { type='ok'; msg=`${m?.name||''} lokasyonundaki "${e.name}" denetlendi — uygun.`; }
      if(note) msg+=` Not: ${note}`;
      pendingNotifs.push({id:'n'+Date.now(),reportId:rpt.id,equipName:e.name,mahalName:m?.name||'—',result,type,by,note:msg,date:nowStr(),ts:Date.now(),readBy:[]});
    }
  } else {
    // Taslak/devam: rapor listesine ekle (yoksa) ama ekipman son durumunu DEĞİŞTİRME
    if(isNew) S.reports.unshift(rpt);
    // Yarım bırakıldı + "bildirim gönder" işaretliyse yöneticilere haber ver (tamamlanmayı bekliyor)
    if(document.getElementById('insp-notify')?.checked){
      // Aynı rapor için tekrar yarım-bildirimi ekleme (spam önle)
      const dup=S.notifications.some(n=>n.type==='incomplete'&&n.reportId===rpt.id);
      if(!dup){
        pendingNotifs.push({id:'n'+Date.now()+'i', reportId:rpt.id, equipName:e.name, mahalName:m?.name||'—',
          result:'pend', type:'incomplete', by,
          note:`⏳ ${m?.name||''} lokasyonundaki "${e.name}" denetimi YARIM bırakıldı — tamamlanmayı bekliyor.${note?' Not: '+note:''}`,
          date:nowStr(), ts:Date.now(), readBy:[]});
      }
    }
  }

  try{
    // Raporu çakışmaya karşı güvenli kaydet (başka cihazın raporlarını ezmez)
    await saveReportSafe(rpt);
    // Ekipman durumu + log için ek kayıt (tamamlanınca)
    if(complete){
      try{ await save(); }catch(e){} // ikincil veriler (lastInsp, log, aktivite)
    }
    // Bildirimleri GÜVENLİ yaz — rapor/ana kayıttan SONRA (dinleyici ezmesin, screenshot 2 bug fix)
    for(const n of pendingNotifs){ try{ await saveNotifSafe(n); }catch(e){} }
    if(complete){
      clearInspDraft(_insp.equipId);
      closeModal('modal-insp'); clearActiveInspection(); detachCollabListener();
      haptic(15);
      toast((result==='ok'?'✅':result==='fail'?'⚠️':'📝')+' Denetim tamamlandı: '+rpt.id);
      updateNotifBell(); // bildirim zilini güncelle (yeni bildirim eklendiyse)
      openReportDetail(rpt.id);
    } else {
      // Taslağı koru (devam edilebilsin)
      saveInspDraftDyn();
      closeModal('modal-insp'); clearActiveInspection(); detachCollabListener();
      haptic(12);
      toast('💾 Denetim kaydedildi (devam edebilirsiniz)');
    }
  }catch(err){ toast('❌ Kayıt hatası: '+err.message,5000); }
}

/* Uygunsuz alan başlıklarını topla (bildirim için) */
function collectFailLabels(form, answers){
  const out=[];
  for(const f of form.fields){
    if(f.type==='table'){
      const rows=answers[f.id]||[];
      rows.forEach((row,i)=>{
        (f.columns||[]).forEach(c=>{ if(!c.fixed && isFieldNegative(c,row[c.id])) out.push(`${row._label||(f.label+' #'+(i+1))} ${c.label}`); });
      });
    } else if(isFieldNegative(f, answers[f.id])){
      out.push(f.label);
    }
  }
  return out;
}

/* ══════════════════════════════════════
   RAPOR (eski format — geriye uyumluluk)
══════════════════════════════════════ */
function buildReport(equip, answers, note='', by=null){
  const reporter=by||S.cur?.fullname||S.cur?.username||'Admin';
  const cat=catById(equip.cat);
  const m=mahalById(equip.mahalId);
  const vals=Object.values(answers);
  const okCount=vals.filter(v=>v==='ok').length;
  const failCount=vals.filter(v=>v==='fail').length;
  const result=equip.cat==='tup-dolap'?getStatus(equip):(failCount>0?'fail':(vals.length>0?'ok':'pend'));
  return {
    id:rid(), equipId:equip.id, equipName:equip.name,
    mahalName:m?.name||'—', catName:cat.name, catIcon:cat.icon,
    date:nowStr(), createdAt:new Date().toISOString(),
    by:reporter, answers:{...answers},
    tupRows: equip.cat==='tup-dolap' ? JSON.parse(JSON.stringify(equip.tupRows||[])) : null,
    okCount, failCount, note, result, totalCrit:equip.criteria?.length||0, photos:[],
  };
}

/* ══════════════════════════════════════
   RAPORLAR SAYFASI
══════════════════════════════════════ */

/* ── RİSK ANALİZİ ──
   Her ekipmanın denetim durumunu hesaplar, mahal bazında risk dağılımı verir */
function computeRiskData(){
  const equips=S.equips||[];
  const data={
    total:equips.length,
    ok:0, soon:0, overdue:0, never:0, none:0,
    failResult:0,        // son denetimi "uygun değil" olanlar
    byMahal:{},          // mahalId → {name, total, overdue, never, soon, fail}
    overdueList:[],      // gecikmiş ekipmanlar
    soonList:[],         // yaklaşan
    neverList:[],        // hiç denetlenmemiş
    failList:[],         // son durumu uygunsuz
  };
  equips.forEach(e=>{
    const st=inspectStatus(e);
    data[st.state]=(data[st.state]||0)+1;
    const mahal=S.mahals.find(m=>m.id===e.mahalId);
    const mName=mahal?mahal.name:'—';
    if(!data.byMahal[e.mahalId]) data.byMahal[e.mahalId]={name:mName, total:0, overdue:0, never:0, soon:0, fail:0};
    const mb=data.byMahal[e.mahalId];
    mb.total++;
    const catName=(catById(e.cat)||{}).name||'—';
    const item={ id:e.id, name:e.name, cat:catName, mahal:mName, days:st.days, period:st.period };
    if(st.state==='overdue'){ data.overdueList.push(item); mb.overdue++; }
    else if(st.state==='never'){ data.neverList.push(item); mb.never++; }
    else if(st.state==='soon'){ data.soonList.push(item); mb.soon++; }
    // Son denetim sonucu uygunsuz mu?
    const lastFail=isEquipCurrentlyFail(e);
    if(lastFail){ data.failResult++; data.failList.push(item); mb.fail++; }
  });
  data.overdueList.sort((a,b)=>(b.days||0)-(a.days||0));
  return data;
}

/* Ekipmanın ŞU ANKİ durumu uygunsuz mu (en son tamamlanmış raporuna göre) */
function isEquipCurrentlyFail(e){
  const reps=(S.reports||[]).filter(r=>r&&r.equipId===e.id && !r.incomplete);
  if(!reps.length) return false;
  reps.sort((a,b)=>{ const da=parseDateStr(a.date), db=parseDateStr(b.date); return (db?db.getTime():0)-(da?da.getTime():0); });
  return reps[0].result==='fail';
}

function openRiskAnalysis(){
  const d=computeRiskData();
  const body=document.getElementById('risk-body');
  if(!body) return;
  const pct=(n)=>d.total?Math.round(n/d.total*100):0;
  const card=(label,val,color,sub)=>`
    <div style="flex:1;min-width:90px;background:var(--bg);border:1px solid var(--brd);border-radius:12px;padding:12px;text-align:center">
      <div style="font-size:26px;font-weight:800;color:${color}">${val}</div>
      <div style="font-size:11px;color:var(--txt2);margin-top:2px">${label}</div>
      ${sub?`<div style="font-size:10px;color:var(--txt3)">${sub}</div>`:''}
    </div>`;
  // Mahal risk satırları
  const mahalRows=Object.values(d.byMahal)
    .map(m=>{ const risk=m.overdue+m.never+m.fail; return {...m, risk}; })
    .sort((a,b)=>b.risk-a.risk)
    .map(m=>{
      const riskColor=m.risk===0?'var(--gtxt)':m.risk<=2?'#ea580c':'var(--rtxt)';
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--brd)">
        <span style="flex:1;font-size:13px;font-weight:600;color:var(--txt)">🏢 ${safe(m.name)}</span>
        <span style="font-size:11px;color:var(--txt3)">${m.total} ekipman</span>
        <span style="font-size:12px;font-weight:700;color:${riskColor};min-width:54px;text-align:right">${m.risk===0?'✓ temiz':m.risk+' risk'}</span>
      </div>`;
    }).join('');
  const listSection=(title, items, color, daysFmt)=>{
    if(!items.length) return '';
    return `<p class="sec-label" style="margin-top:14px;margin-bottom:6px">${title} (${items.length})</p>
      <div style="background:var(--bg);border:1px solid var(--brd);border-radius:10px;overflow:hidden;max-height:220px;overflow-y:auto">
        ${items.map(it=>`<div onclick="openEquipFromRisk('${it.id}')" style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-bottom:1px solid var(--brd);cursor:pointer">
          <span style="flex:1;font-size:12.5px;color:var(--txt)">${safe(it.name)} <span style="color:var(--txt3);font-size:11px">· ${safe(it.cat)} · ${safe(it.mahal)}</span></span>
          ${daysFmt&&it.days!=null?`<span style="font-size:11px;font-weight:700;color:${color};white-space:nowrap">${daysFmt(it.days)}</span>`:''}
          <span style="color:var(--accent);font-size:14px">›</span>
        </div>`).join('')}
      </div>`;
  };
  body.innerHTML=`
    <p style="font-size:12px;color:var(--txt2);line-height:1.5;margin-bottom:12px;background:var(--bg);border-radius:10px;padding:10px 12px">
      Ekipmanların <b>denetim durumu</b> özeti. <b>Denetimi Gecikmiş</b> = periyodu geçmiş; <b>Yaklaşan</b> = 7 günden az kalmış; <b>Şu An Uygunsuz</b> = son denetiminde sorun bulunmuş. Aşağıdaki listede bir ekipmana <b>tıklayınca detayına gidilir</b>.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
      ${card('Toplam', d.total, 'var(--txt)')}
      ${card('Uygun', d.ok, 'var(--gtxt)', '%'+pct(d.ok))}
      ${card('Denetimi Yaklaşan', d.soon, '#ea580c', '7 günden az')}
      ${card('Denetimi Gecikmiş', d.overdue, 'var(--rtxt)', '%'+pct(d.overdue))}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
      ${card('Hiç Denetlenmemiş', d.never, '#6b7280')}
      ${card('Şu An Uygunsuz', d.failResult, 'var(--rtxt)', 'son denetim')}
    </div>
    <p class="sec-label" style="margin-top:14px;margin-bottom:6px">Mahal Bazında Risk</p>
    <div style="background:var(--bg);border:1px solid var(--brd);border-radius:10px;overflow:hidden">
      ${mahalRows||'<div style="padding:14px;text-align:center;color:var(--txt3);font-size:12px">Mahal yok</div>'}
    </div>
    ${listSection('⏰ Denetimi Gecikmiş', d.overdueList, 'var(--rtxt)', x=>x+' gün gecikti')}
    ${listSection('❌ Şu An Uygunsuz', d.failList, 'var(--rtxt)', null)}
    ${listSection('🔔 Denetimi Yaklaşan', d.soonList, '#ea580c', x=>x+' gün kaldı')}
    ${listSection('⚪ Hiç Denetlenmemiş', d.neverList, '#6b7280', null)}
    <button class="btn btn-primary btn-full" style="margin-top:16px" onclick="exportRiskPdf()">📄 PDF Olarak İndir</button>`;
  openModal('modal-risk');
}

/* Risk listesindeki bir ekipmana tıklayınca detayına git (modalı kapat) */
function openEquipFromRisk(id){
  closeModal('modal-risk');
  setTimeout(()=>{ if(equipById(id)) openEquipDetail(id); else toast('⚠️ Ekipman bu şirkette bulunamadı'); }, 250);
}

/* Risk analizini PDF olarak indir */
/* Risk analizi PDF — ekipman raporlarıyla AYNI güzel HTML çıktısı (showPrintOverlay) */
function exportRiskPdf(){
  const d=computeRiskData();
  const pct=(n)=>d.total?Math.round(n/d.total*100):0;
  const company=S.activeCompanyName||S.cur?.companyName||'';
  const sumRow=(k,v,sub)=>`<tr><td>${escapeHtml(k)}</td><td style="text-align:right;font-weight:700">${v}${sub?` <span style="color:#6b7280;font-weight:400">(${sub})</span>`:''}</td></tr>`;
  const listTable=(title, items, daysFmt)=>{
    if(!items.length) return '';
    return `<p class="sec">${escapeHtml(title)} (${items.length})</p>
      <table><tr><th>Ekipman</th><th>Tür</th><th>Mahal</th>${daysFmt?'<th>Durum</th>':''}</tr>
        ${items.map(it=>`<tr><td>${escapeHtml(it.name)}</td><td>${escapeHtml(it.cat)}</td><td>${escapeHtml(it.mahal)}</td>${daysFmt?`<td style="font-weight:700">${it.days!=null?escapeHtml(daysFmt(it.days)):'—'}</td>`:''}</tr>`).join('')}
      </table>`;
  };
  const mahalRows=Object.values(d.byMahal).map(m=>({...m, risk:m.overdue+m.never+m.fail})).sort((a,b)=>b.risk-a.risk);
  const body=`<div class="rpt">
    <div class="rpt-head"><div><div class="rpt-id">RİSK ANALİZİ</div><div class="rpt-name">${escapeHtml(company||'Şirket')}</div></div>
    <div class="rpt-badge" style="background:${d.failResult||d.overdue?'#fee2e2':'#dcfce7'};color:${d.failResult||d.overdue?'#7f1d1d':'#14532d'}">${d.failResult||d.overdue?'⚠ RİSK VAR':'✓ TEMİZ'}</div></div>
    <div class="rpt-meta">${new Date().toLocaleDateString('tr-TR')} · ${d.total} ekipman</div>
    <p class="sec">Özet</p>
    <table>
      ${sumRow('Toplam Ekipman', d.total)}
      ${sumRow('Uygun', d.ok, '%'+pct(d.ok))}
      ${sumRow('Denetimi Yaklaşan (7 günden az)', d.soon)}
      ${sumRow('Denetimi Gecikmiş', d.overdue, '%'+pct(d.overdue))}
      ${sumRow('Hiç Denetlenmemiş', d.never)}
      ${sumRow('Şu An Uygunsuz (son denetim)', d.failResult)}
    </table>
    ${mahalRows.length?`<p class="sec">Mahal Bazında Risk</p><table><tr><th>Mahal</th><th>Ekipman</th><th>Risk</th></tr>
      ${mahalRows.map(m=>`<tr><td>${escapeHtml(m.name)}</td><td>${m.total}</td><td style="font-weight:700;color:${m.risk?'#991b1b':'#065f46'}">${m.risk===0?'temiz':m.risk}</td></tr>`).join('')}</table>`:''}
    ${listTable('Denetimi Gecikmiş', d.overdueList, x=>x+' gün gecikti')}
    ${listTable('Şu An Uygunsuz', d.failList, null)}
    ${listTable('Denetimi Yaklaşan', d.soonList, x=>x+' gün kaldı')}
    ${listTable('Hiç Denetlenmemiş', d.neverList, null)}
  </div>`;
  closeModal('modal-risk');
  showPrintOverlay('Risk Analizi'+(company?' · '+company:''), 'Risk Analizi Raporu', body);
}

function renderReports(){
  // Filtre chips
  const wrap=document.getElementById('report-filter-chips');
  if(wrap){
    const chips=[{id:'all',l:'Tümü'},{id:'ok',l:'✅ Uygun'},{id:'fail',l:'❌ Sorunlu'},{id:'incomplete',l:'⏳ Yarım'}];
    let html=chips.map(c=>`<button class="chip${S.reportFilter===c.id?' active':''}" data-rf="${c.id}">${c.l}</button>`).join('');
    // Mahal (otel) filtresi — birden fazla mahal varsa göster
    if(S.mahals.length>1){
      html+=`<select class="chip-select" id="report-mahal-filter">
        <option value="all" ${(!S.reportMahalFilter||S.reportMahalFilter==='all')?'selected':''}>🏨 Tüm Mahaller</option>
        ${S.mahals.map(m=>`<option value="${m.id}" ${S.reportMahalFilter===m.id?'selected':''}>${m.icon||''} ${safe(m.name)}</option>`).join('')}
      </select>`;
    }
    wrap.innerHTML=html;
    wrap.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{S.reportFilter=b.dataset.rf;S.pgReports=1;renderReports();}));
    const mf=document.getElementById('report-mahal-filter');
    if(mf) mf.addEventListener('change',()=>{ S.reportMahalFilter=mf.value; S.pgReports=1; renderReports(); });
  }

  const q=S.reportQ.toLowerCase();
  let list=[...S.reports].sort((a,b)=>b.createdAt>a.createdAt?1:-1);
  if(S.reportFilter==='incomplete') list=list.filter(r=>r.incomplete);
  else if(S.reportFilter!=='all') list=list.filter(r=>r.result===S.reportFilter && !r.incomplete);
  // Mahal filtresi
  if(S.reportMahalFilter && S.reportMahalFilter!=='all'){
    const mName=mahalById(S.reportMahalFilter)?.name;
    list=list.filter(r=>r.mahalName===mName);
  }
  if(q) list=list.filter(r=>r.equipName.toLowerCase().includes(q)||r.id.toLowerCase().includes(q)||r.by.toLowerCase().includes(q));

  const el=document.getElementById('report-list');
  if(!list.length){ el.innerHTML=`<div class="empty-state"><div class="empty-icon">📋</div><p>Rapor bulunamadı.</p></div>`; return; }

  const total=list.length;
  const PER=15;
  if(!S.pgReports) S.pgReports=1;
  const pages=Math.ceil(total/PER)||1;
  if(S.pgReports>pages) S.pgReports=pages;
  if(S.pgReports<1) S.pgReports=1;
  const start=(S.pgReports-1)*PER;
  const pageList=list.slice(start, start+PER);

  el.innerHTML=pageList.map(r=>`
    <div class="report-row ${r.result}" data-rid="${r.id}">
      <div class="rr-info">
        <div class="rr-no">${r.id}${r.incomplete?' · ⏳ devam ediyor':''}</div>
        <div class="rr-name">${r.catIcon||''} ${safe(r.equipName)}</div>
        <div class="rr-meta">${safe(r.mahalName)} · ${r.date} · ${safe(r.by)}</div>
      </div>
      <span class="status-badge ${r.incomplete?'sb-pend':r.result==='ok'?'sb-ok':'sb-fail'}">${r.incomplete?'⏳':r.result==='ok'?'✅':'❌'}</span>
    </div>`).join('')
    + pagerHTML(total, S.pgReports, PER, 'S.pgReports=%P%;renderReports()')
    + `<div style="text-align:center;font-size:11px;color:var(--txt3);padding:8px 0">${total} rapor</div>`;

  el.querySelectorAll('.report-row').forEach(row=>row.addEventListener('click',()=>openReportDetail(row.dataset.rid)));
}

function openReportDetail(id){ S.activeReportId=id; renderReportDetail(); showPage('report-detail'); }

function renderReportDetail(){
  const r=rptById(S.activeReportId); if(!r) return;
  // Yeni dinamik form formatı (hata olursa boş geç — sayfa donmasın)
  let dynHtml='';
  try{ dynHtml = (r.form && r.formAnswers) ? renderReportForm(r.form, r.formAnswers) : ''; }
  catch(err){ console.warn('Rapor formu render hatası:', err); dynHtml='<p style="font-size:12px;color:var(--txt3)">Form detayı gösterilemedi (eksik veri).</p>'; }
  // Eski format (geriye uyumluluk)
  const critsRows=!dynHtml ? Object.entries(r.answers||{}).map(([k,v],i)=>`
    <tr class="${v}-row"><td>${i+1}</td><td>${safe(k)}</td>
    <td style="font-weight:700;color:${v==='ok'?'var(--gtxt)':'var(--rtxt)'}">${v==='ok'?'✅ Uygun':'❌ Uygun Değil'}</td></tr>`).join('') : '';
  const tupRows=!dynHtml ? (r.tupRows||[]).map(t=>`
    <tr class="${t.durum==='ok'?'ok-row':t.durum==='fail'?'fail-row':''}">
      <td>${t.tupNo}</td><td>${t.kapasite||''}kg</td><td>${t.tarih}</td>
      <td>${t.basinc?t.basinc+' bar':'—'}</td><td>${t.sizinti==='evet'?'⚠️':'✅'}</td>
      <td style="font-weight:700">${t.durum==='ok'?'✅':'❌'}</td>
    </tr>`).join('') : '';

  document.getElementById('report-detail-container').innerHTML=`
    <button class="page-back-btn" onclick="goBack()">← Geri</button>
    <div class="rpt-card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--accent)">${r.id}</div>
          <h2 style="font-size:19px;font-weight:800;color:var(--txt);margin-top:4px">${r.catIcon||''} ${safe(r.equipName)}</h2>
        </div>
        <div class="rpt-result ${r.result}">${r.result==='ok'?'✅ UYGUN':r.result==='fail'?'❌ UYGUN DEĞİL':'⏳ EKSİK'}</div>
      </div>
      <div class="divider"></div>
      <div class="info-row"><span class="ir-key">Tarih</span><span class="ir-val">${r.date}</span></div>
      <div class="info-row"><span class="ir-key">Denetleyen</span><span class="ir-val">${safe(r.by)}</span></div>
      <div class="info-row"><span class="ir-key">Mahal</span><span class="ir-val">${safe(r.mahalName)}</span></div>
      <div class="info-row"><span class="ir-key">Kategori</span><span class="ir-val">${safe(r.catName)}</span></div>
      ${r.note?`<div class="info-row"><span class="ir-key">Not</span><span class="ir-val">${safe(r.note)}</span></div>`:''}
      ${dynHtml}
      ${critsRows?`<p class="sec-label">Kriterler</p><div class="hist-wrap"><table class="crit-table"><tr><th>#</th><th>Kriter</th><th>Sonuç</th></tr>${critsRows}</table></div>`:''}
      ${tupRows?`<p class="sec-label">Tüpler</p><div class="hist-wrap"><table class="crit-table"><tr><th>No</th><th>Kapasite</th><th>SKT</th><th>Basınç</th><th>Sızıntı</th><th>Durum</th></tr>${tupRows}</table></div>`:''}
      ${(CFG.PHOTOS_ENABLED&&r.photos&&r.photos.length)?`<p class="sec-label">📷 Fotoğraflar</p><div style="display:flex;gap:8px;flex-wrap:wrap">${r.photos.map(p=>`<img src="${p}" style="width:90px;height:90px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="window.open().document.write('<img src=\\'${p}\\' style=\\'max-width:100%\\'>')"/>`).join('')}</div>`:''}
      <div class="divider"></div>
      ${r.incomplete?`<div style="background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px;color:var(--otxt)">⏳ Bu denetim henüz tamamlanmadı. Kaldığınız yerden devam edebilirsiniz.</div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${r.incomplete&&r.equipId&&equipById(r.equipId)&&canDo('inspect')?`<button class="btn btn-primary" onclick="continueInspection('${r.equipId}')">▶ Devam Et</button>`:''}
        ${r.equipId&&equipById(r.equipId)?`<button class="btn btn-secondary" onclick="openEquipDetail('${r.equipId}')">📦 Ekipmana Git (geçmiş denetimler)</button>`:''}
        <button class="btn btn-primary" onclick="printReport('${r.id}')">🖨️ PDF</button>
        <button class="btn btn-accent btn-sm" onclick="notifyManagers('${r.id}')">🔔 Yöneticiye Bildir</button>
        ${canDo('delete_report')?`<button class="btn btn-danger btn-sm" onclick="deleteReport('${r.id}')">🗑️</button>`:''}
      </div>
    </div>`;
}

/* Yarım kalan denetime devam et */
function continueInspection(equipId){
  if(!canDo('inspect')){ toast('🚫 Yetkiniz yok'); return; }
  openInspection(equipId, true); // taslak otomatik yüklenir, engeli atla
  goBack();
}

/* Dinamik form cevaplarını rapor için göster */
function renderReportForm(form, answers){
  if(!form||!form.fields) return '';
  let html='<p class="sec-label">Denetim Sonuçları</p>';
  for(const f of form.fields){
    const v=answers[f.id];
    if(f.type==='table'){
      const rows=answers[f.id]||[];
      if(!rows.length) continue;
      const cols=f.columns||[];
      const anyChecked=rows.some(r=>r._checked||r._qrOk);
      html+=`<p style="font-size:12px;font-weight:700;color:var(--txt2);margin:12px 0 6px">${safe(f.label)}</p>
      <div class="hist-wrap"><table class="crit-table"><tr><th>Birim</th>${cols.map(c=>`<th>${safe(c.label)}</th>`).join('')}${anyChecked?'<th>QR Kontrol</th>':''}</tr>
        ${rows.map(row=>`<tr>
          <td style="font-weight:600">${safe(row._label||'—')}</td>
          ${cols.map(c=>{
            // QR sütunu: onaylandıysa SADECE tik işareti (tarih yok), değilse —
            if(c.type==='qr'){
              return `<td style="font-size:13px;text-align:center">${row._qrOk?'<span style="color:var(--gtxt);font-weight:700">✓</span>':'<span style="color:var(--txt3)">—</span>'}</td>`;
            }
            const cv=row[c.id]; const bad=isFieldNegative(c,cv);
            return `<td style="${bad?'color:var(--rtxt);font-weight:700':''}">${fmtFieldVal(c,cv)}</td>`;
          }).join('')}
          ${anyChecked?`<td style="font-size:11px">${(row._checked||row._qrOk)?`<span style="color:var(--gtxt);font-weight:600">${row._checkedAt||row._qrTs||'✓'}</span>`:'<span style="color:var(--txt3)">—</span>'}</td>`:''}
        </tr>`).join('')}
      </table></div>`;
      continue;
    }
    if(f.type==='text'){
      if(v) html+=`<div class="info-row"><span class="ir-key">${safe(f.label)}</span><span class="ir-val">${safe(v)}</span></div>`;
      continue;
    }
    const bad=isFieldNegative(f,v);
    html+=`<div class="info-row"><span class="ir-key">${safe(f.label)}</span>
      <span class="ir-val" style="${bad?'color:var(--rtxt);font-weight:700':v?'color:var(--gtxt);font-weight:600':''}">${fmtFieldVal(f,v)}</span></div>`;
  }
  return html;
}

/* Bir alan değerini okunabilir metne çevir */
function fmtFieldVal(f,v){
  if(v===undefined||v===null||v==='') return '—';
  if(f.type==='okfail'||f.type==='okfailna') return v==='ok'?'✅ Uygun':v==='fail'?'❌ Uygun Değil':'➖ Yok';
  if(f.type==='yesno') return v==='evet'?'Evet':'Hayır';
  return safe(String(v));
}

/* Şu an HÂLÂ uygunsuz olan ekipmanların raporları
   (ekipmanın en son denetimi uygunsuzsa o ekipmanın fail raporlarını al;
    sonradan giderildiyse o ekipman hiç dahil edilmez) */
function currentFailReports(){
  // Hangi ekipmanlar şu an uygunsuz?
  const failEquipIds=new Set(S.equips.filter(e=>getStatus(e)==='fail').map(e=>e.id));
  // O ekipmanların yalnızca uygunsuz çıkan raporları
  return S.reports.filter(r=>r.equipId && failEquipIds.has(r.equipId) && r.result==='fail');
}

function printReport(id){
  const r=rptById(id); if(!r){ toast('Rapor bulunamadı'); return; }
  const dynHtml = (r.form && r.formAnswers) ? printFormHtml(r.form, r.formAnswers) : '';
  const crits=!dynHtml ? Object.entries(r.answers||{}).map(([k,v],i)=>`<tr style="background:${v==='ok'?'#f0fdf4':'#fef2f2'}"><td>${i+1}</td><td>${escapeHtml(k)}</td><td style="font-weight:700;color:${v==='ok'?'#065f46':'#991b1b'}">${v==='ok'?'Uygun':'Uygun Değil'}</td></tr>`).join('') : '';
  const tups=!dynHtml ? (r.tupRows||[]).map(t=>`<tr style="background:${t.durum==='ok'?'#f0fdf4':'#fef2f2'}"><td>${escapeHtml(t.tupNo||'')}</td><td>${escapeHtml(t.kapasite||'')}</td><td>${escapeHtml(t.tarih||'')}</td><td>${escapeHtml(t.basinc||'—')}</td><td>${t.sizinti==='evet'?'Evet':'Hayır'}</td><td style="font-weight:700;color:${t.durum==='ok'?'#065f46':'#991b1b'}">${t.durum==='ok'?'Uygun':'Uygun Değil'}</td></tr>`).join('') : '';
  const badge=r.result==='ok'?'✓ UYGUN':r.result==='fail'?'✗ UYGUN DEĞİL':'⏳ EKSİK';
  const badgeBg=r.result==='ok'?'#dcfce7':r.result==='fail'?'#fee2e2':'#fef3c7';
  const badgeFg=r.result==='ok'?'#14532d':r.result==='fail'?'#7f1d1d':'#92400e';
  const body=`<div class="rpt">
    <div class="rpt-head"><div><div class="rpt-id">${escapeHtml(r.id)}</div><div class="rpt-name">${r.catIcon||''} ${escapeHtml(r.equipName)}</div></div>
    <div class="rpt-badge" style="background:${badgeBg};color:${badgeFg}">${badge}</div></div>
    <div class="rpt-meta">${escapeHtml(r.date)} · ${escapeHtml(r.by)} · ${escapeHtml(r.mahalName)} · ${escapeHtml(r.catName||'')}</div>
    ${r.note?`<div class="rpt-note">Not: ${escapeHtml(r.note)}</div>`:''}
    ${dynHtml||''}
    ${crits?`<p class="sec">Kontrol Kriterleri</p><table><tr><th>#</th><th>Kriter</th><th>Sonuç</th></tr>${crits}</table>`:''}
    ${tups?`<p class="sec">Tüp Kayıtları</p><table><tr><th>Tüp No</th><th>Kapasite</th><th>SKT</th><th>Basınç</th><th>Sızıntı</th><th>Durum</th></tr>${tups}</table>`:''}
  </div>`;
  showPrintOverlay(r.equipName||'Rapor', r.id, body);
}

/* Dinamik form → PDF HTML */
function printFormHtml(form, answers){
  if(!form||!form.fields) return '';
  let html='<p class="sec">Denetim Sonuçları</p>';
  let rows='';
  for(const f of form.fields){
    if(f.type==='table'){
      const trows=answers[f.id]||[];
      if(!trows.length) continue;
      const cols=f.columns||[];
      html+=(rows?`<table>${rows}</table>`:''); rows='';
      html+=`<p class="sec">${escapeHtml(f.label)}</p><table><tr>${cols.map(c=>`<th>${escapeHtml(c.label)}</th>`).join('')}</tr>
        ${trows.map(row=>`<tr>${cols.map(c=>{
          if(c.type==='qr'){ return `<td>${row._qrOk?'Onaylandı '+(row._qrTs||''):'—'}</td>`; }
          const cv=row[c.id];const bad=isFieldNegative(c,cv);return `<td style="${bad?'color:#991b1b;font-weight:700':''}">${escapeHtml(fmtPlain(c,cv))}</td>`;
        }).join('')}</tr>`).join('')}
      </table>`;
      continue;
    }
    const v=answers[f.id]; const bad=isFieldNegative(f,v);
    rows+=`<tr style="background:${v?(bad?'#fef2f2':'#f0fdf4'):'#fff'}"><td>${escapeHtml(f.label)}</td><td style="font-weight:700;color:${bad?'#991b1b':v?'#065f46':'#6b7280'}">${escapeHtml(fmtPlain(f,v))}</td></tr>`;
  }
  if(rows) html+=`<table><tr><th>Kriter</th><th>Sonuç</th></tr>${rows}</table>`;
  return html;
}

/* Düz metin değer (emoji'siz, PDF için) */
function fmtPlain(f,v){
  if(v===undefined||v===null||v==='') return '—';
  if(f.type==='okfail'||f.type==='okfailna') return v==='ok'?'Uygun':v==='fail'?'Uygun Değil':'Yok';
  if(f.type==='yesno') return v==='evet'?'Evet':'Hayır';
  return String(v);
}
function escapeHtml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function printBulkReports(reports, fname){
  if(!reports.length){ toast('⚠️ Rapor yok'); return; }
  // Tarihe göre sırala (eskiden yeniye, gün içinde okunaklı olsun)
  const sorted=[...reports].sort((a,b)=>a.createdAt>b.createdAt?1:-1);
  const sections=sorted.map(r=>{
    // Her raporun TAM içeriği (tablolar/tüp listeleri dahil)
    const dynHtml=(r.form&&r.formAnswers)?printFormHtml(r.form,r.formAnswers):'';
    // Eski format geriye uyumluluk
    let oldC='';
    if(!dynHtml){
      oldC=Object.entries(r.answers||{}).map(([k,v])=>`<tr style="background:${v==='ok'?'#f0fdf4':'#fef2f2'}"><td>${escapeHtml(k)}</td><td style="font-weight:700;color:${v==='ok'?'#065f46':'#991b1b'}">${v==='ok'?'Uygun':'Uygun Değil'}</td></tr>`).join('');
      if(oldC) oldC=`<table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-top:6px"><tr style="background:#f1f5f9"><th style="padding:4px 8px;text-align:left">Kriter</th><th>Sonuç</th></tr>${oldC}</table>`;
      // Eski tüp kayıtları
      if((r.tupRows||[]).length){
        oldC+=`<table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-top:6px"><tr style="background:#f1f5f9"><th>Tüp</th><th>Kapasite</th><th>SKT</th><th>Basınç</th><th>Sızıntı</th><th>Durum</th></tr>${(r.tupRows||[]).map(t=>`<tr><td>${escapeHtml(t.tupNo||'')}</td><td>${escapeHtml(t.kapasite||'')}</td><td>${escapeHtml(t.tarih||'')}</td><td>${escapeHtml(t.basinc||'—')}</td><td>${t.sizinti==='evet'?'Evet':'Hayır'}</td><td style="font-weight:700;color:${t.durum==='ok'?'#065f46':'#991b1b'}">${t.durum==='ok'?'Uygun':'Uygun Değil'}</td></tr>`).join('')}</table>`;
      }
    }
    const badge=r.result==='ok'?'✓ UYGUN':r.result==='fail'?'✗ UYGUN DEĞİL':'⏳ EKSİK';
    const badgeBg=r.result==='ok'?'#dcfce7':r.result==='fail'?'#fee2e2':'#fef3c7';
    const badgeFg=r.result==='ok'?'#14532d':r.result==='fail'?'#7f1d1d':'#92400e';
    return `<div class="rpt">
      <div class="rpt-head">
        <div><div class="rpt-id">${escapeHtml(r.id)}</div><div class="rpt-name">${r.catIcon||''} ${escapeHtml(r.equipName)}</div></div>
        <div class="rpt-badge" style="background:${badgeBg};color:${badgeFg}">${badge}</div>
      </div>
      <div class="rpt-meta">${escapeHtml(r.date)} · ${escapeHtml(r.by)} · ${escapeHtml(r.mahalName)}</div>
      ${r.note?`<div class="rpt-note">Not: ${escapeHtml(r.note)}</div>`:''}
      ${dynHtml||oldC||'<div style="font-size:10px;color:#9ca3af;padding:6px">Detay yok</div>'}
    </div>`;
  }).join('');

  // Yeni sekme YERİNE sayfa içi tam ekran katman (telefonda geri dönülebilir)
  showPrintOverlay(fname, sorted.length+' rapor', sections);
  toast(`✅ ${sorted.length} rapor hazır`);
}

/* Yazdırma içeriğini sayfa içi tam ekran katmanda göster (yeni sekme açmaz) */
function showPrintOverlay(title, subtitle, bodyHtml){
  let ov=document.getElementById('print-overlay');
  if(!ov){
    ov=document.createElement('div');
    ov.id='print-overlay';
    document.body.appendChild(ov);
  }
  ov.innerHTML=`
    <div class="po-bar noprint">
      <button class="po-back" onclick="closePrintOverlay()">← Geri</button>
      <span class="po-title">${escapeHtml(title)}</span>
      <button class="po-print" onclick="window.print()">🖨️ PDF</button>
    </div>
    <div class="po-hint noprint">PDF için 🖨️ butonuna bas. iOS'ta: paylaş menüsünden "PDF olarak kaydet". Bittiğinde ← Geri.</div>
    <div class="po-content" id="po-content">
      <div style="text-align:center;margin-bottom:14px">
        <h1 style="font-size:16px;color:#4f46e5">🔍 TakipEt Denetim Raporları</h1>
        <p style="color:#6b7280;font-size:11px;margin-top:3px">${escapeHtml(subtitle)} · ${new Date().toLocaleDateString('tr-TR')}</p>
      </div>
      ${bodyHtml}
    </div>`;
  ov.style.display='block';
  document.body.classList.add('printing');
  window.scrollTo(0,0);
}
function closePrintOverlay(){
  const ov=document.getElementById('print-overlay');
  if(ov) ov.style.display='none';
  document.body.classList.remove('printing');
}

async function deleteReport(id){
  if(!canDo('delete_report')){ toast('🚫 Yetkiniz yok'); return; }
  if(!await confirmDialog({title:'Rapor Silinsin mi?',message:'Bu denetim raporu kalıcı olarak silinecek.',danger:true,okText:'Evet, Sil'})) return;
  const r=rptById(id);
  S.reports=S.reports.filter(r=>r.id!==id);
  logActivity('report_del', `"${r?.equipName||id}" raporu silindi`, r?.result||'');
  try{ await save(); showPage('reports'); toast('🗑️ Rapor silindi'); }
  catch(e){ toast('❌ Hata: '+e.message,5000); }
}

/* Bir ekipmanın son denetimindeki uygunsuz sebeplerini kısa metin döndür */
function failReasonsShort(e){
  const lastRpt=S.reports.filter(r=>r.equipId===e.id).sort((a,b)=>b.createdAt>a.createdAt?1:-1)[0];
  let reasons=[];
  if(lastRpt&&lastRpt.form&&lastRpt.formAnswers){
    reasons=collectFailLabels(lastRpt.form, lastRpt.formAnswers);
  } else if(lastRpt&&lastRpt.answers){
    reasons=Object.entries(lastRpt.answers).filter(([k,v])=>v==='fail').map(([k])=>k);
  }
  // En fazla 4 sebep göster, fazlasını özetle
  if(reasons.length>4) return reasons.slice(0,4).join(', ')+` ve ${reasons.length-4} sorun daha`;
  return reasons.join(', ')||'denetim uygunsuz';
}

/* ══════════════════════════════════════
   UYGUNSUZ RAPORLARI MAİL GÖNDER (kısa format)
══════════════════════════════════════ */
function mailFailReports(){
  const failEquips=S.equips.filter(e=>getStatus(e)==='fail');
  if(!failEquips.length){ toast('✅ Uygunsuz ekipman yok'); return; }
  const today=new Date().toLocaleDateString('tr-TR');
  let body=`Uygunsuz Ekipman Bildirimi — ${today}\n`;
  body+=`Toplam ${failEquips.length} ekipmanda uygunsuzluk tespit edildi.\n\n`;
  failEquips.forEach(e=>{
    const m=mahalById(e.mahalId)?.name||'—';
    const reasons=failReasonsShort(e);
    const date=e.lastInsp?e.lastInsp.date:'—';
    // Tek satır: [sebepler] sebebiyle [mahal]'deki [ekipman] uygunsuzdur. (tarih)
    body+=`• ${reasons} sebebiyle ${m} lokasyonundaki "${e.name}" ekipmanı uygunsuzdur. (${date})\n`;
  });
  body+=`\nTakipEt Denetim Sistemi`;
  const subject=`Uygunsuz Ekipman Bildirimi — ${today} (${failEquips.length} adet)`;
  window.location.href=`mailto:${NOTIFY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  toast('📧 Mail uygulaması açılıyor…');
}

/* ══════════════════════════════════════
   GİDERİLEN UYGUNSUZLUKLARI MAİL GÖNDER
══════════════════════════════════════ */
function mailResolvedReports(){
  // Son denetimde "ok" olan ve daha önce uygunsuzluk geçmişi olan ekipmanlar
  const resolved=S.equips.filter(e=>{
    if(getStatus(e)!=='ok') return false;
    const reps=S.reports.filter(r=>r.equipId===e.id).sort((a,b)=>b.createdAt>a.createdAt?1:-1);
    return reps.length>=2 && reps[1].result==='fail'; // bir önceki uygunsuzdu
  });
  if(!resolved.length){ toast('ℹ️ Yeni giderilen uygunsuzluk yok'); return; }
  const today=new Date().toLocaleDateString('tr-TR');
  let body=`Giderilen Uygunsuzluk Bildirimi — ${today}\n`;
  body+=`${resolved.length} ekipmandaki uygunsuzluk giderildi.\n\n`;
  resolved.forEach(e=>{
    const m=mahalById(e.mahalId)?.name||'—';
    const date=e.lastInsp?e.lastInsp.date:'—';
    body+=`• ${m} lokasyonundaki "${e.name}" ekipmanındaki uygunsuzluk giderildi. (${date})\n`;
  });
  body+=`\nTakipEt Denetim Sistemi`;
  const subject=`Giderilen Uygunsuzluk Bildirimi — ${today} (${resolved.length} adet)`;
  window.location.href=`mailto:${NOTIFY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  toast('📧 Mail uygulaması açılıyor…');
}

/* ══════════════════════════════════════
   EXCEL (CSV) EXPORT
══════════════════════════════════════ */
function exportReportsExcel(){
  if(!S.reports.length){ toast('⚠️ Rapor yok'); return; }
  const rows=[['Rapor No','Tarih','Ekipman','Kategori','Mahal','Denetleyen','Sonuç','Uygun','Uygun Değil','Not']];
  [...S.reports].sort((a,b)=>b.createdAt>a.createdAt?1:-1).forEach(r=>{
    // Uygun/uygunsuz sayısı — dinamik form veya eski format
    let okC=r.okCount||0, failC=r.failCount||0;
    if(r.form && r.formAnswers){
      okC=0; failC=0;
      for(const f of r.form.fields){
        if(f.type==='table'){
          (r.formAnswers[f.id]||[]).forEach(row=>{
            (f.columns||[]).forEach(c=>{ const v=row[c.id]; if(v!==undefined&&v!==''&&c.type!=='text'){ isFieldNegative(c,v)?failC++:okC++; }});
          });
        } else if(f.type!=='text'){
          const v=r.formAnswers[f.id];
          if(v!==undefined&&v!==''){ isFieldNegative(f,v)?failC++:okC++; }
        }
      }
    }
    rows.push([
      r.id, r.date, r.equipName, r.catName, r.mahalName, r.by,
      r.result==='ok'?'UYGUN':r.result==='fail'?'UYGUN DEĞİL':'EKSİK',
      okC, failC, (r.note||'').replace(/[\n\r;]/g,' ')
    ]);
  });
  // CSV — Excel Türkçe karakter için BOM + ; ayraç
  const csv='\uFEFF'+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`TakipEt-Raporlar-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('📊 Excel (CSV) indirildi');
}

/* ══════════════════════════════════════
   YÖNETİCİYE BİLDİR
══════════════════════════════════════ */
async function notifyManagers(reportId){
  const r=rptById(reportId); if(!r) return;
  const note=await promptDialog({
    title:'🔔 Yöneticiye Bildir',
    message:'İletmek istediğiniz not (isteğe bağlı):',
    placeholder:'Örn: Acil müdahale gerekiyor…',
    multiline:true, okText:'Gönder'
  });
  if(note===null) return; // iptal
  const notif={
    id:'n'+Date.now(),
    reportId:r.id, equipName:r.equipName, mahalName:r.mahalName,
    result:r.result, by:S.cur?.fullname||S.cur?.username||'—',
    note:note||'', date:nowStr(), ts:Date.now(),
    readBy:[],  // okuyan admin/yönetici id'leri
  };
  S.notifications.unshift(notif);
  if(S.notifications.length>100) S.notifications=S.notifications.slice(0,100);
  try{
    await save();
    updateNotifBell();
    toast('🔔 Yöneticilere bildirim gönderildi');
  }catch(e){ toast('❌ '+e.message,5000); }
}

/* Okunmamış bildirim sayısı (admin/yönetici için) */
function unreadNotifCount(){
  if(!S.cur) return 0;
  return S.notifications.filter(n=>isNotifVisibleToMe(n) && !(n.readBy||[]).includes(S.cur.id)).length;
}

async function markNotifRead(id){
  const n=S.notifications.find(x=>x.id===id);
  if(!n) return;
  n.readBy=n.readBy||[];
  if(!n.readBy.includes(S.cur.id)){ n.readBy.push(S.cur.id); await save(); }
}

function openNotifications(){
  renderNotifications();
  showPage('notifications');
}

function renderNotifications(){
  const el=document.getElementById('notif-container'); if(!el) return;
  // Sadece bana görünür bildirimler (hedef kitledeyim + silmediğim) — zil ile aynı kural
  const notifs=S.notifications.filter(n=>isNotifVisibleToMe(n)).sort((a,b)=>b.ts-a.ts);
  const PER=10;
  if(!S.pgNotif) S.pgNotif=1;
  const pages=Math.ceil(notifs.length/PER)||1;
  if(S.pgNotif>pages) S.pgNotif=pages;
  if(S.pgNotif<1) S.pgNotif=1;
  const start=(S.pgNotif-1)*PER;
  let html=`<button class="page-back-btn" onclick="goBack()">← Geri</button>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
      <p class="sec-label" style="margin:0">🔔 Bildirimler (${notifs.length})</p>
      ${notifs.length?`<button class="btn btn-secondary btn-sm" onclick="clearAllNotifs()" style="font-size:11px;padding:5px 10px">🗑️ Tümünü Temizle</button>`:''}
    </div>`;
  if(!notifs.length){
    html+=`<div class="empty-state"><div class="empty-icon">🔔</div><p>Bildirim yok.</p></div>`;
  } else {
    html+=notifs.slice(start, start+PER).map(n=>{
      const unread=!(n.readBy||[]).includes(S.cur.id);
      const t=n.type||n.result;
      // Türe göre renk + ikon
      let icon='🔔', accent='var(--accent)';
      if(t==='fail'){ icon='🔴'; accent='#ef4444'; }
      else if(t==='resolved'){ icon='🟢'; accent='#22c55e'; }
      else if(t==='ok'){ icon='✅'; accent='#22c55e'; }
      else if(t==='overdue'){ icon='⏰'; accent='#f59e0b'; }
      else if(t==='incomplete'){ icon='⏳'; accent='#f59e0b'; }
      else if(t==='wo_new'){ icon='🗂️'; accent='var(--accent)'; }
      else if(t==='wo_done'){ icon='✅'; accent='#22c55e'; }
      else if(t==='wo_approved'){ icon='👍'; accent='#22c55e'; }
      return `<div class="ed-card" style="margin-bottom:10px;border-left:3px solid ${accent};${unread?'':'opacity:.82'}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1;min-width:0;cursor:pointer" onclick="markNotifRead('${n.id}').then(()=>{${n.woId?`openWorkOrderDetail('${n.woId}')`:n.reportId?`openReportDetail('${n.reportId}')`:n.equipId?`openEquipDetail('${n.equipId}')`:''}})">
            <div style="font-weight:700;color:var(--txt);font-size:14px">${icon} ${safe(n.equipName)}</div>
            <div style="font-size:12px;color:var(--txt2);margin-top:2px">${safe(n.mahalName)}${n.by?' · '+safe(n.by):''}</div>
            ${n.note?`<div style="font-size:13px;color:var(--txt);margin-top:6px;padding:8px;background:var(--bg);border-radius:8px">${safe(n.note)}</div>`:''}
            <div style="font-size:11px;color:var(--txt3);margin-top:8px">${n.date}</div>
          </div>
          <button class="fd-mini fd-del" onclick="event.stopPropagation();deleteNotif('${n.id}')" title="Bildirimi sil">🗑️</button>
        </div>
      </div>`;
    }).join('');
    html+=pagerHTML(notifs.length, S.pgNotif, PER, 'S.pgNotif=%P%;renderNotifications()');
  }
  el.innerHTML=html;
}

async function deleteNotif(id){
  // Kişiye özel silme: bildirimi tamamen kaldırma, sadece bu kullanıcıdan gizle
  const n=S.notifications.find(x=>x.id===id);
  if(n){
    n.deletedBy=n.deletedBy||[];
    if(S.cur?.id && !n.deletedBy.includes(S.cur.id)) n.deletedBy.push(S.cur.id);
    // Herkes sildiyse tamamen kaldır (yer kaplamasın)
    const recipients=notifRecipients(n);
    if(recipients.length && recipients.every(uid=>n.deletedBy.includes(uid))){
      S.notifications=S.notifications.filter(x=>x.id!==id);
    }
  }
  try{ await save(); renderNotifications(); updateNotifBell(); }catch(e){ toast('❌ '+e.message); }
}
async function clearAllNotifs(){
  if(!await confirmDialog({title:'Bildirimleriniz Temizlensin mi?',message:'Sadece sizin bildirim listeniz temizlenecek (diğer kullanıcıları etkilemez).',danger:true,okText:'Temizle'})) return;
  // Kişiye özel: sadece kendi görünür bildirimlerini deletedBy'a ekle
  S.notifications.forEach(n=>{
    if(isNotifVisibleToMe(n)){
      n.deletedBy=n.deletedBy||[];
      if(S.cur?.id && !n.deletedBy.includes(S.cur.id)) n.deletedBy.push(S.cur.id);
    }
  });
  // Tamamen herkesçe silinmişleri kaldır
  S.notifications=S.notifications.filter(n=>{
    const recipients=notifRecipients(n);
    return !(recipients.length && recipients.every(uid=>(n.deletedBy||[]).includes(uid)));
  });
  try{ await save(); renderNotifications(); updateNotifBell(); toast('🗑️ Bildirimleriniz temizlendi'); }catch(e){ toast('❌ '+e.message); }
}
/* Bir bildirimin HEDEF KİTLESİ (rol/yetki sistemine göre alması gereken kullanıcı id'leri).
   TEK KAYNAK — zil sayısı, liste ve temizlik hep bunu kullanır (tutarlılık). */
function notifRecipients(n){
  // Bakım bildirimi: bakım uyarısı alanlar
  if(n && n.type==='maintenance'){
    return S.users.filter(u=>u.isSuper || roleLevel(u.role)>=3 || getUserPerms(u).includes('maint_warn')).map(u=>u.id);
  }
  // Diğerleri: yönetici+ (rol seviyesi 3+) VEYA "Bildirim Al" yetkisi olanlar
  return S.users.filter(u=>u.isSuper || roleLevel(u.role)>=3 || getUserPerms(u).includes('view_notifications')).map(u=>u.id);
}
/* Bu bildirim BANA görünür mü? (hedef kitledeyim VE silmemişsem) */
function isNotifVisibleToMe(n){
  if(!S.cur) return false;
  if((n.deletedBy||[]).includes(S.cur.id)) return false;
  if(S.cur.isSuper) return true;                 // süper admin tümünü görür (S.users'ta yok)
  if(Array.isArray(n.toIds)) return n.toIds.includes(S.cur.id); // HEDEFLİ bildirim (iş emri vb.)
  return notifRecipients(n).includes(S.cur.id);  // rol bazlı: sadece hedef kitledeysem
}

/* ══════════════════════════════════════
   QR TOPLU YAZDIRMA
══════════════════════════════════════ */
function printAllQR(){
  if(!S.equips.length){ toast('⚠️ Ekipman yok'); return; }
  const cards=S.equips.map(e=>{
    const cat=catById(e.cat);
    const m=mahalById(e.mahalId);
    const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=150x150&ecc=H&data=${encodeURIComponent(qrPayload(e.id))}`;
    return `<div style="display:inline-block;width:190px;border:1px solid #ddd;border-radius:8px;padding:12px;margin:6px;text-align:center;page-break-inside:avoid;vertical-align:top">
      <img src="${qrUrl}" width="150" height="150" style="border-radius:6px"/>
      <div style="font-weight:700;font-size:13px;margin-top:8px">${cat.icon} ${safe(e.name)}</div>
      <div style="font-size:11px;color:#666;margin-top:2px">${m?safe(m.name):''}</div>
    </div>`;
  }).join('');
  showPrintOverlay('Tüm QR Etiketleri', S.equips.length+' ekipman', `<div style="text-align:center">${cards}</div>`);
  toast(`✅ ${S.equips.length} QR etiketi hazır`);
}

/* ══════════════════════════════════════
   DASHBOARD & ANALİZ (admin/yönetici)
══════════════════════════════════════ */
function openDashboard(){
  if(ROLE_LEVEL[S.cur?.role]<3){ toast('🚫 Yetkiniz yok'); return; }
  renderDashboard();
  showPage('dashboard');
}

// Dashboard'da gösterilecek kartlar (kullanıcı seçebilir, sessionStorage'da)
function getDashCards(){
  try{ const v=sessionStorage.getItem('te_dash'); return v?JSON.parse(v):['summary','byCat','byMahal','topFail','timeline','due']; }
  catch{ return ['summary','byCat','byMahal','topFail','timeline','due']; }
}
function setDashCards(arr){ try{ sessionStorage.setItem('te_dash',JSON.stringify(arr)); }catch(e){} }

/* Dashboard özet kartından ekipmanlar sayfasına FİLTRELİ git */
function dashGoEquip(filter){
  S.filterCat=filter||'all';
  S.searchQ=''; S.pgEquip=1;
  const sb=document.getElementById('search-bar'); if(sb) sb.value='';
  showPage('equipments');
  try{ renderEquipments(); }catch(e){}
}

function renderDashboard(){
  const el=document.getElementById('dashboard-container'); if(!el) return;
  const active=getDashCards();
  const total=S.equips.length;
  const ok=S.equips.filter(e=>getStatus(e)==='ok').length;
  const fail=S.equips.filter(e=>getStatus(e)==='fail').length;
  const pend=S.equips.filter(e=>getStatus(e)==='pend').length;

  const allCards=[
    {id:'summary',  label:'📊 Genel Özet'},
    {id:'byCat',    label:'🔧 Kategori Dağılımı'},
    {id:'byMahal',  label:'🏨 Mahal Durumu'},
    {id:'topFail',  label:'⚠️ En Sorunlu Ekipmanlar'},
    {id:'timeline', label:'📈 Aylık Denetim Trendi'},
    {id:'due',      label:'⏰ Denetim Bekleyenler'},
  ];

  let html=`<button class="page-back-btn" onclick="goBack()">← Geri</button>
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px">
      <h2 style="font-size:22px;font-weight:800;color:var(--txt)">📊 Dashboard</h2>
      <button class="btn btn-secondary btn-sm" onclick="openDashSettings()">⚙️ Kartları Seç</button>
    </div>`;

  // Kart seçim paneli (gizli)
  html+=`<div id="dash-settings" style="display:none;background:var(--card);border:1px solid var(--brd);border-radius:var(--r12);padding:14px;margin-bottom:14px">
    <p style="font-size:13px;font-weight:700;margin-bottom:10px">Gösterilecek Kartlar</p>
    ${allCards.map(c=>`<label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;cursor:pointer">
      <input type="checkbox" value="${c.id}" ${active.includes(c.id)?'checked':''} onchange="toggleDashCard('${c.id}',this.checked)"/>
      ${c.label}
    </label>`).join('')}
  </div>`;

  // SUMMARY
  if(active.includes('summary')){
    const rate=total?Math.round(ok/total*100):0;
    html+=`<div class="ed-card" style="margin-bottom:14px">
      <p class="sec-label" style="margin-top:0">Genel Özet</p>
      <div class="hstat-grid">
        <div class="hstat-card" style="cursor:pointer" onclick="dashGoEquip('all')"><div class="hstat-icon">🔧</div><div class="hstat-num">${total}</div><div class="hstat-lbl">Ekipman</div></div>
        <div class="hstat-card ok" style="cursor:pointer" onclick="dashGoEquip('ok')"><div class="hstat-icon">✅</div><div class="hstat-num">${ok}</div><div class="hstat-lbl">Uygun</div></div>
        <div class="hstat-card fail" style="cursor:pointer" onclick="dashGoEquip('fail')"><div class="hstat-icon">❌</div><div class="hstat-num">${fail}</div><div class="hstat-lbl">Uygun Değil</div></div>
      </div>
      <div style="margin-top:14px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px"><span style="color:var(--txt2)">Uygunluk Oranı</span><span style="font-weight:700;color:var(--gtxt)">%${rate}</span></div>
        <div style="height:10px;background:var(--bg);border-radius:6px;overflow:hidden"><div style="height:100%;width:${rate}%;background:linear-gradient(90deg,#22c55e,#16a34a)"></div></div>
      </div>
    </div>`;
  }

  // BY CATEGORY
  if(active.includes('byCat')){
    html+=`<div class="ed-card" style="margin-bottom:14px"><p class="sec-label" style="margin-top:0">Kategori Dağılımı</p>`;
    allCats().forEach(cat=>{
      const eqs=S.equips.filter(e=>e.cat===cat.id);
      if(!eqs.length) return;
      const cOk=eqs.filter(e=>getStatus(e)==='ok').length;
      const cFail=eqs.filter(e=>getStatus(e)==='fail').length;
      const pct=eqs.length?Math.round(cOk/eqs.length*100):0;
      html+=`<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span>${cat.icon} ${cat.name}</span>
          <span style="color:var(--txt2)">${cOk}/${eqs.length}${cFail?` · <span style="color:var(--rtxt)">${cFail} sorunlu</span>`:''}</span>
        </div>
        <div style="height:8px;background:var(--bg);border-radius:5px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${cFail>0?'linear-gradient(90deg,#f59e0b,#ef4444)':'linear-gradient(90deg,#22c55e,#16a34a)'}"></div>
        </div>
      </div>`;
    });
    html+=`</div>`;
  }

  // BY MAHAL
  if(active.includes('byMahal')){
    html+=`<div class="ed-card" style="margin-bottom:14px"><p class="sec-label" style="margin-top:0">Mahal Durumu</p>`;
    S.mahals.forEach(m=>{
      const eqs=S.equips.filter(e=>e.mahalId===m.id);
      const mFail=eqs.filter(e=>getStatus(e)==='fail').length;
      html+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--brd)">
        <span style="font-size:13px;font-weight:600">${safe(m.name)}</span>
        <span style="font-size:12px">${mFail>0?`<span style="color:var(--rtxt);font-weight:700">⚠️ ${mFail} sorunlu</span>`:'<span style="color:var(--gtxt)">✅ Temiz</span>'} · ${eqs.length} ekipman</span>
      </div>`;
    });
    html+=`</div>`;
  }

  // TOP FAIL (arıza geçmişi analizi)
  if(active.includes('topFail')){
    const failCounts={};
    S.reports.filter(r=>r.result==='fail').forEach(r=>{
      failCounts[r.equipId]=(failCounts[r.equipId]||0)+1;
    });
    const ranked=Object.entries(failCounts).map(([id,cnt])=>({e:equipById(id),cnt})).filter(x=>x.e).sort((a,b)=>b.cnt-a.cnt).slice(0,8);
    html+=`<div class="ed-card" style="margin-bottom:14px"><p class="sec-label" style="margin-top:0">En Sorunlu Ekipmanlar (Arıza Geçmişi)</p>`;
    if(!ranked.length) html+=`<p style="font-size:13px;color:var(--txt3);padding:8px 0">Henüz uygunsuz rapor yok.</p>`;
    else ranked.forEach((x,i)=>{
      const cat=catById(x.e.cat);
      html+=`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--brd);cursor:pointer" onclick="openEquipDetail('${x.e.id}')">
        <span style="font-weight:800;color:var(--txt3);width:20px">${i+1}</span>
        <span style="font-size:18px">${cat.icon}</span>
        <div style="flex:1"><div style="font-size:13px;font-weight:600">${safe(x.e.name)}</div>
        <div style="font-size:11px;color:var(--txt3)">${mahalById(x.e.mahalId)?.name||''}</div></div>
        <span style="background:var(--rbg);color:var(--rtxt);padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700">${x.cnt}× arıza</span>
      </div>`;
    });
    html+=`</div>`;
  }

  // TIMELINE (aylık trend)
  if(active.includes('timeline')){
    const months={};
    S.reports.forEach(r=>{
      if(!r.createdAt) return;
      const d=new Date(r.createdAt);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months[key]=months[key]||{ok:0,fail:0};
      if(r.result==='ok') months[key].ok++; else if(r.result==='fail') months[key].fail++;
    });
    const sorted=Object.entries(months).sort().slice(-6);
    const maxV=Math.max(1,...sorted.map(([k,v])=>v.ok+v.fail));
    html+=`<div class="ed-card" style="margin-bottom:14px"><p class="sec-label" style="margin-top:0">Aylık Denetim Trendi (Son 6 Ay)</p>`;
    if(!sorted.length) html+=`<p style="font-size:13px;color:var(--txt3);padding:8px 0">Veri yok.</p>`;
    else {
      html+=`<div style="display:flex;align-items:flex-end;gap:8px;height:140px;padding:10px 0">`;
      sorted.forEach(([k,v])=>{
        const okH=Math.round(v.ok/maxV*110);
        const failH=Math.round(v.fail/maxV*110);
        const [y,mo]=k.split('-');
        const mn=['','Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][+mo];
        html+=`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;height:100%;justify-content:flex-end">
          <div style="display:flex;flex-direction:column-reverse;gap:2px;width:100%;align-items:center">
            ${v.fail?`<div style="width:70%;height:${failH}px;background:#ef4444;border-radius:3px" title="${v.fail} uygunsuz"></div>`:''}
            ${v.ok?`<div style="width:70%;height:${okH}px;background:#22c55e;border-radius:3px" title="${v.ok} uygun"></div>`:''}
          </div>
          <span style="font-size:10px;color:var(--txt3)">${mn}</span>
        </div>`;
      });
      html+=`</div><div style="display:flex;gap:14px;justify-content:center;font-size:11px;color:var(--txt2)"><span>🟩 Uygun</span><span>🟥 Uygun Değil</span></div>`;
    }
    html+=`</div>`;
  }

  // DUE (denetim bekleyenler)
  if(active.includes('due')){
    const due=getDueEquips();
    html+=`<div class="ed-card" style="margin-bottom:14px"><p class="sec-label" style="margin-top:0">Denetim Bekleyenler (${due.length})</p>`;
    if(!due.length) html+=`<p style="font-size:13px;color:var(--gtxt);padding:8px 0">✅ Tüm denetimler güncel.</p>`;
    else due.slice(0,10).forEach(({e,st})=>{
      const cat=catById(e.cat);
      const lbl=st.state==='overdue'?`<span style="color:var(--rtxt);font-weight:700">${st.days} gün gecikmiş</span>`
               :st.state==='never'?`<span style="color:var(--otxt);font-weight:700">Hiç denetlenmedi</span>`
               :`<span style="color:var(--otxt)">${st.days} gün kaldı</span>`;
      html+=`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--brd);cursor:pointer" onclick="openEquipDetail('${e.id}')">
        <span style="font-size:18px">${cat.icon}</span>
        <div style="flex:1"><div style="font-size:13px;font-weight:600">${safe(e.name)}</div>
        <div style="font-size:11px;color:var(--txt3)">${mahalById(e.mahalId)?.name||''}</div></div>
        <span style="font-size:12px">${lbl}</span>
      </div>`;
    });
    html+=`</div>`;
  }

  el.innerHTML=html;
}

function openDashSettings(){
  const s=document.getElementById('dash-settings');
  if(s) s.style.display=s.style.display==='none'?'block':'none';
}
function toggleDashCard(id,checked){
  let cards=getDashCards();
  if(checked&&!cards.includes(id)) cards.push(id);
  if(!checked) cards=cards.filter(c=>c!==id);
  setDashCards(cards);
  renderDashboard();
  // Ayar panelini açık tut
  setTimeout(()=>{ const s=document.getElementById('dash-settings'); if(s) s.style.display='block'; },10);
}

/* ══════════════════════════════════════
   PROFİL
══════════════════════════════════════ */
function renderProfile(){
  const u=S.cur; if(!u) return;
  const myRpts=S.reports.filter(r=>r.by===(u.fullname||u.username));

  document.getElementById('profile-container').innerHTML=`
    <div class="ed-card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
        <div class="user-av" style="width:52px;height:52px;font-size:20px">${(u.fullname||u.username).charAt(0).toUpperCase()}</div>
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--txt)">${safe(u.fullname||u.username)}</div>
          <div style="font-size:12px;color:var(--txt2)">@${safe(u.username)}</div>
          <span class="role-badge rb-${u.role}" style="margin-top:6px;display:inline-block">${roleLabel(u.role)}</span>
        </div>
      </div>
      <div class="info-row"><span class="ir-key">Toplam Raporum</span><span class="ir-val">${myRpts.length}</span></div>
    </div>
    <div style="margin-bottom:14px">
      <button class="btn btn-secondary btn-full" onclick="openChangePw()">🔑 Şifremi Değiştir</button>
    </div>
    <div style="margin-bottom:14px">
      <button class="btn btn-primary btn-full" onclick="openInstallGuide()">📲 Uygulamayı Telefona İndir</button>
    </div>
    ${ROLE_LEVEL[u.role]>=3?`
    <div style="margin-bottom:14px">
      <button class="btn btn-primary btn-full" onclick="openDashboard()">📊 Analiz Paneli (Dashboard)</button>
    </div>`:''}
    ${canDo('manage_users')?`
    <p class="sec-label">👥 Kullanıcı Yönetimi</p>
    <div style="margin-bottom:10px"><button class="btn btn-accent btn-sm" id="btn-add-user-prof">+ Yeni Kullanıcı</button></div>
    <div id="user-list-prof"></div>
    <div class="divider"></div>`:''}
    ${isSuperAdmin()?`
    <p class="sec-label">📞 İletişim Bilgileri <span style="font-weight:400;text-transform:none;color:var(--txt3);font-size:11px">(tüm giriş ekranlarında görünür — global)</span></p>
    <div class="ed-card" style="margin-bottom:14px">
      <p style="font-size:12px;color:var(--txt2);margin-bottom:10px;line-height:1.5">QR okutan veya giriş ekranındaki kişiler bu bilgileri görür. Bu bilgiler TÜM şirketler için geçerlidir (süper admin geneli). Boş bırakırsanız görünmez.</p>
      <div class="form-group"><label class="form-label">TELEFON</label><input class="form-input" id="ci-tel" placeholder="Örn: 0532 123 45 67" value="${safe((S.contactInfo&&S.contactInfo.tel)||'')}"/></div>
      <div class="form-group"><label class="form-label">E-POSTA</label><input class="form-input" id="ci-mail" type="email" placeholder="ornek@firma.com" value="${safe((S.contactInfo&&S.contactInfo.mail)||'')}"/></div>
      <button class="btn btn-primary btn-sm" onclick="saveContactInfo()">💾 İletişim Bilgilerini Kaydet</button>
    </div>
    <div class="divider"></div>`:''}
    <p class="sec-label">Son Raporlarım</p>
    <div id="my-rpts"></div>
    ${isAdmin()?`
    <div class="divider"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <p class="sec-label" style="margin:0">📊 Son Aktiviteler</p>
      <button class="btn btn-secondary btn-sm" onclick="clearActivity()" style="font-size:11px;padding:4px 10px">🧹 Temizle</button>
    </div>
    <div class="ed-card" style="margin-bottom:14px" id="activity-list"></div>`:''}
    ${isAdmin()?`
    <div class="divider"></div>
    <p class="sec-label">🔐 Rol Yetkileri</p>
    <div class="ed-card" style="margin-bottom:14px">
      <p style="font-size:12.5px;color:var(--txt2);margin-bottom:12px;line-height:1.5">Her rolün varsayılan yetkilerini düzenle. (Kişiye özel yetki için kullanıcıyı düzenleyin.)</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${isSuperAdmin()?`<button class="btn btn-secondary btn-sm" onclick="openRolePerms('admin')">🛡️ Admin Yetkileri</button>`:''}
        <button class="btn btn-secondary btn-sm" onclick="openRolePerms('manager')">🧑‍💼 Yönetici Yetkileri</button>
        <button class="btn btn-secondary btn-sm" onclick="openRolePerms('inspector')">🔍 Denetçi Yetkileri</button>
        <button class="btn btn-secondary btn-sm" onclick="openRolePerms('viewer')">👁️ Görüntüleyici Yetkileri</button>
        ${Object.entries(S.customRoles||{}).map(([id,r])=>`<div style="display:flex;gap:6px"><button class="btn btn-secondary btn-sm" style="flex:1" onclick="openRolePerms('${id}')">🏷️ ${safe(r.label)} Yetkileri</button>${isSuperAdmin()?`<button class="btn btn-danger btn-sm" onclick="deleteCustomRole('${id}')" title="Rolü sil">🗑️</button>`:''}</div>`).join('')}
      </div>
      ${isSuperAdmin()?`<button class="btn btn-primary btn-sm btn-full" style="margin-top:10px" onclick="addCustomRole()">➕ Yeni Rol Ekle</button>`:''}
      ${isSuperAdmin()?'<p style="font-size:11px;color:var(--txt3);margin-top:10px;line-height:1.4">🛡️ Admin yetkilerini yalnızca süper admin düzenleyebilir. Süper admin her zaman tam yetkilidir, kısıtlanamaz.</p>':''}
    </div>`:''}
    ${isAdmin()?`
    <div class="divider"></div>
    <p class="sec-label">💾 Veri Yedekleme</p>
    <div class="ed-card" style="margin-bottom:14px">
      <p style="font-size:12.5px;color:var(--txt2);margin-bottom:12px;line-height:1.5">Tüm verileri (mahaller, ekipmanlar, raporlar, kullanıcılar) dosyaya indir veya yedekten geri yükle.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="backupData()">📥 Yedek İndir</button>
        <button class="btn btn-secondary btn-sm" onclick="triggerRestore()">📤 Geri Yükle</button>
      </div>
      <input type="file" id="restore-file-input" accept="application/json,.json" style="display:none"/>
    </div>
    ${isSuperAdmin()?`<p class="sec-label">🗓️ Veri Saklama Süreleri</p>
    <div class="ed-card" style="margin-bottom:14px;cursor:pointer" onclick="openRetentionPanel()">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="min-width:0">
          <div style="font-size:13.5px;font-weight:600;color:var(--txt)">Otomatik temizlik</div>
          <div style="font-size:11.5px;color:var(--txt3);margin-top:2px">Rapor ${getRetention().reports}g · Bildirim ${getRetention().notifications}g · Log ${getRetention().logs}g</div>
        </div>
        <span style="font-size:11px;color:var(--accent);font-weight:600;white-space:nowrap">⚙️ Ayarla</span>
      </div>
    </div>`:''}`:''}
    <div class="divider"></div>
    <button class="btn btn-danger btn-full" onclick="doLogout()">🚪 Çıkış Yap</button>`;

  // Kullanıcı listesi + ekleme: "Kullanıcı Yönetimi" bölümüyle (manage_users) tutarlı
  if(canDo('manage_users')){
    renderUserList();
    document.getElementById('btn-add-user-prof')?.addEventListener('click',openAddUser);
  }
  if(isAdmin()){
    renderCatManageList();
    document.getElementById('restore-file-input')?.addEventListener('change',handleRestoreFile);
    const actEl=document.getElementById('activity-list');
    if(actEl){
      const PER=10;
      // Süper admin işlemlerini sadece süper admin görür
      const visibleActs=S.activity.filter(a=>!a.bySuper || isSuperAdmin());
      const total=visibleActs.length;
      const pages=Math.ceil(total/PER)||1;
      if(S.pgActivity>pages) S.pgActivity=pages;
      if(S.pgActivity<1) S.pgActivity=1;
      const start=(S.pgActivity-1)*PER;
      const acts=visibleActs.slice(start, start+PER);
      const icons={inspect:'🔍',equip_add:'➕',equip_del:'🗑️',mahal_add:'🏨',mahal_del:'🗑️',report_del:'🗑️',user_del:'👤',user_add:'👤',user_pw:'🔑',cat_add:'🏷️',restore:'📤',role_perms:'🔐'};
      actEl.innerHTML=(acts.length?acts.map(a=>{
        const ic=icons[a.type]||'•';
        const extraHtml=a.extra==='ok'?'<span style="color:var(--gtxt);font-weight:700"> ✅</span>':a.extra==='fail'?'<span style="color:var(--rtxt);font-weight:700"> ❌</span>':'';
        return `<div class="activity-item">
        <div class="act-avatar">${(a.by||'?').charAt(0).toUpperCase()}</div>
        <div class="act-body"><div class="act-text">${ic} <strong>${safe(a.by)}</strong>: ${safe(a.desc)}${extraHtml}</div>
        <div class="act-time">${a.date}</div></div>
      </div>`;}).join(''):'<p style="font-size:13px;color:var(--txt3);padding:10px 0">Aktivite yok.</p>')
      +pagerHTML(total, S.pgActivity, PER, 'S.pgActivity=%P%;renderProfile()');
    }
  }

  const myRE=document.getElementById('my-rpts');
  if(!myRpts.length){ myRE.innerHTML=`<div class="empty-state" style="padding:16px 0"><p>Henüz rapor yok.</p></div>`; }
  else {
    myRE.innerHTML=myRpts.slice(0,6).map(r=>`
      <div class="report-row ${r.result}" data-rid="${r.id}">
        <div class="rr-info"><div class="rr-no">${r.id}</div>
          <div class="rr-name">${r.catIcon||''} ${safe(r.equipName)}</div>
          <div class="rr-meta">${r.date}</div></div>
        <span class="status-badge ${r.result==='ok'?'sb-ok':'sb-fail'}">${r.result==='ok'?'✅':'❌'}</span>
      </div>`).join('');
    myRE.querySelectorAll('.report-row').forEach(row=>row.addEventListener('click',()=>openReportDetail(row.dataset.rid)));
  }
}

/* ══════════════════════════════════════
   KULLANICI CRUD
══════════════════════════════════════ */
function renderUserList(){
  const el=document.getElementById('user-list-prof'); if(!el) return;
  // Süper admin'i sadece süper admin görebilir
  const visible=S.users.filter(u=>!u.isSuper || isSuperAdmin());
  el.innerHTML=visible.map(u=>`
    <div class="user-card">
      <div class="user-av">${(u.fullname||u.username).charAt(0).toUpperCase()}</div>
      <div class="user-info">
        <div class="user-name">${safe(u.fullname||u.username)}${u.isSuper?' 👑':''}</div>
        <div class="user-uname">@${safe(u.username)}</div>
      </div>
      <span class="role-badge rb-${u.role}">${u.isSuper?'Süper Admin':roleLabel(u.role)}</span>
      <button class="btn btn-secondary btn-sm" onclick="openEditUser('${u.id}')">✏️</button>
    </div>`).join('');
}

let _rpRole=null, _rpPerms=null;
function openRolePerms(role){
  if(!isAdmin()) return;
  _rpRole=role;
  _rpPerms=[...getRolePerms(role)];
  document.getElementById('role-perms-title').textContent='🔐 '+roleLabel(role)+' Yetkileri';
  const el=document.getElementById('role-perms-list');
  el.innerHTML=PERM_DEFS.map(p=>`
    <label class="perm-item">
      <input type="checkbox" ${_rpPerms.includes(p.id)?'checked':''} onchange="toggleRpPerm('${p.id}',this.checked)"/>
      <div><div class="perm-label">${p.label}</div><div class="perm-desc">${p.desc}</div></div>
    </label>`).join('');
  openModal('modal-role-perms');
}
function toggleRpPerm(pid,on){
  if(on){ if(!_rpPerms.includes(pid)) _rpPerms.push(pid); }
  else { _rpPerms=_rpPerms.filter(x=>x!==pid); }
}
async function saveRolePerms(){
  if(!isAdmin()||!_rpRole) return;
  if(!S.rolePerms) S.rolePerms={};
  S.rolePerms[_rpRole]=_rpPerms;
  logActivity('role_perms', `${roleLabel(_rpRole)} rol yetkileri güncellendi`);
  try{ await save(); closeModal('modal-role-perms'); toast('✅ Rol yetkileri kaydedildi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* Yeni özel rol ekle (süper admin) */
async function addCustomRole(){
  if(!isSuperAdmin()){ toast('🔒 Sadece süper admin'); return; }
  const name=await promptDialog({title:'Yeni Rol',message:'Rol adı (örn: Teknisyen, Bölge Müdürü):',placeholder:'Rol adı',okText:'Devam'});
  if(name===null||!name.trim()){ return; }
  const label=name.trim();
  // id üret
  const id='role_'+Date.now().toString(36);
  // Yetki seviyesi sor (1=en düşük, 4=admin seviyesi)
  const lvlStr=await promptDialog({title:'Yetki Seviyesi',message:'Sıralama seviyesi (1=düşük … 4=yüksek). Sadece sıralama içindir, asıl yetkiler bir sonraki adımda seçilir:',value:'2',okText:'Oluştur'});
  if(lvlStr===null) return;
  let lvl=parseInt(lvlStr); if(isNaN(lvl)||lvl<1) lvl=2; if(lvl>4) lvl=4;
  if(!S.customRoles) S.customRoles={};
  S.customRoles[id]={label,level:lvl};
  if(!S.rolePerms) S.rolePerms={};
  S.rolePerms[id]=['inspect']; // varsayılan minimal yetki
  logActivity('role_perms', `"${label}" özel rolü eklendi`);
  try{
    await save();
    renderProfile();
    toast('✅ "'+label+'" rolü eklendi. Şimdi yetkilerini seç.');
    setTimeout(()=>openRolePerms(id), 400);
  }catch(e){ toast('❌ '+e.message,5000); }
}

/* Özel rol sil (süper admin) */
async function deleteCustomRole(roleId){
  if(!isSuperAdmin()){ toast('🔒 Sadece süper admin'); return; }
  const r=S.customRoles&&S.customRoles[roleId]; if(!r) return;
  // Bu rolde kullanıcı var mı?
  const inUse=S.users.filter(u=>u.role===roleId);
  if(inUse.length){
    toast(`⚠️ ${inUse.length} kullanıcı bu rolde. Önce onların rolünü değiştirin.`, 5000);
    return;
  }
  const ok=await confirmDialog({title:'Rolü Sil',message:`"${r.label}" rolü silinsin mi?`,okText:'Sil',danger:true});
  if(!ok) return;
  delete S.customRoles[roleId];
  if(S.rolePerms) delete S.rolePerms[roleId];
  logActivity('role_perms', `"${r.label}" özel rolü silindi`);
  try{ await save(); renderProfile(); toast('🗑️ Rol silindi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* Rol seçim dropdown'unu doldur (sabit + özel roller) */
function populateRoleSelect(selId, selected){
  const sel=document.getElementById(selId); if(!sel) return;
  sel.innerHTML=allRoles().map(r=>`<option value="${r.id}" ${r.id===selected?'selected':''}>${safe(r.label)}${r.custom?' (özel)':''}</option>`).join('');
}

function openAddUser(){
  S.editUserId=null;
  _uePerms=null; // yeni kullanıcı: rol varsayılanı kullanılır
  document.getElementById('user-edit-title').textContent='👤 Yeni Kullanıcı';
  ['ue-uname','ue-fname','ue-pass'].forEach(id=>document.getElementById(id).value='');
  populateRoleSelect('ue-role','inspector');
  document.getElementById('ue-role').value='inspector';
  const roleSel=document.getElementById('ue-role'); if(roleSel) roleSel.disabled=false;
  const permsGroup=document.getElementById('ue-perms-group'); if(permsGroup) permsGroup.style.display='';
  document.getElementById('btn-del-user').style.display='none';
  const h=document.getElementById('ue-pass-hint'); if(h) h.textContent='(zorunlu)';
  renderUePerms('inspector');
  openModal('modal-user-edit');
}

function openEditUser(id){
  S.editUserId=id;
  const u=userById(id); if(!u) return;
  // Süper admin'i sadece süper admin düzenleyebilir
  if(u.isSuper && !isSuperAdmin()){ toast('🔒 Süper admin hesabını yalnızca kendisi düzenleyebilir'); return; }
  _uePerms = (u.perms&&Array.isArray(u.perms)) ? [...u.perms] : null; // null = rol varsayılanı
  document.getElementById('user-edit-title').textContent=u.isSuper?'👑 Süper Admin':'✏️ Kullanıcıyı Düzenle';
  document.getElementById('ue-uname').value=u.username;
  document.getElementById('ue-fname').value=u.fullname||'';
  document.getElementById('ue-pass').value='';
  populateRoleSelect('ue-role',u.role);
  document.getElementById('ue-role').value=u.role;
  // Süper admin silinemez, rolü/yetkisi kısıtlanamaz
  document.getElementById('btn-del-user').style.display=(u.id!==S.cur?.id && !u.isSuper)?'':'none';
  const roleSel=document.getElementById('ue-role'); if(roleSel) roleSel.disabled=!!u.isSuper;
  const permsGroup=document.getElementById('ue-perms-group'); if(permsGroup) permsGroup.style.display=u.isSuper?'none':'';
  const h=document.getElementById('ue-pass-hint'); if(h) h.textContent='(değiştirmek için doldurun, boş bırakırsanız aynı kalır)';
  renderUePerms(u.role);
  openModal('modal-user-edit');
}

let _uePerms=null; // düzenlenen kullanıcının yetki listesi (null = rol varsayılanı)

/* Kullanıcı yetki checkbox'larını render et */
function renderUePerms(role){
  const el=document.getElementById('ue-perms'); if(!el) return;
  const group=document.getElementById('ue-perms-group');
  // Tüm roller için yetki seçimi görünür (admin dahil — kişiye özel kısıtlanabilir)
  if(group) group.style.display='';
  const active = _uePerms!==null ? _uePerms : getRolePerms(role);
  el.innerHTML=PERM_DEFS.map(p=>`
    <label class="perm-item">
      <input type="checkbox" ${active.includes(p.id)?'checked':''} onchange="toggleUePerm('${p.id}',this.checked)"/>
      <div><div class="perm-label">${p.label}</div><div class="perm-desc">${p.desc}</div></div>
    </label>`).join('');
}

function toggleUePerm(pid,on){
  // İlk değişiklikte rol varsayılanından kopya al
  if(_uePerms===null){ _uePerms=[...getRolePerms(document.getElementById('ue-role').value)]; }
  if(on){ if(!_uePerms.includes(pid)) _uePerms.push(pid); }
  else { _uePerms=_uePerms.filter(x=>x!==pid); }
}

function onUeRoleChange(){
  _uePerms=null; // rol değişti → o rolün varsayılanına dön
  renderUePerms(document.getElementById('ue-role').value);
}

async function saveUser(){
  if(!canDo('manage_users')){ toast('🚫 Yetkiniz yok'); return; }
  const uname=document.getElementById('ue-uname').value.trim();
  const fname=document.getElementById('ue-fname').value.trim();
  const pass =document.getElementById('ue-pass').value;
  const role =document.getElementById('ue-role').value;
  if(!uname){ toast('⚠️ Kullanıcı adı zorunlu'); return; }
  // Yetki yükseltme koruması: admin olmayan, admin rolü atayamaz ve admin/süper hesabı düzenleyemez
  if(!isAdmin()){
    if(role==='admin'){ toast('🚫 "Admin" rolü atama yetkiniz yok'); return; }
    const tgt=S.editUserId?userById(S.editUserId):null;
    if(tgt && (tgt.role==='admin'||tgt.isSuper)){ toast('🚫 Admin hesabını düzenleyemezsiniz'); return; }
  }
  if(S.editUserId){
    const u=userById(S.editUserId); if(!u) return;
    // Süper admin'i sadece süper admin düzenleyebilir, bayrağı/rolü korunur
    if(u.isSuper && !isSuperAdmin()){ toast('🔒 Süper admin yalnızca kendisi tarafından düzenlenebilir'); return; }
    u.username=uname; u.fullname=fname;
    if(u.isSuper){ u.role='admin'; u.isSuper=true; delete u.perms; } // süper admin sabit, tam yetki
    else {
      u.role=role;
      // Tüm roller (admin dahil) kişiye özel yetki taşıyabilir
      if(_uePerms!==null){ u.perms=_uePerms; }
      else { delete u.perms; }
    }
    if(pass.length>0){
      const err=checkPasswordStrength(pass);
      if(err){ toast('⚠️ '+err); return; }
      const hp=await hashPassword(pass);
      u.pwSalt=hp.salt; u.pwHash=hp.hash; u.mustChangePw=false;
      logActivity('user_pw', `"${u.fullname||u.username}" şifresi değiştirildi`);
    }
  } else {
    const err=checkPasswordStrength(pass);
    if(err){ toast('⚠️ '+err); return; }
    if(S.users.find(u=>u.username===uname)){ toast('⚠️ Bu kullanıcı adı bu şirkette alınmış'); return; }
    // Süper admin kullanıcı adıyla çakışma
    if(uname===SUPER_USERNAME){ toast('⚠️ Bu kullanıcı adı sistem tarafından kullanılıyor'); return; }
    // TÜM şirketlerde benzersizlik kontrolü (çakışma → giriş karışıklığı engellenir)
    const btn=document.querySelector('#modal-user-edit .btn-primary');
    if(btn){ btn.disabled=true; btn.textContent='Kontrol ediliyor…'; }
    const existing=await findUserAcrossCompanies(uname);
    if(btn){ btn.disabled=false; btn.textContent='Kaydet'; }
    if(existing){
      const cName=existing.companyName||'başka bir şirket';
      toast('⚠️ "'+uname+'" kullanıcı adı zaten alınmış ('+cName+'). Farklı bir ad seçin.', 5000);
      return;
    }
    const hp=await hashPassword(pass);
    const newU={id:'u'+Date.now(),username:uname,fullname:fname,role,pwSalt:hp.salt,pwHash:hp.hash,createdAt:nowStr()};
    if(_uePerms!==null) newU.perms=_uePerms;
    S.users.push(newU);
    logActivity('user_add', `"${fname||uname}" kullanıcısı eklendi (${roleLabel(role)})`);
  }
  try{ await save(); closeModal('modal-user-edit'); toast('✅ Kaydedildi'); if(S.page==='profile') renderProfile(); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* ── PROFİLDEN ŞİFRE DEĞİŞTİRME (herkes kendi) ── */
function openChangePw(){
  document.getElementById('cpw-old').value='';
  document.getElementById('cpw-new').value='';
  document.getElementById('cpw-new2').value='';
  openModal('modal-change-pw');
}

async function saveChangePw(){
  if(!S.cur){ return; }
  const oldPw =document.getElementById('cpw-old').value;
  const newPw =document.getElementById('cpw-new').value;
  const newPw2=document.getElementById('cpw-new2').value;

  // Mevcut şifre doğru mu?
  const ok=await verifyPassword(oldPw, S.cur);
  if(!ok){ toast('⚠️ Mevcut şifre yanlış'); return; }

  // Yeni şifre güç kontrolü
  const err=checkPasswordStrength(newPw);
  if(err){ toast('⚠️ '+err); return; }
  if(newPw!==newPw2){ toast('⚠️ Yeni şifreler eşleşmiyor'); return; }

  // Güncelle
  const hp=await hashPassword(newPw);
  const u=userById(S.cur.id);
  if(u){ u.pwSalt=hp.salt; u.pwHash=hp.hash; u.mustChangePw=false; S.cur=u; setSession(u); }
  logActivity('user_pw', `Kendi şifresini değiştirdi`);
  try{ await save(); closeModal('modal-change-pw'); toast('✅ Şifreniz değiştirildi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

async function deleteUser(){
  if(!canDo('manage_users')){ toast('🚫 Yetkiniz yok'); return; }
  const u=userById(S.editUserId); if(!u) return;
  if(u.isSuper){ toast('🔒 Süper admin hesabı silinemez'); return; }
  if(u.id===S.cur?.id){ toast('⚠️ Kendinizi silemezsiniz'); return; }
  if(!isAdmin() && u.role==='admin'){ toast('🚫 Admin hesabını silemezsiniz'); return; }
  if(!await confirmDialog({title:'Kullanıcı Silinsin mi?',message:`"${u.fullname||u.username}" kullanıcısı kalıcı olarak silinecek.`,danger:true,okText:'Evet, Sil'})) return;
  S.users=S.users.filter(x=>x.id!==S.editUserId);
  logActivity('user_del', `"${u.fullname||u.username}" kullanıcısı silindi`);
  try{ await save(); closeModal('modal-user-edit'); toast('🗑️ Silindi'); if(S.page==='profile') renderProfile(); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* ══════════════════════════════════════
   MAHAL CRUD
══════════════════════════════════════ */
function populateMahalSelects(){
  ['inp-equip-mahal','edit-equip-mahal'].forEach(id=>{
    const s=document.getElementById(id); if(!s) return;
    s.innerHTML=S.mahals.map(m=>`<option value="${m.id}">${safe(m.name)}</option>`).join('');
  });
}
function populateCatSelects(){
  ['inp-equip-cat','edit-equip-cat'].forEach(id=>{
    const s=document.getElementById(id); if(!s) return;
    let html=allCats().map(c=>`<option value="${c.id}">${c.icon} ${safe(c.name)}</option>`).join('');
    // Ekipman ekleme select'inde "Yeni Tür Ekle" seçeneği
    if(id==='inp-equip-cat') html+=`<option value="__new__">➕ Yeni Tür Ekle…</option>`;
    s.innerHTML=html;
  });
}

/* Mahal ikon seçici */
function renderMahalIconPicker(wrapId, selected){
  const wrap=document.getElementById(wrapId); if(!wrap) return;
  wrap.innerHTML=MAHAL_ICONS.map(ic=>`<button type="button" class="icon-opt${ic===selected?' active':''}" data-ic="${ic}">${ic}</button>`).join('');
  wrap.querySelectorAll('.icon-opt').forEach(b=>b.addEventListener('click',()=>{
    wrap.querySelectorAll('.icon-opt').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    if(wrapId==='add-mahal-icons') S.addMahalIcon=b.dataset.ic;
    else S.editMahalIcon=b.dataset.ic;
  }));
}

function openAddMahal(){
  document.getElementById('inp-mahal-name').value='';
  document.getElementById('inp-mahal-desc').value='';
  S.addMahalIcon=MAHAL_ICONS[0];
  renderMahalIconPicker('add-mahal-icons', S.addMahalIcon);
  openModal('modal-add-mahal');
}

async function saveMahal(){
  if(!canDo('add_mahal')){ toast('🚫 Yetkiniz yok'); return; }
  const name=document.getElementById('inp-mahal-name').value.trim();
  const desc=document.getElementById('inp-mahal-desc').value.trim();
  if(!name){ toast('⚠️ Mahal adı gerekli'); return; }
  S.mahals.push({id:mid(),name,desc,icon:S.addMahalIcon||MAHAL_ICONS[0],createdAt:nowStr()});
  logActivity('mahal_add',`"${name}" mahali eklendi`);
  try{
    await save(); populateMahalSelects(); closeModal('modal-add-mahal');
    document.getElementById('inp-mahal-name').value='';
    document.getElementById('inp-mahal-desc').value='';
    toast('🏨 Mahal eklendi');
  }catch(e){ toast('❌ '+e.message,5000); }
}

function openEditMahal(id){
  if(!canDo('add_mahal')){ toast('🚫 Yetkiniz yok'); return; }
  S.editMahalId=id;
  const m=mahalById(id); if(!m) return;
  document.getElementById('edit-mahal-name').value=m.name;
  document.getElementById('edit-mahal-desc').value=m.desc||'';
  S.editMahalIcon=m.icon||MAHAL_ICONS[0];
  renderMahalIconPicker('edit-mahal-icons', S.editMahalIcon);
  openModal('modal-edit-mahal');
}

async function saveEditMahal(){
  if(!canDo('add_mahal')){ toast('🚫 Yetkiniz yok'); return; }
  const m=mahalById(S.editMahalId); if(!m) return;
  const name=document.getElementById('edit-mahal-name').value.trim();
  if(!name){ toast('⚠️ Ad boş olamaz'); return; }
  m.name=name; m.desc=document.getElementById('edit-mahal-desc').value.trim();
  m.icon=S.editMahalIcon||m.icon||MAHAL_ICONS[0];
  try{ await save(); populateMahalSelects(); closeModal('modal-edit-mahal'); toast('✅ Güncellendi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* Mahali ekipmanlarıyla kopyala (raporlar hariç — temiz başlangıç) */
async function copyMahal(){
  if(!canDo('add_mahal')){ toast('🚫 Yetkiniz yok'); return; }
  const m=mahalById(S.editMahalId); if(!m) return;
  const srcEquips=S.equips.filter(e=>e.mahalId===m.id);
  const newName=await promptDialog({
    title:'Mahali Kopyala',
    message:`"${m.name}" mahali ${srcEquips.length} ekipmanıyla birlikte kopyalanacak (raporlar hariç). Yeni mahal adı:`,
    value:m.name+' (Kopya)', okText:'Kopyala'
  });
  if(newName===null) return;
  if(!newName.trim()){ toast('⚠️ Ad boş olamaz'); return; }
  // Yeni mahal
  const newMahalId=uid();
  S.mahals.push({id:newMahalId, name:newName.trim(), desc:m.desc||'', icon:m.icon||MAHAL_ICONS[0], createdAt:nowStr()});
  // Ekipmanları kopyala (form snapshot dahil, lastInsp sıfır)
  let count=0;
  srcEquips.forEach(e=>{
    S.equips.push({
      id:uid(), name:e.name, cat:e.cat, desc:e.desc||'', mahalId:newMahalId, imageUrl:e.imageUrl||'',
      form: e.form?JSON.parse(JSON.stringify(e.form)):getCatForm(e.cat),
      lastInsp:null, createdAt:nowStr(), createdBy:S.cur?.username||'admin'
    });
    count++;
  });
  logActivity('mahal_add', `"${newName}" mahali kopyalandı (${count} ekipman)`);
  try{
    await save();
    populateMahalSelects();
    closeModal('modal-edit-mahal');
    toast(`✅ "${newName}" oluşturuldu (${count} ekipman kopyalandı)`);
    renderCurrent();
  }catch(e){ toast('❌ '+e.message,5000); }
}

async function deleteMahal(){
  if(!canDo('del_mahal')){ toast('🚫 Yetkiniz yok'); return; }
  const m=mahalById(S.editMahalId); if(!m) return;
  if(!await confirmDialog({title:'Mahal Silinsin mi?',message:`"${m.name}" ve içindeki tüm ekipman/raporlar kalıcı olarak silinecek.`,danger:true,okText:'Evet, Sil'})) return;
  const ids=S.equips.filter(e=>e.mahalId===S.editMahalId).map(e=>e.id);
  S.equips  =S.equips.filter(e=>e.mahalId!==S.editMahalId);
  S.reports =S.reports.filter(r=>!ids.includes(r.equipId));
  S.mahals  =S.mahals.filter(x=>x.id!==S.editMahalId);
  logActivity('mahal_del', `"${m.name}" mahali silindi (${ids.length} ekipman)`);
  try{ await save(); populateMahalSelects(); closeModal('modal-edit-mahal'); toast('🗑️ Silindi'); showPage('home',false); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* ══════════════════════════════════════
   EKİPMAN CRUD
══════════════════════════════════════ */
function loadDefCrit(){
  const cat=document.getElementById('inp-equip-cat')?.value;
  S.pendCrit=[...(DEF_CRIT[cat]||[])]; renderPendCrit();
}

function renderPendCrit(){
  const el=document.getElementById('add-crit-list'); if(!el) return;
  el.innerHTML=S.pendCrit.map((c,i)=>`<div class="crit-edit-row"><span>${safe(c)}</span>
    <button onclick="S.pendCrit.splice(${i},1);renderPendCrit()">×</button></div>`).join('');
}

function addPendCrit(){
  const inp=document.getElementById('inp-new-crit');
  const v=inp.value.trim(); if(!v) return;
  S.pendCrit.push(v); inp.value=''; renderPendCrit();
}

let _newEquipForm=null;  // ekipman eklerken taslak form (türe dokunmaz)

function onCatChange(){
  const cat=document.getElementById('inp-equip-cat')?.value;
  // "Yeni Tür Ekle" seçildi
  if(cat==='__new__'){ openNewCatModal(); return; }
  // Türün formundan BAĞIMSIZ kopya al — bu ekipmana özel olacak
  _newEquipForm=getCatForm(cat);
  renderAddFormPreview();
}

/* Ekipman eklerken taslak formun özetini göster */
function renderAddFormPreview(){
  const el=document.getElementById('add-form-fields'); if(!el) return;
  const form=_newEquipForm||{fields:[]};
  if(!form.fields||!form.fields.length){
    el.innerHTML='<span style="color:var(--txt3)">Bu tür için form tanımlı değil. "Formu Düzenle" ile oluşturun.</span>';
    return;
  }
  el.innerHTML=form.fields.map(f=>{
    const ft=FIELD_TYPES.find(x=>x.t===f.type)||{};
    return `<div style="padding:4px 0;border-bottom:1px solid var(--brd)">${ft.icon||'•'} ${safe(f.label)} <span style="color:var(--txt3);font-size:11px">· ${fieldTypeLabel(f.type)}${f.type==='table'?` (${(f.columns||[]).length} sütun, ${(f.rows||[]).length} birim)`:''}</span></div>`;
  }).join('');
}

/* Yeni kategori (tür) ekleme — işyeri/otel/fabrika ekipmanları için ikonlar */
const CAT_ICONS=[
  '📦','🔧','⚙️','🛠️','🔩','🔌','💡','🔋','🔥','⚡',
  '💧','🚿','🚰','🌡️','❄️','♨️','🧯','🚨','📹','🔔',
  '🚪','🪟','🛗','🪜','🧰','🎛️','📡','🛢️','⛽','🔆',
  '🧴','🧹','🚽','🛜','🖥️','🖨️','📞','🗄️','🏭','🌀'
];
/* Tür ekle/düzenle modalı — şirket VE global, ekleme VE düzenleme için ortak.
   mode: 'company-add' | 'company-edit' | 'global-add' | 'global-edit' */
let _catModalMode='company-add';
let _catModalEditId=null;
function openNewCatModal(mode='company-add', editId=null){
  _catModalMode=mode; _catModalEditId=editId;
  const isEdit   = mode==='company-edit' || mode==='global-edit';
  const isGlobal = mode==='global-add'  || mode==='global-edit';
  // Düzenlemede mevcut ad/ikon/periyodu çek
  let curName='', curIcon='📦', curPeriod=30;
  if(isEdit){
    if(isGlobal){
      const baseC=BASE_CATS.find(c=>c.id===editId);
      const customC=(_globalCats.custom||[]).find(c=>c.id===editId);
      const ov=(_globalCats.overrides&&_globalCats.overrides[editId])||{};
      curName=ov.name||(customC&&customC.name)||(baseC&&baseC.name)||'';
      curIcon=ov.icon||(customC&&customC.icon)||(baseC&&baseC.icon)||'📦';
      curPeriod=(_globalCats.periods&&_globalCats.periods[editId]!=null)?_globalCats.periods[editId]:catDefaultPeriod(editId);
    } else {
      const c=catById(editId);
      curName=c.name||''; curIcon=c.icon||'📦'; curPeriod=catDefaultPeriod(editId);
    }
  }
  S.newCatIcon=isEdit?curIcon:'📦';
  // İkon seçenekleri (düzenlemede mevcut ikon seçili gelsin)
  const iconWrap=document.getElementById('newcat-icons');
  if(iconWrap){
    iconWrap.innerHTML=CAT_ICONS.map(ic=>`<button type="button" class="newcat-ico-btn${ic===S.newCatIcon?' active':''}" data-ic="${ic}" onclick="selectNewCatIcon('${ic}',this)">${ic}</button>`).join('');
  }
  document.getElementById('newcat-name').value=isEdit?curName:'';
  // Periyot
  const ps=document.getElementById('newcat-period');
  const pc=document.getElementById('newcat-period-custom');
  if(ps){
    if([7,14,30,90,180,365,0].includes(curPeriod)){ ps.value=String(curPeriod); if(pc){pc.style.display='none';pc.value='';} }
    else if(isEdit){ ps.value='custom'; if(pc){pc.style.display='block';pc.value=curPeriod;} }
    else { ps.value='30'; if(pc){pc.style.display='none';pc.value='';} }
  }
  // Başlık / buton / şablon görünürlüğü
  const title=document.getElementById('newcat-title');
  if(title) title.textContent=isEdit?'✏️ Türü Düzenle':(isGlobal?'➕ Yeni Global Tür':'➕ Yeni Ekipman Türü');
  const sbtn=document.getElementById('btn-save-newcat');
  if(sbtn) sbtn.textContent=isEdit?'✅ Kaydet':'✅ Türü Ekle';
  const tg=document.getElementById('newcat-template-group');
  if(tg) tg.style.display=isEdit?'none':'';   // şablon sadece yeni türde
  openModal('modal-new-cat');
}
function selectNewCatIcon(ic, btn){
  S.newCatIcon=ic;
  document.querySelectorAll('.newcat-ico-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}
async function saveNewCat(){
  const _g=_catModalMode==='global-add'||_catModalMode==='global-edit';
  if(_g ? !isSuperAdmin() : !canDo('manage_types')){ toast('🚫 Yetkiniz yok'); return; }
  const name=document.getElementById('newcat-name').value.trim();
  if(!name){ toast('⚠️ Tür adı girin'); return; }
  const icon=S.newCatIcon||'📦';
  // Periyot oku (ortak)
  const pSel=document.getElementById('newcat-period');
  let period=30;
  if(pSel){
    if(pSel.value==='custom'){ period=parseInt(document.getElementById('newcat-period-custom')?.value); if(isNaN(period)||period<1) period=30; }
    else { period=parseInt(pSel.value); if(isNaN(period)) period=30; }
  }
  const mode=_catModalMode, editId=_catModalEditId;

  // ── GLOBAL: yeni tür ──
  if(mode==='global-add'){
    const id='gcat'+Date.now();
    if(!_globalCats.custom) _globalCats.custom=[];
    _globalCats.custom.push({id, name, icon});
    const tplForm=makeTemplateForm(document.getElementById('newcat-template')?.value||'blank');
    if(tplForm){ if(!_globalCats.forms)_globalCats.forms={}; _globalCats.forms[id]=tplForm; }
    if(!_globalCats.periods)_globalCats.periods={}; _globalCats.periods[id]=period;
    closeModal('modal-new-cat');
    await saveGlobalCatsAndApply('Tür eklendi');
    return;
  }
  // ── GLOBAL: düzenle ──
  if(mode==='global-edit'){
    const customC=(_globalCats.custom||[]).find(c=>c.id===editId);
    if(customC){ customC.name=name; customC.icon=icon; }
    else { if(!_globalCats.overrides)_globalCats.overrides={}; _globalCats.overrides[editId]={name, icon}; }
    if(!_globalCats.periods)_globalCats.periods={}; _globalCats.periods[editId]=period;
    closeModal('modal-new-cat');
    await saveGlobalCatsAndApply('Tür güncellendi');
    return;
  }
  // ── ŞİRKET: düzenle ──
  if(mode==='company-edit'){
    if(!S.catPeriods) S.catPeriods={};
    S.catPeriods[editId]=period;
    if(isBaseCat(editId)){
      if(!S.catOverrides) S.catOverrides={};
      S.catOverrides[editId]={name, icon};
    } else {
      const cc=S.customCats.find(x=>x.id===editId);
      if(cc){ cc.name=name; cc.icon=icon; }
    }
    rebuildCats();
    logActivity('cat_edit', `"${name}" türü düzenlendi`);
    try{ await save(); closeModal('modal-new-cat'); populateCatSelects(); renderCatManageList(); renderCurrent(); toast('✅ Tür güncellendi'); }
    catch(e){ toast('❌ '+e.message,5000); }
    return;
  }
  // ── ŞİRKET: yeni tür (varsayılan) ──
  const id='cat-'+Date.now().toString(36);
  S.customCats.push({id, name, icon});
  const tplForm=makeTemplateForm(document.getElementById('newcat-template')?.value||'blank');
  if(tplForm){ if(!S.catForms)S.catForms={}; S.catForms[id]=tplForm; }
  if(!S.catPeriods) S.catPeriods={}; S.catPeriods[id]=period;
  rebuildCats();
  logActivity('cat_add', `"${name}" türü eklendi`);
  try{
    await save();
    closeModal('modal-new-cat');
    populateCatSelects();
    const sel=document.getElementById('inp-equip-cat');
    if(sel){ sel.value=id; onCatChange(); }
    toast('✅ Yeni tür eklendi: '+name);
    setTimeout(()=>openFormDesigner(id, name, true), 400);
  }catch(e){ toast('❌ '+e.message,5000); }
}

/* Hazır başlangıç şablonları */
function makeTemplateForm(tpl){
  if(tpl==='checklist'){
    return { fields:[
      {id:fid(), type:'okfail', label:'Genel durum uygun mu?', required:true},
      {id:fid(), type:'okfail', label:'Hasar/aşınma var mı?', required:true},
      {id:fid(), type:'okfail', label:'Etiket/işaret okunaklı mı?', required:true},
    ]};
  }
  if(tpl==='table'){
    const cKap=fid();
    return { fields:[
      {id:fid(), type:'table', label:'Birimler', required:true,
        columns:[
          {id:cKap, type:'text', label:'Künye', fixed:true},
          {id:fid(), type:'okfail', label:'Durum'},
        ],
        rows:[{id:fid(), label:'Birim 1', fixed:{}}]
      },
    ]};
  }
  if(tpl==='measure'){
    return { fields:[
      {id:fid(), type:'value', label:'Ölçüm Değeri', required:true},
      {id:fid(), type:'okfail', label:'Genel Durum', required:true},
      {id:fid(), type:'text', label:'Not'},
    ]};
  }
  return null; // blank
}

/* ══════════════════════════════════════
   FORM TASARIMCISI (tek ekran, inline)
══════════════════════════════════════ */
let _fdForm=null;
let _fdCatId=null;
let _fdCatName='';
let _fdSaveTarget=null;
let _fdOpen=-1;

function openFormDesigner(catId, catName, isNew=false){
  _fdCatId=catId; _fdCatName=catName||catById(catId).name;
  _fdForm=getCatForm(catId);
  _fdSaveTarget=null; _fdOpen=-1;
  document.getElementById('fd-title').textContent='🛠️ '+_fdCatName;
  document.getElementById('fd-subtitle').textContent=isNew
    ? 'Denetim formunu tasarla. Alan ekle, başlığını yaz, tipini seç.'
    : 'Formu düzenle. Değişiklik bu türden YENİ eklenenlere uygulanır.';
  // Tür düzenleme: varsayılan periyot kutusunu göster + mevcut değeri yükle
  const pBox=document.getElementById('fd-period-box');
  if(pBox){
    pBox.style.display='';
    const cur=catDefaultPeriod(catId);
    const pSel=document.getElementById('fd-period');
    const pCustom=document.getElementById('fd-period-custom');
    if([7,14,30,90,180,365,0].includes(cur)){ pSel.value=String(cur); pCustom.style.display='none'; }
    else { pSel.value='custom'; pCustom.style.display='block'; pCustom.value=cur; }
  }
  // Tür varsayılan bakım bilgilerini göster + yükle
  const mBox=document.getElementById('fd-maint-box');
  if(mBox){
    mBox.style.display='';
    const cm=(S.catMaintenance&&S.catMaintenance[catId])||{};
    const md=document.getElementById('fd-maint-date'); if(md) md.value=isoToTr(cm.date||'');
    const mf=document.getElementById('fd-maint-firm'); if(mf) mf.value=cm.firm||'';
    const mn=document.getElementById('fd-maint-note'); if(mn) mn.value=cm.note||'';
    const mw=document.getElementById('fd-maint-warn'); if(mw) mw.value=cm.warnDays||15;
    // Her açılışta KAPALI başlasın (kullanıcı isteği)
    const content=document.getElementById('fd-maint-content');
    const chevron=document.getElementById('fd-maint-chevron');
    if(content) content.style.display='none';
    if(chevron) chevron.style.transform='rotate(0deg)';
  }
  renderFdFields();
  openModal('modal-form-designer');
}

function fdTypeOptions(sel, allowTable=true){
  return FIELD_TYPES.filter(t=>allowTable||t.t!=='table')
    .map(t=>`<option value="${t.t}" ${sel===t.t?'selected':''}>${t.icon} ${t.label}</option>`).join('');
}

function renderFdFields(){
  const el=document.getElementById('fd-fields'); if(!el) return;
  // Scroll pozisyonunu koru (yeniden çizimde başa atmasın)
  const modal=el.closest('.modal');
  const scrollY=modal?modal.scrollTop:0;
  const fields=_fdForm.fields||[];
  if(!fields.length){
    el.innerHTML='<div style="text-align:center;padding:24px;color:var(--txt3);font-size:13px">Henüz alan yok.<br>Aşağıdan "+ Alan Ekle" ile başla.</div>';
    return;
  }
  el.innerHTML=fields.map((f,i)=>{
    const ft=FIELD_TYPES.find(x=>x.t===f.type)||{};
    const open=_fdOpen===i;
    const summary=`<div class="fd-row" onclick="fdToggle(${i})">
      <span class="fd-grip">${ft.icon||'•'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:14px;color:var(--txt);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${safe(f.label)||'(başlıksız alan)'}</div>
        <div style="font-size:11px;color:var(--txt3)">${fieldTypeLabel(f.type)}${f.type==='table'?` · ${(f.columns||[]).length} sütun`:''}${f.required?' · zorunlu':''}</div>
      </div>
      <button class="fd-mini" onclick="event.stopPropagation();fdMoveField(${i},-1)" ${i===0?'disabled':''}>↑</button>
      <button class="fd-mini" onclick="event.stopPropagation();fdMoveField(${i},1)" ${i===fields.length-1?'disabled':''}>↓</button>
      <button class="fd-mini fd-del" onclick="event.stopPropagation();fdDeleteField(${i})">🗑️</button>
      <span class="fd-chev ${open?'open':''}">▾</span>
    </div>`;
    const editor=open?`<div class="fd-edit">
      <label class="fd-lbl">Başlık</label>
      <input class="form-input fd-in" value="${safe(f.label)}" placeholder="Örn: Basınç Durumu" oninput="fdSet(${i},'label',this.value)"/>
      <label class="fd-lbl">Tip</label>
      <select class="form-select fd-in" onchange="fdSetType(${i},this.value)">${fdTypeOptions(f.type)}</select>
      ${fdExtra(f,i)}
      <label class="fd-check"><input type="checkbox" ${f.required?'checked':''} onchange="fdSet(${i},'required',this.checked)"/> Zorunlu alan</label>
    </div>`:'';
    return `<div class="fd-card${open?' open':''}">${summary}${editor}</div>`;
  }).join('');
  // Scroll'u geri yükle (başa atmasın) — modal sonraki frame'de hazır olur
  if(modal && scrollY){
    modal.scrollTop=scrollY;
    requestAnimationFrame(()=>{ modal.scrollTop=scrollY; });
  }
}

function fdExtra(f,i){
  if(f.type==='value'){
    return `<div style="display:flex;gap:8px">
      <div style="flex:1"><label class="fd-lbl">Min (uygun alt)</label><input class="form-input fd-in" type="number" value="${f.min??''}" placeholder="sınırsız" oninput="fdSet(${i},'min',this.value)"/></div>
      <div style="flex:1"><label class="fd-lbl">Max (uygun üst)</label><input class="form-input fd-in" type="number" value="${f.max??''}" placeholder="sınırsız" oninput="fdSet(${i},'max',this.value)"/></div>
    </div><p class="fd-hint">Aralık dışı değer otomatik "Uygun Değil" sayılır. Birimi başlığa yaz (örn: "Basınç (bar)").</p>`;
  }
  if(f.type==='yesno'){
    return `<label class="fd-lbl">Hangisi olumsuz?</label>
      <select class="form-select fd-in" onchange="fdSet(${i},'negative',this.value)">
        <option value="evet" ${f.negative!=='hayir'?'selected':''}>Evet = Uygun Değil</option>
        <option value="hayir" ${f.negative==='hayir'?'selected':''}>Hayır = Uygun Değil</option>
      </select><p class="fd-hint">Örn: "Sızıntı var mı?" → Evet olumsuz.</p>`;
  }
  if(f.type==='select'){
    return `<label class="fd-lbl">Seçenekler (her satıra bir)</label>
      <textarea class="form-textarea fd-in" rows="3" placeholder="İyi&#10;Orta&#10;Kötü" oninput="fdSet(${i},'optionsRaw',this.value)">${safe((f.options||[]).join('\n'))}</textarea>
      <label class="fd-lbl">Olumsuz sayılanlar (virgülle)</label>
      <input class="form-input fd-in" value="${safe((f.negativeOptions||[]).join(', '))}" placeholder="Kötü" oninput="fdSet(${i},'negoptsRaw',this.value)"/>`;
  }
  if(f.type==='table'){
    const cols=f.columns||[];
    const rows=f.rows||[];
    const fixedCols=cols.filter(c=>c.fixed);

    // ── IZGARA: üst başlıklar (sütunlar) — başlığa tıkla-yaz, sağ üstte × ──
    const headCells=cols.map((c,ci)=>`
      <th class="tg-th${c.fixed?' tg-fixed':''}">
        <button class="tg-colx" onclick="fdColDel(${i},${ci})" title="Sütunu sil">×</button>
        <div class="tg-th-row">
          <span class="tg-th-icon">${(FIELD_TYPES.find(x=>x.t===c.type)||{}).icon||'•'}</span>
          <input class="tg-th-input" value="${safe(c.label)}" placeholder="Sütun adı" oninput="fdColSet(${i},${ci},'label',this.value)"/>
        </div>
        <select class="tg-th-type" onchange="fdColSet(${i},${ci},'type',this.value)">${fdTypeOptions(c.type,false)}</select>
        <label class="tg-th-fixed"><input type="checkbox" ${c.fixed?'checked':''} onchange="fdColSet(${i},${ci},'fixed',this.checked)"/> sabit künye</label>
      </th>`).join('');

    // ── IZGARA: veri satırları (birimler) — sonunda × ──
    const bodyRows=rows.map((r,ri)=>`
      <tr>
        <td class="tg-rowlbl">
          <input class="tg-cell" value="${safe(r.label||'')}" placeholder="Birim ${ri+1}" oninput="fdRowSet(${i},${ri},'label',this.value)"/>
        </td>
        ${cols.map(c=>{
          if(c.fixed){
            return `<td class="tg-td tg-fixed"><input class="tg-cell" value="${safe((r.fixed&&r.fixed[c.id])||'')}" placeholder="${safe(c.label)}" oninput="fdRowFixedSet(${i},${ri},'${c.id}',this.value)"/></td>`;
          }
          if(c.type==='qr'){
            return `<td class="tg-td tg-auto"><span title="Denetimde QR okutularak onaylanır">⊡ QR okut</span></td>`;
          }
          return `<td class="tg-td tg-auto"><span title="Denetimde doldurulur">denetimde</span></td>`;
        }).join('')}
        <td class="tg-rowdel"><button class="tg-rowx" onclick="fdRowDel(${i},${ri})" title="Birimi sil">×</button></td>
      </tr>`).join('');

    return `<label class="fd-lbl">Tablo</label>
      <p class="fd-hint" style="margin-top:0;margin-bottom:8px">Sütun başlığına yazarak adını ver. "Sabit künye" işaretli sütunlar (kapasite, SKT) bir kez girilir, her denetimde otomatik gelir. Diğerleri ("denetimde") her denetimde doldurulur.</p>
      <div class="tg-wrap">
        <table class="tg-table">
          <thead><tr>
            <th class="tg-th tg-corner">BİRİM</th>
            ${headCells}
          </tr></thead>
          <tbody>
            ${bodyRows||`<tr><td colspan="${cols.length+2}" class="tg-emptyrow">Henüz birim yok. Aşağıdan ekle.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="tg-actions">
        <button class="btn btn-primary btn-sm" onclick="fdColAddInline(${i})">＋ Sütun</button>
        <button class="btn btn-primary btn-sm" onclick="fdRowAdd(${i})">＋ Birim</button>
        <button class="btn btn-secondary btn-sm" onclick="fdBulkCount(${i})">⚡ Toplu Birim</button>
        <button class="btn btn-secondary btn-sm" onclick="fdBulkPaste(${i})">📋 Liste Yapıştır</button>
      </div>
      <p class="fd-hint">${cols.length} sütun · ${rows.length} birim</p>`;
  }
  return '';
}

/* Sütun ekle — ızgaraya boş sütun, başlığına odaklan (inline yaz) */
function fdColAddInline(i){
  const f=_fdForm.fields[i];
  if(!f.columns) f.columns=[];
  f.columns.push({id:fid(), type:'okfail', label:''});
  renderFdFields();
  // Yeni sütunun başlığına odaklan + yatay olarak görünür yap (dikey scroll korunur)
  setTimeout(()=>{
    const inputs=document.querySelectorAll('.fd-card.open .tg-th-input');
    const last=inputs[inputs.length-1];
    if(last){ last.focus({preventScroll:true}); last.closest('.tg-wrap')?.scrollTo({left:99999,behavior:'smooth'}); }
  },50);
}

/* Tablo satır (birim) yönetimi — form tasarımcısı */
function fdRowAdd(i){
  const f=_fdForm.fields[i];
  if(!f.rows) f.rows=[];
  f.rows.push({id:fid(), label:'', fixed:{}});
  renderFdFields();
  // Yeni satırın adına odaklan ama modal'ı zıplatma (dikey scroll korunur)
  setTimeout(()=>{
    const items=document.querySelectorAll('.fd-card.open .tc-row');
    const last=items[items.length-1];
    if(last){ const inp=last.querySelector('.tc-row-name'); inp?.focus({preventScroll:true}); }
  },50);
}
function fdRowDel(i,ri){ _fdForm.fields[i].rows.splice(ri,1); renderFdFields(); }
function fdRowSet(i,ri,key,val){ _fdForm.fields[i].rows[ri][key]=val; }
function fdRowFixedSet(i,ri,colId,val){
  const r=_fdForm.fields[i].rows[ri];
  if(!r.fixed) r.fixed={};
  r.fixed[colId]=val;
}

/* Toplu satır ekleme — sayı gir, otomatik oluştur */
async function fdBulkCount(i){
  const f=_fdForm.fields[i];
  const cntStr=await promptDialog({title:'Toplu Birim Oluştur',message:'Kaç adet birim eklensin?',placeholder:'Örn: 50',okText:'Oluştur'});
  if(cntStr===null) return;
  const cnt=parseInt(cntStr,10);
  if(isNaN(cnt)||cnt<1||cnt>1000){ toast('⚠️ 1-1000 arası bir sayı girin'); return; }
  const prefix=await promptDialog({title:'Ön Ek',message:'Birim adı ön eki (numara otomatik eklenir):',placeholder:'Örn: Tüp ',value:'Tüp '});
  if(prefix===null) return;
  if(!f.rows) f.rows=[];
  const start=f.rows.length;
  for(let n=1;n<=cnt;n++){ f.rows.push({id:fid(), label:`${prefix}${start+n}`, fixed:{}}); }
  renderFdFields();
  toast(`✅ ${cnt} birim eklendi`);
}

/* Liste yapıştır — "ad, künye1, künye2" satırları */
async function fdBulkPaste(i){
  const f=_fdForm.fields[i];
  const fixedCols=(f.columns||[]).filter(c=>c.fixed);
  const hint=fixedCols.length
    ? `Her satıra: Birim adı${fixedCols.map(c=>', '+c.label).join('')}\nÖrn: T-001, 6kg, 2027-03`
    : 'Her satıra bir birim adı yazın.';
  const txt=await promptDialog({title:'Liste Yapıştır',message:hint,placeholder:'T-001, 6, 2027-03\nT-002, 12, 2026-11',multiline:true,okText:'Ekle'});
  if(txt===null||!txt.trim()) return;
  if(!f.rows) f.rows=[];
  let added=0;
  txt.split('\n').forEach(line=>{
    line=line.trim(); if(!line) return;
    const parts=line.split(/[,;\t]/).map(s=>s.trim());
    const row={id:fid(), label:parts[0]||('Birim '+(f.rows.length+1)), fixed:{}};
    fixedCols.forEach((c,idx)=>{ if(parts[idx+1]!==undefined) row.fixed[c.id]=parts[idx+1]; });
    f.rows.push(row); added++;
  });
  renderFdFields();
  toast(`✅ ${added} birim eklendi`);
}

function fdColExtra(c,i,ci){
  if(c.type==='value'){
    return `<div class="fd-col-extra"><input class="fd-col-in" type="number" value="${c.min??''}" placeholder="min" oninput="fdColSet(${i},${ci},'min',this.value)"/><input class="fd-col-in" type="number" value="${c.max??''}" placeholder="max" oninput="fdColSet(${i},${ci},'max',this.value)"/></div>`;
  }
  if(c.type==='yesno'){
    return `<div class="fd-col-extra"><select class="fd-col-sel" onchange="fdColSet(${i},${ci},'negative',this.value)"><option value="evet" ${c.negative!=='hayir'?'selected':''}>Evet=olumsuz</option><option value="hayir" ${c.negative==='hayir'?'selected':''}>Hayır=olumsuz</option></select></div>`;
  }
  if(c.type==='select'){
    return `<div class="fd-col-extra" style="flex-direction:column;gap:4px">
      <input class="fd-col-in" style="width:100%" value="${safe((c.options||[]).join(', '))}" placeholder="seçenekler (virgülle)" oninput="fdColSet(${i},${ci},'optionsCsv',this.value)"/>
      <input class="fd-col-in" style="width:100%" value="${safe((c.negativeOptions||[]).join(', '))}" placeholder="olumsuzlar (virgülle)" oninput="fdColSet(${i},${ci},'negoptsCsv',this.value)"/>
    </div>`;
  }
  return '';
}

function fdToggle(i){ _fdOpen=_fdOpen===i?-1:i; renderFdFields(); }

function fdSet(i,key,val){
  const f=_fdForm.fields[i];
  if(key==='optionsRaw'){ f.options=val.split('\n').map(s=>s.trim()).filter(Boolean); return; }
  if(key==='negoptsRaw'){ f.negativeOptions=val.split(',').map(s=>s.trim()).filter(Boolean); return; }
  f[key]=val;
}

function fdSetType(i,val){
  _fdForm.fields[i].type=val;
  if(val==='table'&&!_fdForm.fields[i].columns) _fdForm.fields[i].columns=[];
  renderFdFields();
}

function fdMoveField(i,dir){
  const f=_fdForm.fields; const j=i+dir;
  if(j<0||j>=f.length) return;
  [f[i],f[j]]=[f[j],f[i]];
  if(_fdOpen===i)_fdOpen=j; else if(_fdOpen===j)_fdOpen=i;
  renderFdFields();
}
async function fdDeleteField(i){
  if(!await confirmDialog({title:'Alan Silinsin mi?',message:`"${_fdForm.fields[i].label||'Bu alan'}" kaldırılacak.`,danger:true,okText:'Sil'})) return;
  _fdForm.fields.splice(i,1);
  if(_fdOpen>=i)_fdOpen=-1;
  renderFdFields();
}
function fdAddField(){
  _fdForm.fields.push({id:fid(),type:'okfail',label:'',required:true});
  _fdOpen=_fdForm.fields.length-1;
  renderFdFields();
  // Yeni alanın başlık input'una odaklan
  setTimeout(()=>{ const inp=document.querySelector('.fd-card.open .fd-in'); inp?.focus(); },50);
}

function fdColAdd(i){
  const f=_fdForm.fields[i];
  if(!f.columns)f.columns=[];
  f.columns.push({id:fid(),type:'okfail',label:''});
  renderFdFields();
  // Yeni sütunun adına odaklan + görünür yap
  setTimeout(()=>{
    const cards=document.querySelectorAll('.fd-card.open .tc-col');
    const last=cards[cards.length-1];
    if(last){ const inp=last.querySelector('.tc-col-name'); inp?.focus(); last.scrollIntoView({behavior:'smooth',block:'center'}); }
  },60);
}
function fdColDel(i,ci){ const f=_fdForm.fields[i]; f.columns.splice(ci,1); renderFdFields(); }
function fdColSet(i,ci,key,val){
  const c=_fdForm.fields[i].columns[ci];
  if(key==='optionsCsv'){ c.options=val.split(',').map(s=>s.trim()).filter(Boolean); return; }
  if(key==='negoptsCsv'){ c.negativeOptions=val.split(',').map(s=>s.trim()).filter(Boolean); return; }
  c[key]=val;
  // Sadece "sabit künye" değişince satır künye alanları görünmeli → re-render
  // Tip değişiminde re-render YOK (telefonda başa atmasın); ikon bir sonraki açılışta güncellenir
  if(key==='fixed') renderFdFields();
}

async function fdSaveForm(){
  for(const f of _fdForm.fields){
    if(!f.label||!f.label.trim()){ toast('⚠️ Tüm alanlara başlık girin'); return; }
    if(f.type==='table'){
      if(!f.columns||!f.columns.length){ toast(`⚠️ "${f.label}" tablosuna sütun ekleyin`); return; }
      for(const c of f.columns){ if(!c.label||!c.label.trim()){ toast('⚠️ Tüm sütunlara başlık girin'); return; } }
    }
  }
  if(!_fdForm.fields.length){ toast('⚠️ En az 1 alan ekleyin'); return; }
  // Geçici UI alanlarını temizle (kaydedilmesin)
  _fdForm.fields.forEach(f=>{ delete f._openCol; delete f._addingCol; });
  try{
    if(_fdSaveTarget==='global'){
      // Global tür formu — globalCats'e yaz, otomatik tüm şirketlere uygula.
      if(!_globalCats.forms) _globalCats.forms={};
      _globalCats.forms[_fdCatId]=JSON.parse(JSON.stringify(_fdForm));
      _fdSaveTarget=null;
      closeModal('modal-form-designer');
      // Gizlenen periyot/bakım kutularını geri aç (sonraki şirket-içi kullanım için)
      const pBox=document.getElementById('fd-period-box'); if(pBox) pBox.style.display='';
      const mBox=document.getElementById('fd-maint-box'); if(mBox) mBox.style.display='';
      await saveGlobalCatsAndApply('Form kaydedildi');
      return;
    }
    if(_fdSaveTarget==='newequip'){
      // Eklenecek ekipmanın taslağına yaz — kalıcı kayıt saveNewEquip'te
      _newEquipForm=JSON.parse(JSON.stringify(_fdForm));
      _fdSaveTarget=null;
      closeModal('modal-form-designer');
      toast('✅ Form hazır');
      renderAddFormPreview();
      return;
    }
    if(_fdSaveTarget==='equip'){
      const e=equipById(S.editEquipId);
      if(e){ e.form=_fdForm; await save(); logActivity('form_edit',`"${e.name}" denetim formu düzenlendi`); }
      _fdSaveTarget=null;
    } else {
      await setCatForm(_fdCatId, _fdForm);
      // Tür varsayılan periyodunu da kaydet
      const pSel=document.getElementById('fd-period');
      if(pSel && _fdCatId){
        let p;
        if(pSel.value==='custom'){ p=parseInt(document.getElementById('fd-period-custom')?.value); if(isNaN(p)||p<1) p=catDefaultPeriod(_fdCatId); }
        else p=parseInt(pSel.value);
        if(!isNaN(p)){ if(!S.catPeriods) S.catPeriods={}; S.catPeriods[_fdCatId]=p; }
      }
      // Tür varsayılan bakım bilgilerini kaydet
      const fmd=trToIso(document.getElementById('fd-maint-date')?.value||'');
      if(_fdCatId){
        if(!S.catMaintenance) S.catMaintenance={};
        if(fmd){
          S.catMaintenance[_fdCatId]={
            date:fmd,
            firm:document.getElementById('fd-maint-firm')?.value.trim()||'',
            note:document.getElementById('fd-maint-note')?.value.trim()||'',
            warnDays:parseInt(document.getElementById('fd-maint-warn')?.value)||15
          };
        } else {
          delete S.catMaintenance[_fdCatId];
        }
      }
      logActivity('form_edit', `"${_fdCatName}" denetim formu güncellendi`);
      await save();
    }
    closeModal('modal-form-designer');
    toast('✅ Form kaydedildi');
    const ac=document.getElementById('inp-equip-cat');
    if(ac && document.getElementById('modal-add-equip')?.classList.contains('open')) renderAddFormPreview();
  }catch(e){ toast('❌ '+e.message,5000); }
}


function renderTupSetupRows(){
  const tbody=document.getElementById('tup-setup-rows'); if(!tbody) return;
  tbody.innerHTML=(S.tupSetupRows||[]).map((r,i)=>`<tr>
    <td><input value="${safe(r.tupNo)}" placeholder="T-001" style="width:100%;padding:5px;border:1px solid var(--brd);border-radius:5px;font-size:12px;background:var(--bg);color:var(--txt)" oninput="S.tupSetupRows[${i}].tupNo=this.value"/></td>
    <td><input value="${safe(r.kapasite)}" placeholder="6" type="number" style="width:55px;padding:5px;border:1px solid var(--brd);border-radius:5px;font-size:12px;background:var(--bg);color:var(--txt)" oninput="S.tupSetupRows[${i}].kapasite=this.value"/></td>
    <td><input type="date" value="${safe(r.tarih)}" style="padding:5px;border:1px solid var(--brd);border-radius:5px;font-size:12px;background:var(--bg);color:var(--txt)" oninput="S.tupSetupRows[${i}].tarih=this.value"/></td>
    <td><input value="${safe(r.konum)}" placeholder="B blok" style="width:100%;padding:5px;border:1px solid var(--brd);border-radius:5px;font-size:12px;background:var(--bg);color:var(--txt)" oninput="S.tupSetupRows[${i}].konum=this.value"/></td>
    <td><button class="tup-del" onclick="S.tupSetupRows.splice(${i},1);renderTupSetupRows()">×</button></td>
  </tr>`).join('');
}

function openAddEquipModal(){
  populateCatSelects(); populateMahalSelects();
  ['inp-equip-name','inp-equip-desc','inp-equip-maint-date','inp-equip-maint-firm','inp-equip-maint-note'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const mw=document.getElementById('inp-equip-maint-warn'); if(mw) mw.value=15;
  // Bakım kutusu kapalı başlasın
  const mc=document.getElementById('add-maint-content'); if(mc) mc.style.display='none';
  const mch=document.getElementById('add-maint-chev'); if(mch) mch.style.transform='rotate(0deg)';
  // Periyot sıfırla
  const ps=document.getElementById('inp-equip-period'); if(ps) ps.value='';
  const pc=document.getElementById('inp-equip-period-custom'); if(pc){ pc.value=''; pc.style.display='none'; }
  // İlk kategorinin formunu taslağa kopyala
  const sel=document.getElementById('inp-equip-cat');
  const firstCat=sel?.value||CATS[0]?.id;
  _newEquipForm=getCatForm(firstCat);
  renderAddFormPreview();
  openModal('modal-add-equip');
}

/* Form'dan periyot değerini oku (select + custom input) */
function readPeriodValue(selId, customId){
  const sel=document.getElementById(selId);
  if(!sel) return undefined;
  const v=sel.value;
  if(v==='') return undefined;          // kategori varsayılanı
  if(v==='custom'){
    const c=parseInt(document.getElementById(customId)?.value);
    return (isNaN(c)||c<1)?undefined:c;
  }
  return parseInt(v);                    // 0 = periyot yok
}

async function saveNewEquip(){
  if(!canDo('add_equip')){ toast('🚫 Yetkiniz yok'); return; }
  const name   =document.getElementById('inp-equip-name').value.trim();
  const mahalId=document.getElementById('inp-equip-mahal').value;
  const cat    =document.getElementById('inp-equip-cat').value;
  const desc   =document.getElementById('inp-equip-desc').value.trim();
  const period =readPeriodValue('inp-equip-period','inp-equip-period-custom');
  if(!name){ toast('⚠️ Ad zorunlu'); return; }
  if(!mahalId){ toast('⚠️ Mahal seçin'); return; }
  if(cat==='__new__'){ toast('⚠️ Geçerli bir tür seçin'); return; }
  // Taslak form varsa onu, yoksa türün formunu kopyala — her ekipman BAĞIMSIZ kopya taşır
  const formForEquip = _newEquipForm ? JSON.parse(JSON.stringify(_newEquipForm)) : getCatForm(cat);
  const equip={id:uid(),name,cat,desc,mahalId,imageUrl:'',
    form: formForEquip,
    lastInsp:null,createdAt:nowStr(),createdBy:S.cur?.username||'admin'};
  if(period!==undefined) equip.period=period;
  // Bakım bilgileri
  const mDate=trToIso(document.getElementById('inp-equip-maint-date')?.value||'');
  if(mDate){
    equip.maintenance={
      date:mDate,
      firm:document.getElementById('inp-equip-maint-firm')?.value.trim()||'',
      note:document.getElementById('inp-equip-maint-note')?.value.trim()||'',
      warnDays:parseInt(document.getElementById('inp-equip-maint-warn')?.value)||15,
      notified:false
    };
  } else if(S.catMaintenance && S.catMaintenance[cat] && S.catMaintenance[cat].date){
    // Ekipmana özel bakım girilmediyse TÜRÜN varsayılan bakımını uygula
    const cm=S.catMaintenance[cat];
    equip.maintenance={ date:cm.date, firm:cm.firm||'', note:cm.note||'', warnDays:cm.warnDays||15, notified:false, fromType:true };
  }
  S.equips.push(equip);
  _newEquipForm=null;  // taslağı temizle
  logActivity('equip_add', `"${name}" eklendi`);
  try{
    await save(); closeModal('modal-add-equip'); S.tupSetupRows=[];
    toast('✅ Ekipman eklendi: '+name);
    renderCurrent();
    if(equip.maintenance) checkMaintenanceWarnings(true);
    setTimeout(()=>showQRModal(equip.id),500);
  }catch(e){ toast('❌ '+e.message,5000); }
}

function openEditEquip(id){
  if(!canDo('add_equip') && !canDo('del_equip')){ toast('🚫 Yetkiniz yok'); return; }
  S.editEquipId=id;
  const e=equipById(id); if(!e) return;
  populateCatSelects(); populateMahalSelects();
  document.getElementById('edit-equip-name').value=e.name;
  document.getElementById('edit-equip-cat').value=e.cat;
  document.getElementById('edit-equip-mahal').value=e.mahalId||'';
  document.getElementById('edit-equip-desc').value=e.desc||'';
  document.getElementById('edit-equip-img-url').value=e.imageUrl||'';
  // Periyot yükle
  const pSel=document.getElementById('edit-equip-period');
  const pCustom=document.getElementById('edit-equip-period-custom');
  if(pSel){
    if(e.period===undefined||e.period===null){ pSel.value=''; pCustom.style.display='none'; }
    else if([7,14,30,90,180,365,0].includes(e.period)){ pSel.value=String(e.period); pCustom.style.display='none'; }
    else { pSel.value='custom'; pCustom.style.display='block'; pCustom.value=e.period; }
  }
  document.getElementById('btn-del-equip').style.display=canDo('del_equip')?'':'none';
  // Bakım bilgilerini yükle
  const mt=e.maintenance||{};
  const md=document.getElementById('edit-equip-maint-date'); if(md) md.value=isoToTr(mt.date||'');
  const mf=document.getElementById('edit-equip-maint-firm'); if(mf) mf.value=mt.firm||'';
  const mn=document.getElementById('edit-equip-maint-note'); if(mn) mn.value=mt.note||'';
  const mw=document.getElementById('edit-equip-maint-warn'); if(mw) mw.value=mt.warnDays||15;
  // Bakım kutusu her açılışta KAPALI başlasın
  const mc=document.getElementById('edit-maint-content'); if(mc) mc.style.display='none';
  const mch=document.getElementById('edit-maint-chev'); if(mch) mch.style.transform='rotate(0deg)';
  openModal('modal-edit-equip');
}

/* Ekipmanın kendi denetim formunu düzenle */
function editEquipForm(){
  const e=equipById(S.editEquipId); if(!e) return;
  // Form yoksa türünden üret
  let form=e.form;
  if(!form||!form.fields) form=getCatForm(e.cat);
  _fdForm=JSON.parse(JSON.stringify(form));
  _fdCatId=null;          // tür değil, ekipman formu
  _fdCatName=e.name;
  document.getElementById('fd-title').textContent='🛠️ '+e.name+' — Denetim Formu';
  document.getElementById('fd-subtitle').textContent='Bu ekipmana özel denetim formunu düzenle.';
  // Ekipman formu: tür periyot kutusunu gizle (ekipmanın kendi periyodu düzenleme ekranında)
  const pBox=document.getElementById('fd-period-box'); if(pBox) pBox.style.display='none';
  const mBox2=document.getElementById('fd-maint-box'); if(mBox2) mBox2.style.display='none';
  // Kaydetme davranışını ekipmana yönlendir
  _fdSaveTarget='equip';
  _fdOpen=-1;
  renderFdFields();
  openModal('modal-form-designer');
}

async function saveEditEquip(){
  if(!canDo('add_equip') && !canDo('del_equip')){ toast('🚫 Yetkiniz yok'); return; }
  const e=equipById(S.editEquipId); if(!e) return;
  const name=document.getElementById('edit-equip-name').value.trim();
  if(!name){ toast('⚠️ Ad zorunlu'); return; }
  e.name=name;
  e.cat=document.getElementById('edit-equip-cat').value;
  e.mahalId=document.getElementById('edit-equip-mahal').value;
  e.desc=document.getElementById('edit-equip-desc').value.trim();
  e.imageUrl=document.getElementById('edit-equip-img-url').value.trim();
  const period=readPeriodValue('edit-equip-period','edit-equip-period-custom');
  if(period===undefined) delete e.period; else e.period=period;
  // Bakım bilgileri
  const mDate=trToIso(document.getElementById('edit-equip-maint-date')?.value||'');
  if(mDate){
    const oldDate=e.maintenance?.date;
    e.maintenance={
      date:mDate,
      firm:document.getElementById('edit-equip-maint-firm')?.value.trim()||'',
      note:document.getElementById('edit-equip-maint-note')?.value.trim()||'',
      warnDays:parseInt(document.getElementById('edit-equip-maint-warn')?.value)||15,
      // Tarih değiştiyse uyarı bayrağını sıfırla (yeni tarih için tekrar uyarsın)
      notified: oldDate===mDate ? (e.maintenance?.notified||false) : false
    };
  } else {
    delete e.maintenance;
  }
  try{ await save(); closeModal('modal-edit-equip'); toast('✅ Güncellendi'); renderCurrent(); if(e.maintenance) checkMaintenanceWarnings(true); }
  catch(err){ toast('❌ '+err.message,5000); }
}

async function deleteEquip(){
  if(!canDo('del_equip')){ toast('🚫 Yetkiniz yok'); return; }
  const e=equipById(S.editEquipId); if(!e) return;
  if(!await confirmDialog({title:'Ekipman Silinsin mi?',message:`"${e.name}" ve denetim raporları kalıcı olarak silinecek.`,danger:true,okText:'Evet, Sil'})) return;
  S.equips  =S.equips.filter(x=>x.id!==S.editEquipId);
  S.reports =S.reports.filter(r=>r.equipId!==S.editEquipId);
  logActivity('equip_del', `"${e.name}" ekipmanı silindi`);
  try{ await save(); closeModal('modal-edit-equip'); toast('🗑️ Silindi'); goBack(); }
  catch(err){ toast('❌ '+err.message,5000); }
}

/* ══════════════════════════════════════
   QR KOD
══════════════════════════════════════ */
function showQRModal(id){
  const e=equipById(id); if(!e) return;
  S.qrEquipId=id;
  const box=document.getElementById('qr-box');
  box.innerHTML='';
  box.style.position='relative';
  if(typeof QRCode!=='undefined'){
    try{ new QRCode(box,{text:qrPayload(e.id),width:220,height:220,colorDark:'#111827',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.H}); }
    catch{ qrFallback(box,e.id); }
  } else qrFallback(box,e.id);
  // Ortaya logo bindir (correctLevel:H sayesinde okunabilirlik bozulmaz)
  setTimeout(()=>{
    if(document.getElementById('qr-logo-ov')) return;
    const ov=document.createElement('div');
    ov.id='qr-logo-ov';
    ov.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:46px;height:46px;background:#fff;border-radius:11px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.2)';
    ov.innerHTML='<div style="width:38px;height:38px;border-radius:9px;background:linear-gradient(135deg,#6C8EF5,#8B5CF6);display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" width="22" height="22"><circle cx="10.5" cy="10.5" r="6"/><line x1="15" y1="15" x2="20" y2="20"/></svg></div>';
    box.appendChild(ov);
  },60);
  document.getElementById('qr-lbl').textContent=e.name+' · '+e.id;
  openModal('modal-qr');
}
function qrFallback(box,id){
  const img=document.createElement('img');
  img.src=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrPayload(id))}`;
  img.width=220; img.height=220; img.style.borderRadius='8px';
  box.appendChild(img);
}
function downloadQR(){
  const e=equipById(S.qrEquipId);
  const name=e?e.name:S.qrEquipId;
  const srcCanvas=document.querySelector('#qr-box canvas');
  if(srcCanvas){
    // Etiketli versiyon: logo + isim + id
    const W=300, H=370, pad=20;
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const ctx=cv.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
    // Başlık (TakipEt)
    ctx.fillStyle='#6C8EF5'; ctx.font='bold 20px Inter,sans-serif'; ctx.textAlign='center';
    ctx.fillText('TakipEt', W/2, 34);
    // QR
    ctx.drawImage(srcCanvas, (W-220)/2, 50, 220, 220);
    // Logo ortada
    const cx=W/2, cy=160;
    ctx.fillStyle='#fff'; roundRect(ctx,cx-25,cy-25,50,50,12); ctx.fill();
    const g=ctx.createLinearGradient(cx-19,cy-19,cx+19,cy+19); g.addColorStop(0,'#6C8EF5'); g.addColorStop(1,'#8B5CF6');
    ctx.fillStyle=g; roundRect(ctx,cx-19,cy-19,38,38,9); ctx.fill();
    ctx.strokeStyle='#fff'; ctx.lineWidth=2.6; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(cx-3,cy-3,7,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+2.5,cy+2.5); ctx.lineTo(cx+8,cy+8); ctx.stroke();
    // İsim
    ctx.fillStyle='#111827'; ctx.font='bold 16px Inter,sans-serif';
    const nm=name.length>26?name.slice(0,25)+'…':name;
    ctx.fillText(nm, W/2, 300);
    // ID
    ctx.fillStyle='#9ca3af'; ctx.font='12px Inter,sans-serif';
    ctx.fillText(S.qrEquipId, W/2, 322);
    ctx.fillStyle='#d1d5db'; ctx.font='10px Inter,sans-serif';
    ctx.fillText('Denetim için okutun', W/2, 344);
    const a=document.createElement('a'); a.download=name+'-QR.png'; a.href=cv.toDataURL('image/png'); a.click();
    return;
  }
  const img=document.querySelector('#qr-box img');
  if(img) window.open(img.src,'_blank');
}
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

/* ══════════════════════════════════════
   KAMERA
══════════════════════════════════════ */
async function startCamera(){
  const hint=document.getElementById('cam-hint');
  hint.textContent='Kamera izni isteniyor…';
  try{
    S.camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});
    const v=document.getElementById('qr-video'); v.srcObject=S.camStream; await v.play();
    document.getElementById('btn-cam-start').disabled=true;
    document.getElementById('btn-cam-stop').disabled=false;
    hint.textContent='QR kodu kameranın karşısına tutun…';
    scanLoop();
  }catch(e){ hint.textContent='❌ Kamera hatası: '+e.message; }
}
function stopCamera(){
  if(S.camStream){ S.camStream.getTracks().forEach(t=>t.stop()); S.camStream=null; }
  if(S.scanAnimId){ cancelAnimationFrame(S.scanAnimId); S.scanAnimId=null; }
  const v=document.getElementById('qr-video'); if(v) v.srcObject=null;
  const s=document.getElementById('btn-cam-start'); if(s) s.disabled=false;
  const t=document.getElementById('btn-cam-stop');  if(t) t.disabled=true;
}
function scanLoop(){
  const v=document.getElementById('qr-video'), c=document.getElementById('qr-canvas');
  if(!v||!c||!S.camStream) return;
  if(v.readyState!==v.HAVE_ENOUGH_DATA){ S.scanAnimId=requestAnimationFrame(scanLoop); return; }
  c.width=v.videoWidth; c.height=v.videoHeight;
  const ctx=c.getContext('2d'); ctx.drawImage(v,0,0,c.width,c.height);
  try{
    const code=jsQR(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height,{inversionAttempts:'dontInvert'});
    if(code){ stopCamera(); closeModal('modal-scan'); handleQRData(code.data); return; }
  }catch(e){}
  S.scanAnimId=requestAnimationFrame(scanLoop);
}
function handleQRFile(file){
  if(!file) return;
  const hint=document.getElementById('file-hint'); hint.textContent='Analiz ediliyor…';
  const img=new Image(), url=URL.createObjectURL(file);
  img.onload=()=>{
    const cvs=document.createElement('canvas'); cvs.width=img.width; cvs.height=img.height;
    const ctx=cvs.getContext('2d'); ctx.drawImage(img,0,0);
    const code=jsQR(ctx.getImageData(0,0,cvs.width,cvs.height).data,cvs.width,cvs.height);
    URL.revokeObjectURL(url);
    if(code){ hint.textContent='✅ OK'; closeModal('modal-scan'); setTimeout(()=>handleQRData(code.data),200); }
    else hint.textContent='❌ QR bulunamadı.';
  }; img.src=url;
}
let _pendingQR=null; // girişsiz QR okutulunca saklanır, giriş sonrası işlenir
/* Süper admin QR okuttu ama ekipman aktif şirkette yok → tüm şirketlerde ara, bulunduğu şirkete geç */
async function findEquipAcrossCompanies(equipId){
  // Birim QR formatı (TE:equipId:field:row) ise gerçek equipId'yi çıkar
  let searchId=equipId, fullData=equipId;
  if(equipId.startsWith('TE:')){ searchId=equipId.split(':')[1]; }
  showLoading(true);
  try{
    for(const c of S.companies){
      if(c.id===S.activeCompanyId) continue;
      try{
        const snap=await _db.ref(`${companyDataPath(c.id)}/equips`).once('value');
        if(snap.exists()){
          const equips=toArr(snap.val());
          const found=equips.find(x=>x && x.id===searchId);
          if(found){
            showLoading(false);
            await switchToCompany(c.id);
            await new Promise(r=>setTimeout(r,400));
            setTimeout(()=>handleQRData(fullData), 300);
            return;
          }
        }
      }catch(e){}
    }
    showLoading(false);
    toast('❌ Bu QR hiçbir şirkette bulunamadı', 4000);
  }catch(e){ showLoading(false); toast('❌ '+e.message,4000); }
}

function handleQRData(data){
  data=(data||'').trim();
  // QR bir URL ise (?q=... ile) — içindeki gerçek veriyi çıkar
  if(data.includes('?q=')){
    try{ const u=new URL(data); const q=u.searchParams.get('q'); if(q) data=q; }
    catch(e){ const m=data.match(/[?&]q=([^&]+)/); if(m) data=decodeURIComponent(m[1]); }
  }
  // QR ONAY MODU: denetimde bir alan/birim QR ile onaylanmayı bekliyorsa
  if(_qrConfirm){ resolveQrConfirm(data); return; }
  // Giriş yapılmamışsa → QR'ı sakla, giriş ekranına yönlendir (giriş sonrası o ekipmana gider)
  if(!S.cur){
    _pendingQR=data; // giriş sonrası işlenecek
    try{ sessionStorage.setItem('te_pendingQR', data); }catch(e){}
    showLoginPromptForQR(data);
    return;
  }

  // Birim QR formatı: "TE:<equipId>:<fieldId>:<rowId>"
  if(data.startsWith('TE:')){
    const parts=data.split(':');
    if(parts.length>=4){
      const equipId=parts[1], fieldId=parts[2], rowId=parts.slice(3).join(':');
      handleUnitQR(equipId, fieldId, rowId);
      return;
    }
  }
  // Normal ekipman QR
  let e=equipById(data);
  if(!e){
    // Süper admin: ekipman aktif şirkette yok → TÜM şirketlerde ara, bulunduğu şirkete geç
    if(S.cur?.isSuper){
      findEquipAcrossCompanies(data);
      return;
    }
    // Normal kullanıcı: başka şirketin QR'ı olabilir → "yetkin yok"
    toast('🚫 Bu ekipmana erişim yetkiniz yok', 4000);
    return;
  }
  S.activeMahalId=e.mahalId;

  // Ekipmanın formunda tablo YOK ama QR alanı VARSA:
  // QR okutularak gelindiği için o alanı otomatik onaylayıp denetimi aç (tekrar okutma yok)
  const form=e.form||getCatForm(e.cat);
  const hasTable=(form.fields||[]).some(f=>f.type==='table');
  const qrField=(form.fields||[]).find(f=>f.type==='qr');
  if(!hasTable && qrField && canDo('inspect')){
    openInspection(e.id, true);
    // Denetim hazır olana kadar bekle, sonra QR alanını tikle
    let tries=0;
    const tick=()=>{
      tries++;
      if(!_insp || _insp.equipId!==e.id){
        if(tries>30){ toast('⚠️ Denetim açılamadı'); return; }
        return setTimeout(tick, 150);
      }
      _insp.answers[qrField.id]='ok';
      _insp.answers[qrField.id+'_ts']=new Date().toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      saveInspDraftDyn(); renderInspection();
      haptic(20);
      toast('✅ QR doğrulandı — ilgili alan onaylandı');
    };
    setTimeout(tick, 350);
    return;
  }
  // Aksi halde ekipman detayına git
  openEquipDetail(e.id);
}

/* ── QR ile onay (denetim alanı) ── */
let _qrConfirm=null; // {type:'field'|'unit', equipId, fieldId, rowId}

/* Tekil 'qr' alanı için: ekipman QR'ı okutarak onayla */
function startQrConfirm(fieldId){
  if(!_insp||!_insp.equipId){ toast('⚠️ Önce denetimi açın'); return; }
  _qrConfirm={ type:'field', equipId:_insp.equipId, fieldId };
  openModal('modal-scan');
  // Modal animasyonu bitince kamerayı başlat (yoksa siyah ekran)
  setTimeout(()=>{ startCamera&&startCamera(); }, 350);
}

/* Tablo birimi için: o birimin QR'ını okutarak onayla */
function startUnitQrConfirm(fieldId, rowId){
  if(!_insp||!_insp.equipId){ toast('⚠️ Önce denetimi açın'); return; }
  _qrConfirm={ type:'unit', equipId:_insp.equipId, fieldId, rowId };
  openModal('modal-scan');
  setTimeout(()=>{ startCamera&&startCamera(); }, 350);
}

/* Okutulan QR onay moduyla eşleşiyor mu? */
function resolveQrConfirm(data){
  const c=_qrConfirm; _qrConfirm=null;
  stopCamera&&stopCamera(); closeModal('modal-scan');
  if(!c) return;
  const now=new Date().toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});

  if(c.type==='field'){
    // Ekipman QR'ı: "TE:equipId:..." veya düz equipId olabilir
    let okId=null;
    if(data.startsWith('TE:')){ okId=data.split(':')[1]; }
    else { okId=data; }
    if(okId===c.equipId){
      _insp.answers[c.fieldId]='ok';
      _insp.answers[c.fieldId+'_ts']=now;
      saveInspDraftDyn(); renderInspection();
      haptic(20); toast('✅ QR doğrulandı, onaylandı');
    } else {
      toast('❌ Farklı bir ekipmanın QR\'ı — eşleşmedi');
    }
    return;
  }

  if(c.type==='unit'){
    // Birim QR: "TE:equipId:fieldId:rowId"
    if(!data.startsWith('TE:')){ toast('❌ Bu bir birim QR\'ı değil'); return; }
    const parts=data.split(':');
    const eId=parts[1], fId=parts[2], rId=parts.slice(3).join(':');
    // Ekipman + alan eşleşmeli; satır ise okutulan QR'a göre OTOMATİK bulunur
    // (kullanıcı önceden satır seçmek zorunda değil — sırayla okutabilir)
    if(eId!==c.equipId){ toast('❌ Farklı ekipmanın QR\'ı'); return; }
    if(fId!==c.fieldId){ toast('❌ Bu tablonun birimi değil'); return; }
    const rows=_insp.tables[c.fieldId]||[];
    const row=rows.find(r=>r._rowId===rId);
    if(row){
      row._qrOk=true; row._qrTs=now; row._qrTsNum=Date.now();
      saveInspDraftDyn(); pushCollabCell(); renderInspection();
      haptic(20); toast(`✅ "${row._label||'Birim'}" QR onaylandı`);
    } else {
      toast('⚠️ Bu QR\'a ait birim bu denetimde yok');
    }
    return;
  }
}

/* Birim QR okutuldu → ilgili ekipmanın denetimini aç + o birimi işaretle */
function handleUnitQR(equipId, fieldId, rowId){
  const e=equipById(equipId);
  if(!e){
    // Süper admin: başka şirkette olabilir → tüm şirketlerde ara, geçip birim QR'ı tekrar işle
    if(S.cur?.isSuper){ findEquipAcrossCompanies('TE:'+equipId+':'+fieldId+':'+rowId); return; }
    toast('🚫 Bu ekipmana erişim yetkiniz yok', 4000); return;
  }
  if(S.cur && !canDo('inspect')){ toast('🚫 Denetim yetkiniz yok'); S.activeMahalId=e.mahalId; openEquipDetail(e.id); return; }
  // Denetimi aç (yarım varsa ona devam et — QR ile birim onaylanıyor)
  openInspection(equipId, true);
  // Denetim + tablo hazır olana kadar bekle, sonra ilgili birimi tikle
  let tries=0;
  const tick=()=>{
    tries++;
    if(!_insp || _insp.equipId!==equipId){
      if(tries>30){ toast('⚠️ Denetim açılamadı'); return; }
      return setTimeout(tick, 150);
    }
    const rows=_insp.tables && _insp.tables[fieldId];
    if(!rows){
      if(tries>30){ toast('⚠️ Bu birim bu denetimde yok'); return; }
      return setTimeout(tick, 150);
    }
    const row=rows.find(r=>r._rowId===rowId);
    if(!row){
      if(tries>30){ toast('⚠️ Birim bulunamadı (silinmiş olabilir)'); return; }
      return setTimeout(tick, 150);
    }
    if(row._checked && row._qrOk){ renderInspection(); toast(`"${row._label||'Birim'}" zaten işaretli`); return; }
    const now=nowStr();
    row._checked=true;
    row._checkedAt=now;
    row._checkedBy=S.cur?.username||'';
    // QR sütunu varsa onu da onayla (QR ikonu → tik). Normal QR onay akışıyla tutarlı.
    const fld=(_insp.form?.fields||[]).find(f=>f.id===fieldId);
    const hasQrCol=(fld?.columns||[]).some(c=>c.type==='qr');
    if(hasQrCol){ row._qrOk=true; row._qrTs=now; row._qrTsNum=Date.now(); }
    haptic(20);
    saveInspDraftDyn();
    try{ pushCollabCell&&pushCollabCell(); }catch(e){}
    renderInspection();
    toast(`✅ "${row._label||'Birim'}" QR ile onaylandı`);
  };
  setTimeout(tick, 350);
}

/* Giriş yapmamış kişi QR okutunca — admin'in girdiği iletişim bilgisini göster */
/* Girişsiz QR okutuldu — kullanıcıyı bilgilendir, giriş ekranına yönlendir.
   Giriş yapınca _pendingQR işlenir, ilgili ekipmana gider. */
function showLoginPromptForQR(data){
  // Bu QR sisteme kayıtlı bir ekipman/birim mi? (giriş öncesi veriye bakamayız ama format kontrolü)
  const isEquipQR = data.startsWith('TE:') || /^[a-zA-Z0-9_-]+$/.test(data);
  const html=`<div style="padding:4px 0">
    <div style="text-align:center;font-size:42px;margin-bottom:8px">🔐</div>
    <p style="font-size:15px;font-weight:600;color:var(--txt);text-align:center;margin-bottom:6px">Denetim için giriş yapın</p>
    <p style="font-size:13.5px;color:var(--txt2);line-height:1.6;text-align:center;margin-bottom:20px">
      Bu ekipmanın denetimine erişmek için sisteme giriş yapmanız gerekiyor. Giriş yaptıktan sonra otomatik olarak ilgili ekipmana yönlendirileceksiniz.</p>
    <button class="btn btn-primary btn-full" onclick="closeModal('modal-guest');goToLoginForQR()" style="margin-bottom:10px">🔑 Giriş Yap</button>
    <button class="btn btn-secondary btn-full" onclick="closeModal('modal-guest');openGuestContact('${safe(data)}')">Yetkim yok / Bilgi al</button>
  </div>`;
  document.getElementById('guest-body').innerHTML=html;
  openModal('modal-guest');
}
function goToLoginForQR(){
  // Giriş ekranını göster (zaten görünür olabilir); QR _pendingQR'da saklı
  document.getElementById('app').style.display='none';
  const ls=document.getElementById('login-screen');
  if(ls) ls.style.display='flex';
}

function openGuestContact(scannedData){
  const c=S.contactInfo||{};
  const tel=(c.tel||'').trim();
  const mail=(c.mail||'').trim();
  let contactBlock='';
  if(tel||mail){
    contactBlock='<div style="margin-bottom:14px">';
    if(tel)  contactBlock+=`<a href="tel:${safe(tel)}" class="btn btn-primary btn-full" style="text-decoration:none;margin-bottom:8px">📞 ${safe(tel)}</a>`;
    if(mail) contactBlock+=`<a href="mailto:${safe(mail)}" class="btn btn-primary btn-full" style="text-decoration:none">✉️ ${safe(mail)}</a>`;
    contactBlock+='</div>';
  } else {
    // Admin henüz iletişim girmemişse varsayılan başvuru
    contactBlock=`<a href="mailto:${CONTACT_EMAIL}?subject=TakipEt%20Bilgi%20Talebi" class="btn btn-primary btn-full" style="text-decoration:none;margin-bottom:10px">📧 Bilgi Almak İçin Mail Gönder</a>`;
  }
  const html=`<div style="padding:4px 0">
    <div style="text-align:center;font-size:42px;margin-bottom:8px">🔒</div>
    <p style="font-size:14px;color:var(--txt2);line-height:1.6;text-align:center;margin-bottom:20px">
      Bu denetim sistemine erişim yetkiniz yok. Sorularınız için iletişime geçebilirsiniz.</p>
    ${contactBlock}
  </div>`;
  document.getElementById('guest-body').innerHTML=html;
  openModal('modal-guest');
}

/* Başvuru formu — mailto ile gönderir */
function openGuestForm(){
  const html=`<div style="padding:2px 0">
    <p style="font-size:13px;color:var(--txt2);margin-bottom:14px;line-height:1.5">Bilgilerinizi doldurun, size dönüş yapalım.</p>
    <div class="form-group"><label class="form-label">İSİM</label><input class="form-input" id="gf-name"/></div>
    <div class="form-group"><label class="form-label">SOYİSİM</label><input class="form-input" id="gf-surname"/></div>
    <div class="form-group"><label class="form-label">NUMARA</label><input class="form-input" id="gf-phone" type="tel" inputmode="tel"/></div>
    <div class="form-group"><label class="form-label">KULLANMAK İSTEDİĞİNİZ ALAN</label><textarea class="form-textarea" id="gf-area" placeholder="Örn: Otel, fabrika, AVM yangın denetimi…"></textarea></div>
    <button class="btn btn-primary btn-full" onclick="sendGuestForm()" style="margin-top:6px">📧 Gönder</button>
  </div>`;
  document.getElementById('guest-body').innerHTML=html;
}

function sendGuestForm(){
  const name=document.getElementById('gf-name').value.trim();
  const surname=document.getElementById('gf-surname').value.trim();
  const phone=document.getElementById('gf-phone').value.trim();
  const area=document.getElementById('gf-area').value.trim();
  if(!name||!surname){ toast('⚠️ İsim ve soyisim zorunlu'); return; }
  const body=`İsim: ${name}%0ASoyisim: ${surname}%0ANumara: ${phone}%0AUygulamayı kullanmak istediğim alan: ${area}`;
  const subject=`TakipEt Başvuru - ${name} ${surname}`;
  window.location.href=`mailto:cankonuralp.ck@gmail.com?subject=${encodeURIComponent(subject)}&body=${body}`;
  toast('📧 Mail uygulamanız açılıyor…');
}
function manualQRFind(){
  const v=document.getElementById('manual-qr-inp').value.trim();
  if(!v){ toast('⚠️ ID girin'); return; }
  closeModal('modal-scan'); handleQRData(v);
}
function switchScanTab(id){
  document.querySelectorAll('#modal-scan .tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('#modal-scan .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelector(`#modal-scan .tab[data-tab="${id}"]`)?.classList.add('active');
  document.getElementById('tab-'+id)?.classList.add('active');
  if(id!=='camera') stopCamera();
}

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
  if(id==='modal-scanner'){ stopScanner(); }  // eski - artik closeScanner kullaniliyor
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
