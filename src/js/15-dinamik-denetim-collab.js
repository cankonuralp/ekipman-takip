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

