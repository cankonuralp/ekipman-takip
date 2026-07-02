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

