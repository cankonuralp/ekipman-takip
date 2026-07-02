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

/* Şirket bazlı günlük otomatik yedek — HERHANGİ bir kullanıcı o gün ilk girince alınır.
   (Süper admin girmese bile şirket verisi her gün yedeklenir.) */
async function autoBackupCompanyIfNeeded(cid){
  if(!_db || !S.cur || !cid) return;
  try{
    const todayKey=trBackupDayKey();
    const mRef=_db.ref(`${TENANT_ROOT}/backups/_lastAutoDayCompany/${cid}`);
    const mSnap=await mRef.once('value');
    if(mSnap.exists() && mSnap.val()===todayKey) return;
    await backupCompany(cid);
    await mRef.set(todayKey);
    console.log('[Otomatik şirket yedeği]', cid, todayKey);
  }catch(e){}
}

/* Çöp kutusunu günde 1 kez buda: TRASH_DAYS günden eski dosyaları Storage'dan kalıcı sil */
async function purgeTrashIfNeeded(){
  if(!_db || !S.cur?.isSuper) return;
  try{
    const todayKey=trBackupDayKey();
    const ref=_db.ref(`${TENANT_ROOT}/trash`);
    const mSnap=await ref.child('_lastPurgeDay').once('value');
    if(mSnap.exists() && mSnap.val()===todayKey) return;
    const snap=await ref.once('value');
    const cutoff=Date.now()-TRASH_DAYS*86400000;
    const jobs=[];
    if(snap.exists()) snap.forEach(ch=>{
      if(String(ch.key).startsWith('_')) return;
      const v=ch.val()||{};
      if((v.ts||0)<cutoff) jobs.push({key:ch.key, path:v.path});
    });
    for(const j of jobs){
      try{ if(j.path&&_storage) await _storage.ref(j.path).delete(); }catch(e){}
      try{ await ref.child(j.key).remove(); }catch(e){}
    }
    await ref.child('_lastPurgeDay').set(todayKey);
    if(jobs.length) console.log('[Çöp] kalıcı temizlendi:', jobs.length);
  }catch(e){}
}

/* Çöp kutusu ekranı (süper admin): silinen belgeleri listele → geri al / kalıcı sil */
async function openTrashBin(){
  const body=document.getElementById('gmodal-body');
  document.getElementById('gmodal-title').textContent='🗑️ Çöp Kutusu';
  body.innerHTML='<div style="padding:14px;text-align:center;color:var(--txt3)">Yükleniyor…</div>';
  openModal('gmodal');
  const items=[];
  try{
    const snap=await _db.ref(`${TENANT_ROOT}/trash`).once('value');
    if(snap.exists()) snap.forEach(ch=>{ if(!String(ch.key).startsWith('_')) items.push({key:ch.key, ...ch.val()}); });
  }catch(e){}
  items.sort((a,b)=>(b.ts||0)-(a.ts||0));
  const cname=cid=> cid==='_global' ? '🌐 Genel Evraklar' : (S.companies.find(c=>c.id===cid)?.name||cid);
  body.innerHTML= items.length ? `
    <p style="font-size:12px;color:var(--txt2);line-height:1.5;margin-bottom:10px">Silinen belgeler <b>${TRASH_DAYS} gün</b> burada saklanır, sonra kalıcı silinir. Geri alınan belge ilgili yerin <b>"🔁 Kurtarılanlar"</b> klasörüne gider.</p>
    <div style="display:flex;flex-direction:column;gap:6px;max-height:55vh;overflow-y:auto">
    ${items.map(it=>`<div style="display:flex;align-items:center;gap:8px;border:1px solid var(--brd);border-radius:9px;padding:8px 10px">
      <span style="font-size:15px">${it.type==='application/pdf'?'📄':'🖼️'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(it.name)}</div>
        <div style="font-size:10.5px;color:var(--txt3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(cname(it.cid))} · ${safe(it.origin||'')} · ${it.deletedAt||''} · ${safe(it.by||'')}</div>
      </div>
      <button class="doc-mini-btn" title="Geri Al" onclick="restoreTrashDoc('${it.key}')" style="font-size:14px">↩️</button>
      <button class="doc-mini-btn" title="Kalıcı Sil" onclick="purgeTrashDoc('${it.key}')" style="font-size:13px">❌</button>
    </div>`).join('')}
    </div>` : '<div style="padding:18px;text-align:center;color:var(--txt3);font-size:12.5px">Çöp kutusu boş.</div>';
}

/* Çöpten geri al → ilgili yerin "🔁 Kurtarılanlar" klasörüne koy */
async function restoreTrashDoc(key){
  try{
    const ref=_db.ref(`${TENANT_ROOT}/trash/${key}`);
    const snap=await ref.once('value');
    if(!snap.exists()){ toast('⚠️ Kayıt bulunamadı'); return; }
    const it=snap.val();
    const doc={ id:'cd'+Date.now()+Math.random().toString(36).slice(2,5), name:it.name, type:it.type, path:it.path, url:it.url, size:it.size||0, ts:Date.now(), restored:true };
    if(it.cid==='_global'){
      if(!_globalDocs.folders) _globalDocs.folders=[];
      let f=_globalDocs.folders.find(x=>x&&x.name==='🔁 Kurtarılanlar'&&!x.parentId);
      if(!f){ f={id:'gf'+Date.now(), name:'🔁 Kurtarılanlar', docs:[]}; _globalDocs.folders.push(f); }
      if(!Array.isArray(f.docs)) f.docs=[];
      f.docs.unshift(doc);
      await saveGlobalDocs();
      try{ renderGlobalDocs(); }catch(e){}
    } else {
      const fref=_db.ref(companyDataPath(it.cid)+'/companyFolders');
      const fSnap=await fref.get();
      let folders=fSnap.exists()?toArr(fSnap.val()):[];
      let f=folders.find(x=>x&&x.name==='🔁 Kurtarılanlar'&&!x.parentId);
      if(!f){ f={id:'cf'+Date.now()+Math.random().toString(36).slice(2,4), name:'🔁 Kurtarılanlar', docs:[]}; folders.push(f); }
      if(!Array.isArray(f.docs)) f.docs=[];
      f.docs.unshift(doc);
      await fref.set(folders);
    }
    await ref.remove();
    toast('✅ Geri alındı → 🔁 Kurtarılanlar');
    openTrashBin();
  }catch(e){ toast('❌ '+e.message,5000); }
}

/* Çöpten kalıcı sil (dosya Storage'dan da gider) */
async function purgeTrashDoc(key){
  if(!await confirmDialog({title:'Kalıcı Sil',message:'Bu belge KALICI olarak silinecek, bir daha geri alınamaz.',danger:true,okText:'Kalıcı Sil'})) return;
  try{
    const ref=_db.ref(`${TENANT_ROOT}/trash/${key}`);
    const snap=await ref.once('value');
    const it=snap.exists()?snap.val():null;
    try{ if(it&&it.path&&_storage) await _storage.ref(it.path).delete(); }catch(e){}
    await ref.remove();
    toast('🗑️ Kalıcı silindi');
    openTrashBin();
  }catch(e){ toast('❌ '+e.message,5000); }
}

/* Yedekleme yönetim ekranı (süper admin) — katmanlı geri yükleme */
function openBackupManager(){
  const body=document.getElementById('gmodal-body');
  document.getElementById('gmodal-title').textContent='💾 Yedekleme & Geri Yükleme';
  const companyOpts=S.companies.map(c=>`<option value="${c.id}">${safe(c.name)}</option>`).join('');
  body.innerHTML=`
    <p style="font-size:12.5px;color:var(--txt2);line-height:1.5;margin-bottom:14px">
      Sistem her gün <b>03:00</b> sonrası ilk girişte otomatik yedeklenir (son ${MAX_BACKUPS} yedek saklanır); ayrıca her şirketin verisi, o şirkete o gün ilk giren kullanıcıyla günlük yedeklenir. Silinen <b>belgeler (dosyalar)</b> ${TRASH_DAYS} gün çöp kutusunda tutulur — yedeğe dönünce dosyalar da yerinde olur.
    </p>
    <p class="sec-label" style="margin-bottom:8px">Manuel Yedek & Çöp</p>
    <div class="ed-card" style="margin-bottom:14px">
      <button class="btn btn-primary btn-full btn-sm" style="margin-bottom:8px" onclick="manualBackupSystem()">📦 Şimdi Tam Yedek Al</button>
      <button class="btn btn-secondary btn-full btn-sm" onclick="openTrashBin()">🗑️ Çöp Kutusu (silinen belgeler)</button>
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

