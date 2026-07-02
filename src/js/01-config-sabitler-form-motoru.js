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
  {id:'view_docs',    label:'Belgeleri Gör',      desc:'Belgeler panelini görüntüler (yetki yoksa panel gizli)'},
  {id:'manage_docs',  label:'Belge Yönetimi',     desc:'Klasör/belge ekle-sil, taşı, yükle'},
  {id:'manage_workorders', label:'İş Emri Oluştur', desc:'Yeni iş emri girer ve atar'},
];

// Varsayılan rol yetkileri (admin tümü; diğerleri kademeli)
const DEFAULT_ROLE_PERMS = {
  admin:     PERM_DEFS.map(p=>p.id),
  manager:   ['add_mahal','add_equip','del_equip','inspect','manage_types','delete_report','view_notifications','maint_warn','view_docs','manage_docs','manage_workorders'],
  inspector: ['inspect','maint_warn','view_docs'],
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

