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

