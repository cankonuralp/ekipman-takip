/* ══════════════════════════════════════
   QR KOD
══════════════════════════════════════ */
function showQRModal(id){
  const e=equipById(id); if(!e) return;
  S.qrEquipId=id;
  const box=document.getElementById('qr-box');
  box.innerHTML='';
  box.style.position='relative';
  if(typeof QRCode!=='undefined'){
    try{ new QRCode(box,{text:qrPayload(e.id),width:220,height:220,colorDark:'#111827',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.H}); }
    catch{ qrFallback(box,e.id); }
  } else qrFallback(box,e.id);
  // Ortaya logo bindir (correctLevel:H sayesinde okunabilirlik bozulmaz)
  setTimeout(()=>{
    if(document.getElementById('qr-logo-ov')) return;
    const ov=document.createElement('div');
    ov.id='qr-logo-ov';
    ov.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:46px;height:46px;background:#fff;border-radius:11px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.2)';
    ov.innerHTML='<div style="width:38px;height:38px;border-radius:9px;background:linear-gradient(135deg,#6C8EF5,#8B5CF6);display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" width="22" height="22"><circle cx="10.5" cy="10.5" r="6"/><line x1="15" y1="15" x2="20" y2="20"/></svg></div>';
    box.appendChild(ov);
  },60);
  document.getElementById('qr-lbl').textContent=e.name+' · '+e.id;
  openModal('modal-qr');
}
function qrFallback(box,id){
  const img=document.createElement('img');
  img.src=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrPayload(id))}`;
  img.width=220; img.height=220; img.style.borderRadius='8px';
  box.appendChild(img);
}
function downloadQR(){
  const e=equipById(S.qrEquipId);
  const name=e?e.name:S.qrEquipId;
  const srcCanvas=document.querySelector('#qr-box canvas');
  if(srcCanvas){
    // Etiketli versiyon: logo + isim + id
    const W=300, H=370, pad=20;
    const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    const ctx=cv.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
    // Başlık (TakipEt)
    ctx.fillStyle='#6C8EF5'; ctx.font='bold 20px Inter,sans-serif'; ctx.textAlign='center';
    ctx.fillText('TakipEt', W/2, 34);
    // QR
    ctx.drawImage(srcCanvas, (W-220)/2, 50, 220, 220);
    // Logo ortada
    const cx=W/2, cy=160;
    ctx.fillStyle='#fff'; roundRect(ctx,cx-25,cy-25,50,50,12); ctx.fill();
    const g=ctx.createLinearGradient(cx-19,cy-19,cx+19,cy+19); g.addColorStop(0,'#6C8EF5'); g.addColorStop(1,'#8B5CF6');
    ctx.fillStyle=g; roundRect(ctx,cx-19,cy-19,38,38,9); ctx.fill();
    ctx.strokeStyle='#fff'; ctx.lineWidth=2.6; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(cx-3,cy-3,7,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+2.5,cy+2.5); ctx.lineTo(cx+8,cy+8); ctx.stroke();
    // İsim
    ctx.fillStyle='#111827'; ctx.font='bold 16px Inter,sans-serif';
    const nm=name.length>26?name.slice(0,25)+'…':name;
    ctx.fillText(nm, W/2, 300);
    // ID
    ctx.fillStyle='#9ca3af'; ctx.font='12px Inter,sans-serif';
    ctx.fillText(S.qrEquipId, W/2, 322);
    ctx.fillStyle='#d1d5db'; ctx.font='10px Inter,sans-serif';
    ctx.fillText('Denetim için okutun', W/2, 344);
    const a=document.createElement('a'); a.download=name+'-QR.png'; a.href=cv.toDataURL('image/png'); a.click();
    return;
  }
  const img=document.querySelector('#qr-box img');
  if(img) window.open(img.src,'_blank');
}
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}

/* ══════════════════════════════════════
   KAMERA
══════════════════════════════════════ */
async function startCamera(){
  const hint=document.getElementById('cam-hint');
  hint.textContent='Kamera izni isteniyor…';
  try{
    S.camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});
    const v=document.getElementById('qr-video'); v.srcObject=S.camStream; await v.play();
    document.getElementById('btn-cam-start').disabled=true;
    document.getElementById('btn-cam-stop').disabled=false;
    hint.textContent='QR kodu kameranın karşısına tutun…';
    scanLoop();
  }catch(e){ hint.textContent='❌ Kamera hatası: '+e.message; }
}
function stopCamera(){
  if(S.camStream){ S.camStream.getTracks().forEach(t=>t.stop()); S.camStream=null; }
  if(S.scanAnimId){ cancelAnimationFrame(S.scanAnimId); S.scanAnimId=null; }
  const v=document.getElementById('qr-video'); if(v) v.srcObject=null;
  const s=document.getElementById('btn-cam-start'); if(s) s.disabled=false;
  const t=document.getElementById('btn-cam-stop');  if(t) t.disabled=true;
}
function scanLoop(){
  const v=document.getElementById('qr-video'), c=document.getElementById('qr-canvas');
  if(!v||!c||!S.camStream) return;
  if(v.readyState!==v.HAVE_ENOUGH_DATA){ S.scanAnimId=requestAnimationFrame(scanLoop); return; }
  c.width=v.videoWidth; c.height=v.videoHeight;
  const ctx=c.getContext('2d'); ctx.drawImage(v,0,0,c.width,c.height);
  try{
    const code=jsQR(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height,{inversionAttempts:'dontInvert'});
    if(code){ stopCamera(); closeModal('modal-scan'); handleQRData(code.data); return; }
  }catch(e){}
  S.scanAnimId=requestAnimationFrame(scanLoop);
}
function handleQRFile(file){
  if(!file) return;
  const hint=document.getElementById('file-hint'); hint.textContent='Analiz ediliyor…';
  const img=new Image(), url=URL.createObjectURL(file);
  img.onload=()=>{
    const cvs=document.createElement('canvas'); cvs.width=img.width; cvs.height=img.height;
    const ctx=cvs.getContext('2d'); ctx.drawImage(img,0,0);
    const code=jsQR(ctx.getImageData(0,0,cvs.width,cvs.height).data,cvs.width,cvs.height);
    URL.revokeObjectURL(url);
    if(code){ hint.textContent='✅ OK'; closeModal('modal-scan'); setTimeout(()=>handleQRData(code.data),200); }
    else hint.textContent='❌ QR bulunamadı.';
  }; img.src=url;
}
let _pendingQR=null; // girişsiz QR okutulunca saklanır, giriş sonrası işlenir
/* Süper admin QR okuttu ama ekipman aktif şirkette yok → tüm şirketlerde ara, bulunduğu şirkete geç */
async function findEquipAcrossCompanies(equipId){
  // Birim QR formatı (TE:equipId:field:row) ise gerçek equipId'yi çıkar
  let searchId=equipId, fullData=equipId;
  if(equipId.startsWith('TE:')){ searchId=equipId.split(':')[1]; }
  showLoading(true);
  try{
    for(const c of S.companies){
      if(c.id===S.activeCompanyId) continue;
      try{
        const snap=await _db.ref(`${companyDataPath(c.id)}/equips`).once('value');
        if(snap.exists()){
          const equips=toArr(snap.val());
          const found=equips.find(x=>x && x.id===searchId);
          if(found){
            showLoading(false);
            await switchToCompany(c.id);
            await new Promise(r=>setTimeout(r,400));
            setTimeout(()=>handleQRData(fullData), 300);
            return;
          }
        }
      }catch(e){}
    }
    showLoading(false);
    toast('❌ Bu QR hiçbir şirkette bulunamadı', 4000);
  }catch(e){ showLoading(false); toast('❌ '+e.message,4000); }
}

function handleQRData(data){
  data=(data||'').trim();
  // QR bir URL ise (?q=... ile) — içindeki gerçek veriyi çıkar
  if(data.includes('?q=')){
    try{ const u=new URL(data); const q=u.searchParams.get('q'); if(q) data=q; }
    catch(e){ const m=data.match(/[?&]q=([^&]+)/); if(m) data=decodeURIComponent(m[1]); }
  }
  // QR ONAY MODU: denetimde bir alan/birim QR ile onaylanmayı bekliyorsa
  if(_qrConfirm){ resolveQrConfirm(data); return; }
  // Giriş yapılmamışsa → QR'ı sakla, giriş ekranına yönlendir (giriş sonrası o ekipmana gider)
  if(!S.cur){
    _pendingQR=data; // giriş sonrası işlenecek
    try{ sessionStorage.setItem('te_pendingQR', data); }catch(e){}
    showLoginPromptForQR(data);
    return;
  }

  // Birim QR formatı: "TE:<equipId>:<fieldId>:<rowId>"
  if(data.startsWith('TE:')){
    const parts=data.split(':');
    if(parts.length>=4){
      const equipId=parts[1], fieldId=parts[2], rowId=parts.slice(3).join(':');
      handleUnitQR(equipId, fieldId, rowId);
      return;
    }
  }
  // Normal ekipman QR
  let e=equipById(data);
  if(!e){
    // Süper admin: ekipman aktif şirkette yok → TÜM şirketlerde ara, bulunduğu şirkete geç
    if(S.cur?.isSuper){
      findEquipAcrossCompanies(data);
      return;
    }
    // Normal kullanıcı: başka şirketin QR'ı olabilir → "yetkin yok"
    toast('🚫 Bu ekipmana erişim yetkiniz yok', 4000);
    return;
  }
  S.activeMahalId=e.mahalId;

  // Ekipmanın formunda tablo YOK ama QR alanı VARSA:
  // QR okutularak gelindiği için o alanı otomatik onaylayıp denetimi aç (tekrar okutma yok)
  const form=e.form||getCatForm(e.cat);
  const hasTable=(form.fields||[]).some(f=>f.type==='table');
  const qrField=(form.fields||[]).find(f=>f.type==='qr');
  if(!hasTable && qrField && canDo('inspect')){
    openInspection(e.id, true);
    // Denetim hazır olana kadar bekle, sonra QR alanını tikle
    let tries=0;
    const tick=()=>{
      tries++;
      if(!_insp || _insp.equipId!==e.id){
        if(tries>30){ toast('⚠️ Denetim açılamadı'); return; }
        return setTimeout(tick, 150);
      }
      _insp.answers[qrField.id]='ok';
      _insp.answers[qrField.id+'_ts']=new Date().toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
      saveInspDraftDyn(); renderInspection();
      haptic(20);
      toast('✅ QR doğrulandı — ilgili alan onaylandı');
    };
    setTimeout(tick, 350);
    return;
  }
  // Aksi halde ekipman detayına git
  openEquipDetail(e.id);
}

/* ── QR ile onay (denetim alanı) ── */
let _qrConfirm=null; // {type:'field'|'unit', equipId, fieldId, rowId}

/* Tekil 'qr' alanı için: ekipman QR'ı okutarak onayla */
function startQrConfirm(fieldId){
  if(!_insp||!_insp.equipId){ toast('⚠️ Önce denetimi açın'); return; }
  _qrConfirm={ type:'field', equipId:_insp.equipId, fieldId };
  openModal('modal-scan');
  // Modal animasyonu bitince kamerayı başlat (yoksa siyah ekran)
  setTimeout(()=>{ startCamera&&startCamera(); }, 350);
}

/* Tablo birimi için: o birimin QR'ını okutarak onayla */
function startUnitQrConfirm(fieldId, rowId){
  if(!_insp||!_insp.equipId){ toast('⚠️ Önce denetimi açın'); return; }
  _qrConfirm={ type:'unit', equipId:_insp.equipId, fieldId, rowId };
  openModal('modal-scan');
  setTimeout(()=>{ startCamera&&startCamera(); }, 350);
}

/* Okutulan QR onay moduyla eşleşiyor mu? */
function resolveQrConfirm(data){
  const c=_qrConfirm; _qrConfirm=null;
  stopCamera&&stopCamera(); closeModal('modal-scan');
  if(!c) return;
  const now=new Date().toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});

  if(c.type==='field'){
    // Ekipman QR'ı: "TE:equipId:..." veya düz equipId olabilir
    let okId=null;
    if(data.startsWith('TE:')){ okId=data.split(':')[1]; }
    else { okId=data; }
    if(okId===c.equipId){
      _insp.answers[c.fieldId]='ok';
      _insp.answers[c.fieldId+'_ts']=now;
      saveInspDraftDyn(); renderInspection();
      haptic(20); toast('✅ QR doğrulandı, onaylandı');
    } else {
      toast('❌ Farklı bir ekipmanın QR\'ı — eşleşmedi');
    }
    return;
  }

  if(c.type==='unit'){
    // Birim QR: "TE:equipId:fieldId:rowId"
    if(!data.startsWith('TE:')){ toast('❌ Bu bir birim QR\'ı değil'); return; }
    const parts=data.split(':');
    const eId=parts[1], fId=parts[2], rId=parts.slice(3).join(':');
    // Ekipman + alan eşleşmeli; satır ise okutulan QR'a göre OTOMATİK bulunur
    // (kullanıcı önceden satır seçmek zorunda değil — sırayla okutabilir)
    if(eId!==c.equipId){ toast('❌ Farklı ekipmanın QR\'ı'); return; }
    if(fId!==c.fieldId){ toast('❌ Bu tablonun birimi değil'); return; }
    const rows=_insp.tables[c.fieldId]||[];
    const row=rows.find(r=>r._rowId===rId);
    if(row){
      row._qrOk=true; row._qrTs=now; row._qrTsNum=Date.now();
      saveInspDraftDyn(); pushCollabCell(); renderInspection();
      haptic(20); toast(`✅ "${row._label||'Birim'}" QR onaylandı`);
    } else {
      toast('⚠️ Bu QR\'a ait birim bu denetimde yok');
    }
    return;
  }
}

/* Birim QR okutuldu → ilgili ekipmanın denetimini aç + o birimi işaretle */
function handleUnitQR(equipId, fieldId, rowId){
  const e=equipById(equipId);
  if(!e){
    // Süper admin: başka şirkette olabilir → tüm şirketlerde ara, geçip birim QR'ı tekrar işle
    if(S.cur?.isSuper){ findEquipAcrossCompanies('TE:'+equipId+':'+fieldId+':'+rowId); return; }
    toast('🚫 Bu ekipmana erişim yetkiniz yok', 4000); return;
  }
  if(S.cur && !canDo('inspect')){ toast('🚫 Denetim yetkiniz yok'); S.activeMahalId=e.mahalId; openEquipDetail(e.id); return; }
  // Denetimi aç (yarım varsa ona devam et — QR ile birim onaylanıyor)
  openInspection(equipId, true);
  // Denetim + tablo hazır olana kadar bekle, sonra ilgili birimi tikle
  let tries=0;
  const tick=()=>{
    tries++;
    if(!_insp || _insp.equipId!==equipId){
      if(tries>30){ toast('⚠️ Denetim açılamadı'); return; }
      return setTimeout(tick, 150);
    }
    const rows=_insp.tables && _insp.tables[fieldId];
    if(!rows){
      if(tries>30){ toast('⚠️ Bu birim bu denetimde yok'); return; }
      return setTimeout(tick, 150);
    }
    const row=rows.find(r=>r._rowId===rowId);
    if(!row){
      if(tries>30){ toast('⚠️ Birim bulunamadı (silinmiş olabilir)'); return; }
      return setTimeout(tick, 150);
    }
    if(row._checked && row._qrOk){ renderInspection(); toast(`"${row._label||'Birim'}" zaten işaretli`); return; }
    const now=nowStr();
    row._checked=true;
    row._checkedAt=now;
    row._checkedBy=S.cur?.username||'';
    // QR sütunu varsa onu da onayla (QR ikonu → tik). Normal QR onay akışıyla tutarlı.
    const fld=(_insp.form?.fields||[]).find(f=>f.id===fieldId);
    const hasQrCol=(fld?.columns||[]).some(c=>c.type==='qr');
    if(hasQrCol){ row._qrOk=true; row._qrTs=now; row._qrTsNum=Date.now(); }
    haptic(20);
    saveInspDraftDyn();
    try{ pushCollabCell&&pushCollabCell(); }catch(e){}
    renderInspection();
    toast(`✅ "${row._label||'Birim'}" QR ile onaylandı`);
  };
  setTimeout(tick, 350);
}

/* Giriş yapmamış kişi QR okutunca — admin'in girdiği iletişim bilgisini göster */
/* Girişsiz QR okutuldu — kullanıcıyı bilgilendir, giriş ekranına yönlendir.
   Giriş yapınca _pendingQR işlenir, ilgili ekipmana gider. */
function showLoginPromptForQR(data){
  const html=`<div style="padding:4px 0">
    <div style="text-align:center;font-size:42px;margin-bottom:8px">🔐</div>
    <p style="font-size:15px;font-weight:600;color:var(--txt);text-align:center;margin-bottom:6px">Denetim için giriş yapın</p>
    <p style="font-size:13.5px;color:var(--txt2);line-height:1.6;text-align:center;margin-bottom:20px">
      Bu ekipmanın denetimine erişmek için sisteme giriş yapmanız gerekiyor. Giriş yaptıktan sonra otomatik olarak ilgili ekipmana yönlendirileceksiniz.</p>
    <button class="btn btn-primary btn-full" onclick="closeModal('modal-guest');goToLoginForQR()" style="margin-bottom:10px">🔑 Giriş Yap</button>
    <button class="btn btn-secondary btn-full" onclick="closeModal('modal-guest');openGuestContact()">Yetkim yok / Bilgi al</button>
  </div>`;
  document.getElementById('guest-body').innerHTML=html;
  openModal('modal-guest');
}
function goToLoginForQR(){
  // Giriş ekranını göster (zaten görünür olabilir); QR _pendingQR'da saklı
  document.getElementById('app').style.display='none';
  const ls=document.getElementById('login-screen');
  if(ls) ls.style.display='flex';
}

function openGuestContact(){
  const c=S.contactInfo||{};
  const tel=(c.tel||'').trim();
  const mail=(c.mail||'').trim();
  let contactBlock='';
  if(tel||mail){
    contactBlock='<div style="margin-bottom:14px">';
    if(tel)  contactBlock+=`<a href="tel:${safe(tel)}" class="btn btn-primary btn-full" style="text-decoration:none;margin-bottom:8px">📞 ${safe(tel)}</a>`;
    if(mail) contactBlock+=`<a href="mailto:${safe(mail)}" class="btn btn-primary btn-full" style="text-decoration:none">✉️ ${safe(mail)}</a>`;
    contactBlock+='</div>';
  } else {
    // Admin henüz iletişim girmemişse varsayılan başvuru
    contactBlock=`<a href="mailto:${CONTACT_EMAIL}?subject=TakipEt%20Bilgi%20Talebi" class="btn btn-primary btn-full" style="text-decoration:none;margin-bottom:10px">📧 Bilgi Almak İçin Mail Gönder</a>`;
  }
  const html=`<div style="padding:4px 0">
    <div style="text-align:center;font-size:42px;margin-bottom:8px">🔒</div>
    <p style="font-size:14px;color:var(--txt2);line-height:1.6;text-align:center;margin-bottom:20px">
      Bu denetim sistemine erişim yetkiniz yok. Sorularınız için iletişime geçebilirsiniz.</p>
    ${contactBlock}
  </div>`;
  document.getElementById('guest-body').innerHTML=html;
  openModal('modal-guest');
}

/* Başvuru formu — mailto ile gönderir */
function openGuestForm(){
  const html=`<div style="padding:2px 0">
    <p style="font-size:13px;color:var(--txt2);margin-bottom:14px;line-height:1.5">Bilgilerinizi doldurun, size dönüş yapalım.</p>
    <div class="form-group"><label class="form-label">İSİM</label><input class="form-input" id="gf-name"/></div>
    <div class="form-group"><label class="form-label">SOYİSİM</label><input class="form-input" id="gf-surname"/></div>
    <div class="form-group"><label class="form-label">NUMARA</label><input class="form-input" id="gf-phone" type="tel" inputmode="tel"/></div>
    <div class="form-group"><label class="form-label">KULLANMAK İSTEDİĞİNİZ ALAN</label><textarea class="form-textarea" id="gf-area" placeholder="Örn: Otel, fabrika, AVM yangın denetimi…"></textarea></div>
    <button class="btn btn-primary btn-full" onclick="sendGuestForm()" style="margin-top:6px">📧 Gönder</button>
  </div>`;
  document.getElementById('guest-body').innerHTML=html;
}

function sendGuestForm(){
  const name=document.getElementById('gf-name').value.trim();
  const surname=document.getElementById('gf-surname').value.trim();
  const phone=document.getElementById('gf-phone').value.trim();
  const area=document.getElementById('gf-area').value.trim();
  if(!name||!surname){ toast('⚠️ İsim ve soyisim zorunlu'); return; }
  const body=encodeURIComponent(`İsim: ${name}\nSoyisim: ${surname}\nNumara: ${phone}\nUygulamayı kullanmak istediğim alan: ${area}`);
  const subject=`TakipEt Başvuru - ${name} ${surname}`;
  window.location.href=`mailto:cankonuralp.ck@gmail.com?subject=${encodeURIComponent(subject)}&body=${body}`;
  toast('📧 Mail uygulamanız açılıyor…');
}
function manualQRFind(){
  const v=document.getElementById('manual-qr-inp').value.trim();
  if(!v){ toast('⚠️ ID girin'); return; }
  closeModal('modal-scan'); handleQRData(v);
}
function switchScanTab(id){
  document.querySelectorAll('#modal-scan .tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('#modal-scan .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelector(`#modal-scan .tab[data-tab="${id}"]`)?.classList.add('active');
  document.getElementById('tab-'+id)?.classList.add('active');
  if(id!=='camera') stopCamera();
}

