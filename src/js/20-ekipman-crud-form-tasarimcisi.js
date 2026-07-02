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
  // Ekipmanın belgeleri çöpe (dosyalar Storage'da sahipsiz kalmasın, 30 gün geri alınabilir)
  for(const d of (e.documents||[])){ await trashDoc(d, 'Silinen ekipman: '+(e.name||'')); }
  S.equips  =S.equips.filter(x=>x.id!==S.editEquipId);
  S.reports =S.reports.filter(r=>r.equipId!==S.editEquipId);
  logActivity('equip_del', `"${e.name}" ekipmanı silindi`);
  try{ await save(); closeModal('modal-edit-equip'); toast('🗑️ Silindi'); goBack(); }
  catch(err){ toast('❌ '+err.message,5000); }
}

