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

