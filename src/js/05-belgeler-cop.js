/* ── ŞİRKET BELGE AĞACI (ana sayfa sağ) ──
   Otomatik dosyalama: ekipmana belge eklenince Mahal>Ekipman>Tür yapısında saklanır
   + manuel klasör/belge */
function renderCompanyDocs(){
  const wrap=document.getElementById('company-docs-wrap');
  if(!wrap) return;
  // Yetki: belgeleri görme izni yoksa panel hiç gösterilmez
  if(!canDo('view_docs')){ wrap.innerHTML=''; return; }
  const canManage=canDo('manage_docs');
  const selCount=_docSelected.size;
  wrap.innerHTML=`
    <div style="background:var(--bg);border:1px solid var(--brd);border-radius:14px;overflow:hidden">
      <div style="padding:13px 15px;border-bottom:1px solid var(--brd);display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span style="font-size:13.5px;font-weight:700;color:var(--txt)">📁 Belgeler</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${canManage?`<button class="doc-mini-btn" onclick="toggleDocSelectMode()" title="Çoklu seç / taşı" style="font-size:14px;${_docSelectMode?'background:var(--accent);color:#fff;border-radius:6px':''}">☑️</button>
          <button class="doc-mini-btn" onclick="addCompanyFolder()" title="Klasör Ekle" style="font-size:15px">➕</button>`:''}
        </div>
      </div>
      <div style="padding:8px 10px 4px">
        <input class="form-input" style="height:34px;font-size:12.5px" placeholder="🔍 Belge / klasör ara…" value="${safe(_docSearch)}" oninput="_docSearch=this.value;updateDocsBodyDebounced()"/>
      </div>
      ${(_docSelectMode&&selCount)?`<div style="display:flex;gap:6px;padding:0 10px 8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" style="flex:1" onclick="moveSelectedDocs()">➡️ Taşı (${selCount})</button>
        <button class="btn btn-danger btn-sm" style="flex:1" onclick="deleteSelectedDocs()">🗑️ Sil (${selCount})</button>
        <button class="btn btn-secondary btn-sm" onclick="_docSelected.clear();renderCompanyDocs()">✖</button>
      </div>`:''}
      <div id="company-docs-body" style="padding:4px 8px 8px;max-height:56vh;overflow-y:auto">
        ${docsBodyHTML()}
      </div>
    </div>`;
}
function docsBodyHTML(){
  const q=(_docSearch||'').trim();
  const canManage=canDo('manage_docs');
  if(q) return renderDocSearchResults(q,canManage);
  const tree=buildCompanyDocTree();
  return tree.length?tree.map(node=>renderDocNode(node,0)).join(''):'<div style="padding:20px;text-align:center;color:var(--txt3);font-size:12px">Henüz belge yok.<br>Ekipmanlara belge ekleyince otomatik dosyalanır.</div>';
}
let _docsRenderTimer=null;
function updateDocsBodyDebounced(){ clearTimeout(_docsRenderTimer); _docsRenderTimer=setTimeout(()=>{ const b=document.getElementById('company-docs-body'); if(b) b.innerHTML=docsBodyHTML(); },180); }

/* Türkçe uyumlu küçük harf (İ/ı sorunu için) */
const trLow=s=>String(s||'').toLocaleLowerCase('tr');

/* Arama sonuçları — belge ADI + klasör/mahal/küme/ekipman ADI eşleşmesi */
function renderDocSearchResults(q, canManage){
  q=trLow(q);
  const rows=[];
  // Otomatik taraf: mahal/küme/ekipman adı eşleşirse o ekipmanın TÜM belgeleri; yoksa adı eşleşen belgeler
  (S.mahals||[]).forEach(m=>{
    (S.equips||[]).filter(e=>e.mahalId===m.id).forEach(e=>{
      const loc=m.name+(e.cluster?(' › '+e.cluster):'')+' › '+e.name;
      const ctxMatch=trLow(m.name).includes(q)||trLow(e.cluster).includes(q)||trLow(e.name).includes(q);
      (e.documents||[]).forEach(d=>{ if(ctxMatch||trLow(d.name).includes(q)) rows.push({d, loc, manual:false, equipId:e.id}); });
    });
  });
  // Manuel taraf: klasör yolu eşleşirse klasördeki TÜM belgeler; yoksa adı eşleşen belgeler
  (S.companyFolders||[]).forEach(f=>{
    const path=companyFolderPath(f);
    const ctxMatch=trLow(path).includes(q);
    (f.docs||[]).forEach(d=>{ if(ctxMatch||trLow(d.name).includes(q)) rows.push({d, loc:path, folderId:f.id, manual:true}); });
  });
  // Adı eşleşen MANUEL KLASÖRLER (tıklayınca ağaçta açılır)
  const folderHits=(S.companyFolders||[]).filter(f=>trLow(f.name).includes(q));
  if(!rows.length && !folderHits.length) return '<div style="padding:18px;text-align:center;color:var(--txt3);font-size:12px">Eşleşen belge veya klasör yok.</div>';
  let html='';
  folderHits.forEach(f=>{
    html+=`<div class="doc-tree-row" style="padding-left:9px" onclick="openFolderFromSearch('${f.id}')">
      <span style="font-size:15px">📁</span>
      <span style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(f.name)}</div>
        <div style="font-size:10.5px;color:var(--txt3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(companyFolderPath(f))} · ${(f.docs||[]).length} belge — tıkla, ağaçta aç</div>
      </span>
    </div>`;
  });
  html+=rows.map(r=>`<div class="doc-tree-row" style="padding-left:9px">
    <span style="font-size:13px">${r.d.type==='application/pdf'?'📄':'🖼️'}</span>
    <span style="flex:1;min-width:0;cursor:pointer" onclick="window.open('${r.d.url}','_blank')">
      <div style="font-size:12.5px;color:var(--txt2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(r.d.name)}</div>
      <div style="font-size:10.5px;color:var(--txt3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(r.loc)}</div>
    </span>
    ${(r.manual&&canManage)?`<button class="doc-mini-btn" onclick="moveCompanyDoc('${r.folderId}','${r.d.id}')" title="Taşı" style="font-size:12px">➡️</button>
    <button class="doc-mini-btn" onclick="deleteCompanyDoc('${r.folderId}','${r.d.id}')" title="Sil" style="font-size:12px">🗑️</button>`:''}
    ${(!r.manual&&canManage)?`<button class="doc-mini-btn" onclick="deleteAutoDoc('${r.equipId}','${r.d.id}')" title="Sil" style="font-size:12px">🗑️</button>`:''}
  </div>`).join('');
  return html;
}

/* Arama sonucundaki klasöre tıklayınca: aramayı temizle, klasörü (ve üstlerini) ağaçta aç */
function openFolderFromSearch(fid){
  _docSearch='';
  let f=(S.companyFolders||[]).find(x=>x.id===fid), guard=0;
  while(f && guard++<15){ _docTreeOpen['man_'+f.id]=true; f=(S.companyFolders||[]).find(x=>x.id===f.parentId); }
  renderCompanyDocs();
}

/* Belge ağacını kur: otomatik (mahal>ekipman) + manuel klasörler */
let _autoClusterReg={}; // küme düğümü id → {mahalId, name} (onclick'e küme adı gömmemek için)
function buildCompanyDocTree(){
  const nodes=[];
  _autoClusterReg={};
  // Otomatik: her mahal → ekipmanları → belgeleri
  (S.mahals||[]).forEach(m=>{
    const equipsWithDocs=(S.equips||[]).filter(e=>e.mahalId===m.id && (e.documents||[]).length>0);
    if(!equipsWithDocs.length) return;
    const mahalNode={ id:'auto_m_'+m.id, name:m.name, icon:'🏢', auto:true, mahalId:m.id, children:[], open:_docTreeOpen['auto_m_'+m.id] };
    const mkEqNode=e=>({ id:'auto_e_'+e.id, name:e.name, icon:'🔧', auto:true, equipId:e.id, docs:(e.documents||[]).map(d=>({...d, _equipId:e.id})), open:_docTreeOpen['auto_e_'+e.id] });
    // Küme klasörleri (varsa): Mahal → Küme → Ekipman → belgeler
    const cmap={};
    equipsWithDocs.filter(e=>e.cluster).forEach(e=>{
      const cname=e.cluster;
      if(!cmap[cname]){
        const cid='auto_c_'+m.id+'_'+String(cname).replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ_-]/g,'_');
        cmap[cname]={ id:cid, name:cname, icon:'🗂️', auto:true, clusterKey:cid, children:[], open:_docTreeOpen[cid] };
        _autoClusterReg[cid]={ mahalId:m.id, name:cname };
        mahalNode.children.push(cmap[cname]);
      }
      cmap[cname].children.push(mkEqNode(e));
    });
    // Kümesiz ekipmanlar direkt mahal klasörünün altına
    equipsWithDocs.filter(e=>!e.cluster).forEach(e=>{ mahalNode.children.push(mkEqNode(e)); });
    nodes.push(mahalNode);
  });
  // Manuel klasörler (iç içe / alt klasör destekli — parentId ile)
  const manuals=(S.companyFolders||[]);
  const buildManual=(parentId)=>manuals
    .filter(f=>(f.parentId||null)===(parentId||null))
    .map(f=>({ id:'man_'+f.id, name:f.name, icon:'📁', manual:true, folderId:f.id,
      docs:f.docs||[], children:buildManual(f.id), open:_docTreeOpen['man_'+f.id] }));
  buildManual(null).forEach(n=>nodes.push(n));
  return nodes;
}
/* Klasörün tam yolu (Ana › Alt) — taşıma seçicisinde okunur etiket */
function companyFolderPath(f){
  let parts=[f.name], p=f.parentId, guard=0;
  while(p && guard++<12){ const pf=(S.companyFolders||[]).find(x=>x.id===p); if(!pf) break; parts.unshift(pf.name); p=pf.parentId; }
  return parts.join(' › ');
}

function renderDocNode(node, depth){
  const open=!!node.open;
  const pad=depth*16;
  const canManage=canDo('manage_docs');
  let html=`
    <div class="doc-tree-folder">
      <div class="doc-tree-row" style="padding-left:${9+pad}px" onclick="toggleDocNode('${node.id}')">
        <span class="doc-tree-chevron ${open?'open':''}">▶</span>
        <span style="font-size:15px">${open?'📂':(node.icon||'📁')}</span>
        <span style="flex:1;font-size:12.5px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(node.name)}</span>
        ${(node.manual&&canManage)?`<button class="doc-mini-btn" onclick="event.stopPropagation();addCompanyFolder('${node.folderId}')" title="Alt Klasör Ekle" style="font-size:13px">📁➕</button>
        <button class="doc-mini-btn" onclick="event.stopPropagation();renameCompanyFolder('${node.folderId}')" title="Yeniden Adlandır" style="font-size:13px">✏️</button>
        <button class="doc-mini-btn" onclick="event.stopPropagation();uploadToCompanyFolder('${node.folderId}')" title="Belge Yükle" style="font-size:13px">⬆️</button>
        <button class="doc-mini-btn" onclick="event.stopPropagation();deleteCompanyFolder('${node.folderId}')" title="Sil" style="font-size:13px">🗑️</button>`:''}
        ${(node.auto&&node.equipId&&canManage)?`<button class="doc-mini-btn" onclick="event.stopPropagation();deleteAutoEquipDocs('${node.equipId}')" title="Bu ekipmanın tüm belgelerini sil" style="font-size:13px">🗑️</button>`:''}
        ${(node.auto&&node.clusterKey&&canManage)?`<button class="doc-mini-btn" onclick="event.stopPropagation();deleteAutoClusterDocs('${node.clusterKey}')" title="Bu kümedeki tüm ekipman belgelerini sil" style="font-size:13px">🗑️</button>`:''}
        ${(node.auto&&node.mahalId&&canManage)?`<button class="doc-mini-btn" onclick="event.stopPropagation();deleteAutoMahalDocs('${node.mahalId}')" title="Bu mahaldeki tüm ekipman belgelerini sil" style="font-size:13px">🗑️</button>`:''}
      </div>`;
  if(open){
    // Alt klasörler (ekipmanlar / manuel alt klasörler)
    if(node.children){ node.children.forEach(ch=>{ html+=renderDocNode(ch, depth+1); }); }
    // Belgeler
    if(node.docs){
      node.docs.forEach(d=>{
        const selKey=node.folderId+'::'+d.id;
        const selectable=node.manual&&_docSelectMode&&canManage;
        html+=`<div class="doc-tree-row" style="padding-left:${9+pad+20}px">
          ${selectable?`<input type="checkbox" class="doc-sel" ${_docSelected.has(selKey)?'checked':''} onclick="event.stopPropagation();toggleDocSelect('${node.folderId}','${d.id}')" style="width:16px;height:16px;flex-shrink:0"/>`:`<span style="font-size:13px">${d.type==='application/pdf'?'📄':'🖼️'}</span>`}
          <span style="flex:1;font-size:12px;color:var(--txt2);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" onclick="window.open('${d.url}','_blank')">${safe(d.name)}</span>
          ${(node.manual&&canManage&&!_docSelectMode)?`<button class="doc-mini-btn" onclick="moveCompanyDoc('${node.folderId}','${d.id}')" title="Başka klasöre taşı" style="font-size:12px">➡️</button>
          <button class="doc-mini-btn" onclick="deleteCompanyDoc('${node.folderId}','${d.id}')" title="Sil" style="font-size:12px">🗑️</button>`:''}
          ${(node.auto&&d._equipId&&canManage)?`<button class="doc-mini-btn" onclick="deleteAutoDoc('${d._equipId}','${d.id}')" title="Sil" style="font-size:12px">🗑️</button>`:''}
        </div>`;
      });
    }
    // Manuel klasöre net "Belge Ekle" butonu (yetki varsa)
    if(node.manual&&canManage&&!_docSelectMode){
      html+=`<div style="padding:4px 0 4px ${9+pad+20}px"><button class="btn btn-secondary btn-sm" style="width:calc(100% - 10px);justify-content:center" onclick="uploadToCompanyFolder('${node.folderId}')">📎 Belge Ekle</button></div>`;
    }
  }
  html+=`</div>`;
  return html;
}

/* ── Otomatik (Mahal→Ekipman) düğümlerinden silme ──
   Belge ekipmanın kaydından silinir (ekipmanın kendisi silinmez); dosya 30 gün çöpte kalır. */
async function deleteAutoDoc(equipId, docId){
  if(!canDo('manage_docs')){ toast('🚫 Belge yönetim yetkiniz yok'); return; }
  const e=equipById(equipId); if(!e) return;
  const d=(e.documents||[]).find(x=>x.id===docId); if(!d) return;
  if(!await confirmDialog({title:'Belgeyi Sil',message:`"${safe(d.name)}" ekipmandan silinecek (30 gün çöpte geri alınabilir).`,danger:true,okText:'Sil'})) return;
  await trashDoc(d, 'Ekipman: '+(e.name||''));
  e.documents=(e.documents||[]).filter(x=>x.id!==docId);
  try{ await save(); renderCompanyDocs(); toast('🗑️ Silindi'); }catch(err){ toast('❌ '+err.message,5000); }
}

/* Bir ekipmanın TÜM belgelerini sil (klasörü boşalır → ağaçtan otomatik kalkar) */
async function deleteAutoEquipDocs(equipId){
  if(!canDo('manage_docs')){ toast('🚫 Belge yönetim yetkiniz yok'); return; }
  const e=equipById(equipId); if(!e) return;
  const docs=(e.documents||[]);
  if(!docs.length){ toast('Bu ekipmanda belge yok'); return; }
  if(!await confirmDialog({title:'Ekipman Belgelerini Sil',message:`"${safe(e.name)}" ekipmanındaki ${docs.length} belge silinecek (ekipman SİLİNMEZ; belgeler 30 gün çöpte geri alınabilir).`,danger:true,okText:'Sil'})) return;
  for(const d of docs){ await trashDoc(d, 'Ekipman: '+(e.name||'')); }
  e.documents=[];
  try{ await save(); renderCompanyDocs(); toast(`🗑️ ${docs.length} belge silindi`); }catch(err){ toast('❌ '+err.message,5000); }
}

/* Bir kümedeki TÜM ekipman belgelerini sil (küme ve ekipmanlar SİLİNMEZ) */
async function deleteAutoClusterDocs(clusterKey){
  if(!canDo('manage_docs')){ toast('🚫 Belge yönetim yetkiniz yok'); return; }
  const reg=_autoClusterReg[clusterKey]; if(!reg) return;
  const eqs=(S.equips||[]).filter(e=>e.mahalId===reg.mahalId && e.cluster===reg.name && (e.documents||[]).length>0);
  const total=eqs.reduce((n,e)=>n+(e.documents||[]).length,0);
  if(!total){ toast('Bu kümede belge yok'); return; }
  if(!await confirmDialog({title:'Küme Belgelerini Sil',message:`"${safe(reg.name)}" kümesindeki ${eqs.length} ekipmana ait ${total} belge silinecek (küme ve ekipmanlar SİLİNMEZ; belgeler 30 gün çöpte geri alınabilir).`,danger:true,okText:'Sil'})) return;
  for(const e of eqs){
    for(const d of (e.documents||[])){ await trashDoc(d, 'Ekipman: '+(e.name||'')); }
    e.documents=[];
  }
  try{ await save(); renderCompanyDocs(); toast(`🗑️ ${total} belge silindi`); }catch(err){ toast('❌ '+err.message,5000); }
}

/* Bir mahaldeki TÜM ekipman belgelerini sil (mahal ve ekipmanlar SİLİNMEZ) */
async function deleteAutoMahalDocs(mahalId){
  if(!canDo('manage_docs')){ toast('🚫 Belge yönetim yetkiniz yok'); return; }
  const m=mahalById(mahalId); if(!m) return;
  const eqs=(S.equips||[]).filter(e=>e.mahalId===mahalId && (e.documents||[]).length>0);
  const total=eqs.reduce((n,e)=>n+(e.documents||[]).length,0);
  if(!total){ toast('Bu mahalde belge yok'); return; }
  if(!await confirmDialog({title:'Mahal Belgelerini Sil',message:`"${safe(m.name)}" mahalindeki ${eqs.length} ekipmana ait ${total} belge silinecek (mahal ve ekipmanlar SİLİNMEZ; belgeler 30 gün çöpte geri alınabilir).`,danger:true,okText:'Sil'})) return;
  for(const e of eqs){
    for(const d of (e.documents||[])){ await trashDoc(d, 'Ekipman: '+(e.name||'')); }
    e.documents=[];
  }
  try{ await save(); renderCompanyDocs(); toast(`🗑️ ${total} belge silindi`); }catch(err){ toast('❌ '+err.message,5000); }
}

function toggleDocNode(id){ _docTreeOpen[id]=!_docTreeOpen[id]; renderCompanyDocs(); }
function toggleDocSelectMode(){ _docSelectMode=!_docSelectMode; _docSelected.clear(); renderCompanyDocs(); }
function toggleDocSelect(fid, docId){ const k=fid+'::'+docId; if(_docSelected.has(k)) _docSelected.delete(k); else _docSelected.add(k); renderCompanyDocs(); }

/* Seçili belgeleri toplu taşı */
async function moveSelectedDocs(){
  if(!canDo('manage_docs')) return;
  if(!_docSelected.size){ toast('⚠️ Belge seçin'); return; }
  const targets=(S.companyFolders||[]).map(x=>({ id:x.id, name:companyFolderPath(x) }));
  if(!targets.length){ toast('⚠️ Hedef klasör yok'); return; }
  const toId=await pickFolderDialog('📁 Seçilenler hangi klasöre taşınsın?', targets);
  if(!toId) return;
  const to=(S.companyFolders||[]).find(x=>x.id===toId); if(!to) return;
  if(!to.docs) to.docs=[];
  let moved=0;
  _docSelected.forEach(k=>{
    const [fid,docId]=k.split('::');
    if(fid===toId) return; // aynı klasöre taşıma
    const from=(S.companyFolders||[]).find(x=>x.id===fid); if(!from) return;
    const doc=(from.docs||[]).find(d=>d.id===docId); if(!doc) return;
    from.docs=from.docs.filter(d=>d.id!==docId);
    to.docs.unshift(doc); moved++;
  });
  _docSelected.clear(); _docSelectMode=false;
  try{ await save(); renderCompanyDocs(); toast(`✅ ${moved} belge taşındı: ${to.name}`); }
  catch(e){ toast('❌ '+e.message,5000); }
}
/* ── ÇÖP KUTUSU: silinen belgeler Storage'dan HEMEN silinmez ──
   Kayıt takipet/trash altına düşer, TRASH_DAYS gün sonra otomatik temizlenir.
   Böylece yanlış silinen dosya süper adminden geri alınabilir. */
const TRASH_DAYS=30;
async function trashDoc(d, origin, cidOverride){
  if(!d||!d.path||!_db) return;
  // Genel Evraklar'dan gönderilen kopyalar dosyanın SAHİBİ değil — dosyaya dokunma,
  // yoksa 30 gün sonra kalıcı temizlik orijinali ve diğer şirketlerin kopyalarını öldürür.
  if(d.fromGlobal) return;
  try{
    await _db.ref(`${TENANT_ROOT}/trash`).push({
      name:d.name||'—', type:d.type||'', path:d.path, url:d.url||'', size:d.size||0,
      cid:cidOverride||S.activeCompanyId||'_global', origin:origin||'',
      deletedAt:nowStr(), ts:Date.now(), by:S.cur?.fullname||S.cur?.username||'—'
    });
    // Depolama barı doğru kalsın: çöpe giden dosya hâlâ Storage'da yer kaplıyor
    const cid=cidOverride||S.activeCompanyId||'_global';
    if(cid===S.activeCompanyId) _companyTrashBytes+=(d.size||0);
  }catch(e){ console.warn('trash:', e.message); }
}

/* Seçili belgeleri toplu sil */
async function deleteSelectedDocs(){
  if(!canDo('manage_docs')) return;
  if(!_docSelected.size){ toast('⚠️ Belge seçin'); return; }
  if(!await confirmDialog({title:'Belgeleri Sil',message:`${_docSelected.size} belge silinecek (30 gün çöp kutusunda geri alınabilir).`,danger:true,okText:'Sil'})) return;
  let del=0;
  for(const k of Array.from(_docSelected)){
    const [fid,docId]=k.split('::');
    const from=(S.companyFolders||[]).find(x=>x.id===fid); if(!from) continue;
    const doc=(from.docs||[]).find(d=>d.id===docId); if(!doc) continue;
    await trashDoc(doc, 'Toplu silme');
    from.docs=from.docs.filter(d=>d.id!==docId); del++;
  }
  _docSelected.clear(); _docSelectMode=false;
  try{ await save(); renderCompanyDocs(); toast(`🗑️ ${del} belge silindi`); }
  catch(e){ toast('❌ '+e.message,5000); }
}

async function addCompanyFolder(parentId){
  if(!canDo('manage_docs')){ toast('🚫 Belge yönetim yetkiniz yok'); return; }
  const name=await promptDialog({title: parentId?'Yeni Alt Klasör':'Yeni Klasör', message:'Klasör adı:', placeholder:'örn: Genel Belgeler', okText:'Oluştur'});
  if(name===null||!name.trim()) return;
  if(!S.companyFolders) S.companyFolders=[];
  const nf={ id:'cf'+Date.now(), name:name.trim(), docs:[] };
  if(parentId) nf.parentId=parentId;
  S.companyFolders.push(nf);
  if(parentId) _docTreeOpen['man_'+parentId]=true; // ebeveyni aç ki yeni alt klasör görünsün
  try{ await save(); renderCompanyDocs(); toast('✅ Klasör oluşturuldu'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

async function deleteCompanyFolder(fid){
  const f=(S.companyFolders||[]).find(x=>x.id===fid); if(!f) return;
  // Alt klasörleri özyinelemeli topla
  const toDelete=[]; const collect=(id)=>{ toDelete.push(id); (S.companyFolders||[]).filter(x=>x.parentId===id).forEach(c=>collect(c.id)); };
  collect(fid);
  const bucket=(S.companyFolders||[]).filter(x=>toDelete.includes(x.id));
  const docCount=bucket.reduce((n,x)=>n+(x.docs||[]).length,0);
  const subCount=toDelete.length-1;
  if(!await confirmDialog({title:'Klasörü Sil',message:`"${safe(f.name)}"${subCount?` ve ${subCount} alt klasör`:''} + içindeki ${docCount} belge silinecek (belgeler 30 gün çöpte geri alınabilir).`,danger:true,okText:'Sil'})) return;
  for(const x of bucket){ for(const d of (x.docs||[])){ await trashDoc(d, 'Klasör: '+(x.name||'')); } }
  S.companyFolders=S.companyFolders.filter(x=>!toDelete.includes(x.id));
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
  const targets=(S.companyFolders||[]).filter(x=>x.id!==fromFid).map(x=>({ id:x.id, name:companyFolderPath(x) }));
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
  if(!canDo('manage_docs')){ toast('🚫 Belge yönetim yetkiniz yok'); return; }
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
  if(!await confirmDialog({title:'Belgeyi Sil',message:`"${safe(d.name)}" silinecek (30 gün çöpte geri alınabilir).`,danger:true,okText:'Sil'})) return;
  await trashDoc(d, 'Klasör: '+(f.name||''));
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
  wrap.innerHTML=`
    <div style="background:var(--bg);border:1px solid var(--brd);border-radius:14px;overflow:hidden">
      <div style="padding:13px 16px;border-bottom:1px solid var(--brd);display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:13.5px;font-weight:700;color:var(--txt)">📁 Genel Evraklar</span>
        <button class="doc-mini-btn" onclick="addGlobalFolder()" title="Klasör Ekle" style="font-size:16px">➕</button>
      </div>
      <div style="padding:8px 10px 4px">
        <input class="form-input" style="height:34px;font-size:12.5px" placeholder="🔍 Belge / klasör ara…" value="${safe(_gdocSearch)}" oninput="_gdocSearch=this.value;updateGdocsBodyDebounced()"/>
      </div>
      <div id="global-docs-body" style="padding:4px 8px 8px">
        ${gdocsBodyHTML()}
      </div>
    </div>`;
}
function gdocsBodyHTML(){
  const q=(_gdocSearch||'').trim();
  if(q) return renderGlobalSearchResults(q);
  const roots=(_globalDocs.folders||[]).filter(f=>!f.parentId);
  return roots.length?roots.map(f=>renderGlobalFolder(f,0)).join(''):'<div style="padding:18px;text-align:center;color:var(--txt3);font-size:12.5px">Henüz klasör yok. ➕ ile ekleyin.</div>';
}
let _gdocsRenderTimer=null;
function updateGdocsBodyDebounced(){ clearTimeout(_gdocsRenderTimer); _gdocsRenderTimer=setTimeout(()=>{ const b=document.getElementById('global-docs-body'); if(b) b.innerHTML=gdocsBodyHTML(); },180); }

/* Genel evrak klasörünün tam yolu */
function globalFolderPath(f){
  let parts=[f.name], p=f.parentId, guard=0;
  while(p && guard++<12){ const pf=(_globalDocs.folders||[]).find(x=>x.id===p); if(!pf) break; parts.unshift(pf.name); p=pf.parentId; }
  return parts.join(' › ');
}
/* Genel evrak arama sonuçları — belge ADI + klasör ADI eşleşmesi */
function renderGlobalSearchResults(q){
  q=trLow(q);
  const rows=[];
  (_globalDocs.folders||[]).forEach(f=>{
    const path=globalFolderPath(f);
    const ctxMatch=trLow(path).includes(q);
    (f.docs||[]).forEach(d=>{ if(ctxMatch||trLow(d.name).includes(q)) rows.push({d, f}); });
  });
  const folderHits=(_globalDocs.folders||[]).filter(f=>trLow(f.name).includes(q));
  if(!rows.length && !folderHits.length) return '<div style="padding:18px;text-align:center;color:var(--txt3);font-size:12px">Eşleşen belge veya klasör yok.</div>';
  let html='';
  folderHits.forEach(f=>{
    html+=`<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px;cursor:pointer" onclick="openGlobalFolderFromSearch('${f.id}')">
      <span style="font-size:15px">📁</span>
      <span style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(f.name)}</div>
        <div style="font-size:10.5px;color:var(--txt3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(globalFolderPath(f))} · ${(f.docs||[]).length} belge — tıkla, aç</div>
      </span>
    </div>`;
  });
  html+=rows.map(r=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px">
    <span style="font-size:14px">${r.d.type==='application/pdf'?'📄':'🖼️'}</span>
    <span style="flex:1;min-width:0;cursor:pointer" onclick="window.open('${r.d.url}','_blank')">
      <div style="font-size:12.5px;color:var(--txt2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(r.d.name)}</div>
      <div style="font-size:10.5px;color:var(--txt3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(globalFolderPath(r.f))}</div>
    </span>
    <button class="doc-mini-btn" onclick="sendGlobalDocToCompany('${r.f.id}','${r.d.id}')" title="Şirkete Gönder" style="font-size:13px">📤</button>
  </div>`).join('');
  return html;
}

/* Genel evrak aramasından klasöre git: aramayı temizle, klasörü (ve üstlerini) aç */
function openGlobalFolderFromSearch(fid){
  _gdocSearch='';
  let f=(_globalDocs.folders||[]).find(x=>x.id===fid), guard=0;
  while(f && guard++<15){ _globalDocOpen[f.id]=true; f=(_globalDocs.folders||[]).find(x=>x.id===f.parentId); }
  renderGlobalDocs();
}

function renderGlobalFolder(f, depth){
  depth=depth||0;
  const open=!!_globalDocOpen[f.id];
  const docs=f.docs||[];
  const kids=(_globalDocs.folders||[]).filter(x=>x.parentId===f.id);
  const pad=30+depth*16;
  return `
    <div style="margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:8px;padding:9px 10px 9px ${10+depth*16}px;border-radius:8px;cursor:pointer;background:${open?'var(--bg2)':'transparent'}" onclick="toggleGlobalFolder('${f.id}')">
        <span style="font-size:13px;color:var(--txt3);display:inline-block;transform:rotate(${open?'90':'0'}deg);transition:transform .15s">▶</span>
        <span style="font-size:16px">${open?'📂':'📁'}</span>
        <span style="flex:1;font-size:13px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(f.name)}</span>
        <span style="font-size:11px;color:var(--txt3)">${docs.length}</span>
        <button class="doc-mini-btn" onclick="event.stopPropagation();addGlobalFolder('${f.id}')" title="Alt Klasör Ekle">📁➕</button>
        <button class="doc-mini-btn" onclick="event.stopPropagation();renameGlobalFolder('${f.id}')" title="Yeniden Adlandır">✏️</button>
        <button class="doc-mini-btn" onclick="event.stopPropagation();uploadToGlobalFolder('${f.id}')" title="Belge Yükle">⬆️</button>
        <button class="doc-mini-btn" onclick="event.stopPropagation();deleteGlobalFolder('${f.id}')" title="Sil">🗑️</button>
      </div>
      ${open?`${kids.map(k=>renderGlobalFolder(k, depth+1)).join('')}<div style="padding:2px 0 6px ${pad}px">
        ${docs.length?docs.map(d=>`
          <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:7px">
            <span style="font-size:14px">${d.type==='application/pdf'?'📄':'🖼️'}</span>
            <span style="flex:1;font-size:12.5px;color:var(--txt2);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" onclick="window.open('${d.url}','_blank')">${safe(d.name)}</span>
            <button class="doc-mini-btn" onclick="sendGlobalDocToCompany('${f.id}','${d.id}')" title="Şirkete Gönder" style="font-size:13px">📤</button>
            <button class="doc-mini-btn" onclick="deleteGlobalDoc('${f.id}','${d.id}')" title="Sil" style="font-size:13px">🗑️</button>
          </div>`).join(''):(kids.length?'':'<div style="padding:8px 10px;font-size:12px;color:var(--txt3)">Boş klasör</div>')}
        <button class="btn btn-secondary btn-sm" style="margin-top:6px;width:100%;justify-content:center" onclick="uploadToGlobalFolder('${f.id}')">📎 Belge Ekle</button>
      </div>`:''}
    </div>`;
}

async function addGlobalFolder(parentId){
  const name=await promptDialog({title: parentId?'Yeni Alt Klasör':'Yeni Klasör', message:'Klasör adı:', placeholder:'örn: Sözleşmeler', okText:'Oluştur'});
  if(name===null||!name.trim()) return;
  if(!_globalDocs.folders) _globalDocs.folders=[];
  const nf={ id:'gf'+Date.now(), name:name.trim(), docs:[] };
  if(parentId) nf.parentId=parentId;
  _globalDocs.folders.push(nf);
  if(parentId) _globalDocOpen[parentId]=true;
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
      <input class="form-input" style="height:36px;font-size:13px;margin-bottom:8px" placeholder="🔍 Şirket ara…" oninput="window._filterPickComp&&window._filterPickComp(this.value)"/>
      <label class="perm-item" style="cursor:pointer;background:var(--bg2);border-color:var(--accent)">
        <input type="checkbox" id="pick-all-comp" onchange="document.querySelectorAll('.pick-comp-row:not([style*=none]) .pick-comp').forEach(c=>c.checked=this.checked)"/>
        <div><div class="perm-label">✔️ Tümünü Seç</div><div class="perm-desc">${list.length} şirket</div></div>
      </label>
      <div style="display:flex;flex-direction:column;gap:4px;max-height:45vh;overflow-y:auto;margin-top:8px">
        ${list.map(c=>`<label class="perm-item pick-comp-row" data-name="${safe((c.name||'').toLowerCase())}" style="cursor:pointer">
          <input type="checkbox" class="pick-comp" value="${c.id}"/>
          <div><div class="perm-label">🏢 ${safe(c.name)}</div></div>
        </label>`).join('')}
      </div>
      <button class="btn btn-primary btn-full" style="margin-top:14px" onclick="window._pickCompaniesDone&&window._pickCompaniesDone()">📤 Seçilenlere Gönder</button>`;
    window._filterPickComp=(v)=>{ const s=(v||'').trim().toLowerCase();
      document.querySelectorAll('.pick-comp-row').forEach(r=>{ r.style.display=(!s||(r.getAttribute('data-name')||'').includes(s))?'':'none'; }); };
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
  // Alt klasörleri özyinelemeli topla
  const toDelete=[]; const collect=(id)=>{ toDelete.push(id); (_globalDocs.folders||[]).filter(x=>x.parentId===id).forEach(c=>collect(c.id)); };
  collect(fid);
  const bucket=(_globalDocs.folders||[]).filter(x=>toDelete.includes(x.id));
  const docCount=bucket.reduce((n,x)=>n+(x.docs||[]).length,0);
  const subCount=toDelete.length-1;
  if(!await confirmDialog({title:'Klasörü Sil',message:`"${safe(f.name)}"${subCount?` ve ${subCount} alt klasör`:''} + içindeki ${docCount} belge silinecek (belgeler 30 gün çöpte geri alınabilir).`,danger:true,okText:'Sil'})) return;
  for(const x of bucket){ for(const d of (x.docs||[])){ await trashDoc(d, 'Genel Evrak: '+(x.name||''), '_global'); } }
  _globalDocs.folders=_globalDocs.folders.filter(x=>!toDelete.includes(x.id));
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
  if(!await confirmDialog({title:'Belgeyi Sil',message:`"${safe(d.name)}" silinecek (30 gün çöpte geri alınabilir).`,danger:true,okText:'Sil'})) return;
  await trashDoc(d, 'Genel Evrak: '+(f.name||''), '_global');
  f.docs=f.docs.filter(x=>x.id!==docId);
  try{ await saveGlobalDocs(); renderGlobalDocs(); toast('🗑️ Belge silindi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

