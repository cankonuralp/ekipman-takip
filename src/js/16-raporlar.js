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

