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
  const canCreate = canDo('manage_workorders'); // iş emri oluşturma yetkisi
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
    ${(w.status==='open'&&w.revisionNote)?`<span style="font-size:10.5px;font-weight:700;color:var(--rtxt);background:var(--rbg);padding:3px 8px;border-radius:20px;white-space:nowrap">🔄 Revize</span>`:woStatusBadge(w.status)}
  </div>`;
}

/* Yeni iş emri oluştur */
function openAddWorkOrder(){
  if(!canDo('manage_workorders')){ toast('🚫 İş emri oluşturma yetkiniz yok'); return; }
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
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" style="flex:1" onclick="woPickPhoto('new','camera')">📷 Kameradan Çek</button>
        <button class="btn btn-secondary btn-sm" style="flex:1" onclick="woPickPhoto('new','device')">🖼️ Cihazdan Yükle</button>
      </div>
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
    ${(w.revisionNote&&w.status==='open')?`<div style="font-size:13px;color:var(--rtxt);background:var(--rbg);border-radius:10px;padding:10px 12px;margin-bottom:10px;white-space:pre-wrap"><b>🔄 Revize istendi:</b>\n${safe(w.revisionNote)}<div style="font-size:11px;color:var(--txt3);margin-top:6px">${safe(w.revisedBy||'')} · ${w.revisedAt||''}</div></div>`:''}
    ${(w.status==='done'||w.status==='approved')?`<div class="divider"></div>
      <p class="sec-label" style="margin-top:6px">✅ Tamamlama</p>
      <div style="font-size:12px;color:var(--txt3);margin-bottom:6px">${safe(w.doneBy||'')} · ${w.doneAt||''}</div>
      <div style="font-size:14px;color:var(--txt);white-space:pre-wrap;background:var(--gbg);border-radius:10px;padding:12px;margin-bottom:10px">${safe(w.doneNote||'—')}</div>
      ${(w.donePhotos||[]).length?`<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">${w.donePhotos.map(u=>`<img src="${u}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="window.open('${u}','_blank')"/>`).join('')}</div>`:''}
      ${w.status==='approved'?`<div style="font-size:12px;color:var(--gtxt);font-weight:600">👍 ${safe(w.approvedBy||'')} onayladı · ${w.approvedAt||''}</div>`:''}`:''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
      ${(w.status==='open'&&(isAssignee||isOwner))?`<button class="btn btn-primary" style="flex:1" onclick="openCompleteWorkOrder('${w.id}')">✅ İş Tamamlandı</button>`:''}
      ${(w.status==='done'&&isOwner)?`<button class="btn btn-primary" style="flex:1" onclick="approveWorkOrder('${w.id}')">👍 Onayla</button>
      <button class="btn btn-secondary" style="flex:1" onclick="reviseWorkOrder('${w.id}')">🔄 Revizeye Gönder</button>`:''}
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
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" style="flex:1" onclick="woPickPhoto('done','camera')">📷 Kameradan Çek</button>
        <button class="btn btn-secondary btn-sm" style="flex:1" onclick="woPickPhoto('done','device')">🖼️ Cihazdan Yükle</button>
      </div>
    </div>
    <button class="btn btn-primary btn-full" onclick="saveCompleteWorkOrder('${id}')">✅ Tamamla</button>`;
}
async function saveCompleteWorkOrder(id){
  const w=(S.workOrders||[]).find(x=>x.id===id); if(!w) return;
  const note=(document.getElementById('wo-done-note')?.value||'').trim();
  if(!note){ toast('⚠️ Tamamlama notu yazın'); return; }
  w.status='done'; w.doneNote=note; w.donePhotos=_woDone.photos||[];
  w.doneBy=S.cur?.fullname||S.cur?.username||'—'; w.doneById=S.cur?.id||null; w.doneAt=nowStr(); w.doneTs=Date.now();
  // Tamamlayan, işi OLUŞTURAN (veya admin) ise onay adımı atlanır → direkt onaylı
  const selfClose = w.byId===S.cur?.id || isAdmin() || S.cur?.isSuper;
  if(selfClose){ w.status='approved'; w.approvedBy=w.doneBy; w.approvedAt=w.doneAt; w.approvedTs=w.doneTs; }
  try{
    await save();
    closeModal('modal-workorder'); _woDone=null;
    renderWorkOrders();
    if(selfClose){
      toast('✅ İş emri tamamlandı olarak kapatıldı');
      const targets=(w.assignees||[]).filter(uid=>uid!==S.cur?.id);
      if(targets.length){
        await saveNotifSafe({ id:'n'+Date.now(), type:'wo_approved', woId:w.id, toIds:targets,
          equipName:'✅ İş Emri Kapatıldı', mahalName:w.title, by:w.doneBy,
          note:`✅ "${w.title}" iş emri ${w.doneBy} tarafından tamamlandı olarak kapatıldı.`, date:nowStr(), ts:Date.now(), readBy:[] });
      }
    } else {
      toast('✅ İş tamamlandı — yönetici onayı bekleniyor');
      if(w.byId){
        await saveNotifSafe({ id:'n'+Date.now(), type:'wo_done', woId:w.id, toIds:[w.byId],
          equipName:'✅ İş Tamamlandı', mahalName:w.title, by:w.doneBy,
          note:`✅ "${w.title}" işi tamamlandı (${w.doneBy}) — onayınızı bekliyor.`, date:nowStr(), ts:Date.now(), readBy:[] });
      }
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
/* İşi revizeye gönder (oluşturan/yönetici beğenmezse) → tekrar "açık"a döner, atanana bildirim */
async function reviseWorkOrder(id){
  const w=(S.workOrders||[]).find(x=>x.id===id); if(!w) return;
  const note=await promptDialog({title:'🔄 Revizeye Gönder',message:'Neyin düzeltilmesi gerekiyor? (görevli kişiye iletilir)',multiline:true,okText:'Gönder',placeholder:'Örn: fotoğraf net değil, tekrar çekin…'});
  if(note===null) return;               // iptal
  w.status='open';                       // tekrar açık — görevli yeniden tamamlar
  w.revisionNote=(note||'').trim();
  w.revisedBy=S.cur?.fullname||S.cur?.username||'—'; w.revisedAt=nowStr(); w.revisedTs=Date.now();
  try{
    await save();
    closeModal('modal-workorder'); renderWorkOrders();
    toast('🔄 Revizeye gönderildi');
    const targets=(w.assignees||[]).filter(uid=>uid!==S.cur?.id);
    if(targets.length){
      await saveNotifSafe({ id:'n'+Date.now(), type:'wo_revise', woId:w.id, toIds:targets,
        equipName:'🔄 Revize İstendi', mahalName:w.title, by:w.revisedBy,
        note:`🔄 "${w.title}" işi revizeye gönderildi.${w.revisionNote?' Not: '+w.revisionNote:''}`, date:nowStr(), ts:Date.now(), readBy:[] });
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
function woPickPhoto(target, mode){
  _woPhotoTarget=target;
  const inp=document.getElementById('wo-photo-input'); if(!inp) return;
  // Kamera → capture ile doğrudan kamera; Cihazdan → capture yok (galeri/dosya)
  if(mode==='camera') inp.setAttribute('capture','environment'); else inp.removeAttribute('capture');
  inp.value=''; inp.click();
}
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

