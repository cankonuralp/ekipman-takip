/* ══════════════════════════════════════
   EKİPMAN BELGELERİ (Firebase Storage arşivi)
   - Max 10 belge, sabitleme (📌 hep üstte), tarih
   - Cihazdan seç veya tarayıcı (çoklu sayfa → PDF)
   ══════════════════════════════════════ */
const MAX_DOCS=10;
const MAX_DOC_MB=3;

function getEquipDocs(e){
  return Array.isArray(e.documents)?e.documents.slice():[];
}
function renderEquipDocs(e){
  const docs=getEquipDocs(e);
  // Sabitlenenler üstte, sonra tarihe göre yeni→eski
  docs.sort((a,b)=>{
    if((b.pinned?1:0)!==(a.pinned?1:0)) return (b.pinned?1:0)-(a.pinned?1:0);
    return (b.ts||0)-(a.ts||0);
  });
  const open=_docsOpen;
  const canManage=canDo('add_equip')||canDo('inspect');
  const rows = docs.length ? docs.map(d=>{
    const dt=d.ts?new Date(d.ts).toLocaleDateString('tr-TR'):'';
    const icon=d.type==='application/pdf'?'📄':(d.type&&d.type.startsWith('image/')?'🖼️':'📎');
    return `<div style="padding:10px 12px;border-bottom:1px solid var(--brd)">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">${icon}</span>
        <div style="flex:1;min-width:0;cursor:pointer" onclick="openDocLink('${d.id}')">
          <div style="font-size:13.5px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.pinned?'📌 ':''}${safe(d.name)}</div>
          <div style="font-size:11px;color:var(--txt3)">${dt}</div>
        </div>
        ${canManage?`<button class="doc-mini-btn" onclick="deleteEquipDoc('${d.id}')" title="Sil">🗑️</button>`:''}
      </div>
      ${canManage?`<label style="display:flex;align-items:center;gap:7px;margin-top:7px;margin-left:28px;cursor:pointer;font-size:12.5px;color:var(--txt2);user-select:none">
        <input type="checkbox" ${d.pinned?'checked':''} onchange="toggleDocPin('${d.id}')" style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer"/>
        Sabitle <span style="font-size:11px;color:var(--txt3)">(üstte kalsın)</span>
      </label>`:''}
    </div>`;
  }).join('') : `<div style="padding:16px 12px;text-align:center;color:var(--txt3);font-size:13px">Henüz belge yok</div>`;

  return `<div style="border:1px solid var(--brd);border-radius:12px;margin-bottom:12px;overflow:hidden">
    <div onclick="_docsOpen=!_docsOpen;renderEquipDetail()" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 14px;cursor:pointer;background:var(--bg)">
      <span style="font-size:13.5px;font-weight:600;color:var(--txt)">📎 Ekipmanla İlgili Belgeler <span style="font-size:11px;color:var(--txt3);font-weight:400">(${docs.length}/${MAX_DOCS})</span></span>
      <span style="color:var(--txt3);transform:rotate(${open?'180':'0'}deg);transition:transform .2s">▾</span>
    </div>
    <div style="display:${open?'block':'none'}">
      ${rows}
      ${canManage?`<div style="display:flex;justify-content:flex-end;padding:10px 12px">
        <button class="btn btn-primary btn-sm" onclick="startDocUpload('${e.id}')" ${docs.length>=MAX_DOCS?'disabled style="opacity:.5"':''}>
          ${docs.length>=MAX_DOCS?'Limit doldu (10)':'⬆️ Belge Yükle'}
        </button>
      </div>`:''}
    </div>
  </div>`;
}

/* Belge linkini aç */
function openDocLink(docId){
  const e=equipById(S.activeEquipId); if(!e) return;
  const d=getEquipDocs(e).find(x=>x.id===docId);
  if(d&&d.url) window.open(d.url,'_blank');
}

/* Sabitle / kaldır */
async function toggleDocPin(docId){
  const e=equipById(S.activeEquipId); if(!e) return;
  if(!Array.isArray(e.documents)) return;
  const d=e.documents.find(x=>x.id===docId); if(!d) return;
  d.pinned=!d.pinned;
  try{ await save(); renderEquipDetail(); toast(d.pinned?'📌 Sabitlendi':'Sabitleme kaldırıldı'); }
  catch(err){ toast('❌ '+err.message); }
}

/* Belge sil (Storage'dan + kayıttan) */
async function deleteEquipDoc(docId){
  const e=equipById(S.activeEquipId); if(!e) return;
  const d=(e.documents||[]).find(x=>x.id===docId); if(!d) return;
  if(!await confirmDialog({title:'Belge Silinsin mi?',message:`"${safe(d.name)}" silinecek (30 gün çöpte geri alınabilir).`,danger:true,okText:'Sil'})) return;
  try{
    // Storage'dan HEMEN silme — çöp kutusuna taşı (30 gün geri alınabilir)
    await trashDoc(d, 'Ekipman: '+(e.name||''));
    e.documents=e.documents.filter(x=>x.id!==docId);
    await save(); renderEquipDetail(); toast('🗑️ Belge silindi');
  }catch(err){ toast('❌ Silinemedi: '+(err.message||'')); }
}

/* ── BELGE YÜKLEME AKIŞI ──
   Seçim sorar: Cihazdan Yükle / Fotoğraf Çek. Sonra sıkıştır → Storage → kayıt.
   (Uygulama içi tarayıcı kaldırıldı — kullanıcı telefonun kendi Belge Tara özelliğine yönlendirilir.) */
let _docUploading=false;       // aynı anda 2 yükleme engeli
let _docTargetEquip=null;

function startDocUpload(equipId){
  if(_docUploading){ toast('⏳ Zaten bir yükleme sürüyor, bekleyin'); return; }
  if(!_storageReady){ toast('⚠️ Belge sistemi şu an kullanılamıyor'); return; }
  const e=equipById(equipId); if(!e) return;
  if(getEquipDocs(e).length>=MAX_DOCS){ toast(`⚠️ En fazla ${MAX_DOCS} belge yüklenebilir`); return; }
  if(!_fbConnected){ toast('📡 İnternet yok — belge yüklemek için bağlantı gerekli',4000); return; }
  _docTargetEquip=equipId;
  openModal('modal-doc-source');
}

/* Cihazdan dosya seç */
function docPickFromDevice(){
  closeModal('modal-doc-source');
  const inp=document.getElementById('doc-file-input');
  if(inp){ inp.value=''; inp.click(); }
}

/* Direkt fotoğraf çek (kamera açılır, tek foto) */
function docTakePhoto(){
  closeModal('modal-doc-source');
  const inp=document.getElementById('doc-photo-input');
  if(inp){ inp.value=''; inp.click(); }
}

/* Cihazdan dosya seçilince */
async function onDocFileSelected(ev){
  const file=ev.target.files&&ev.target.files[0];
  if(!file) return;
  // Tip kontrolü
  if(file.type!=='application/pdf' && !file.type.startsWith('image/')){
    toast('⚠️ Sadece PDF ve resim yüklenebilir'); return;
  }
  // İsim sor
  // Varsayılan isim: dosya adı varsa onu kullan, kamera fotoğrafıysa tarihli isim
  let defaultName=file.name.replace(/\.[^.]+$/,'');
  if(!defaultName || /^image|^photo|^img/i.test(defaultName)){
    defaultName='Fotoğraf '+new Date().toLocaleDateString('tr-TR');
  }
  const name=await promptDialog({title:'Belge Adı',message:'Bu belge hangi isimle kaydedilsin?',placeholder:'örn: Bakım Onarım Formu',value:defaultName,okText:'Yükle'});
  if(name===null||!name.trim()) return;
  let blob=file;
  // Resimse sıkıştır
  if(file.type.startsWith('image/')){
    try{ blob=await compressImage(file); }catch(e){ /* sıkıştırma başarısızsa orijinal */ }
  }
  await uploadDocBlob(blob, name.trim(), file.type);
}

/* Resim sıkıştırma (canvas ile, max 1600px + jpeg %75) */
function compressImage(file, maxDim=1600, quality=0.75){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      URL.revokeObjectURL(url);
      let {width,height}=img;
      if(width>maxDim||height>maxDim){
        if(width>height){ height=Math.round(height*maxDim/width); width=maxDim; }
        else { width=Math.round(width*maxDim/height); height=maxDim; }
      }
      const canvas=document.createElement('canvas');
      canvas.width=width; canvas.height=height;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#fff'; ctx.fillRect(0,0,width,height);
      ctx.drawImage(img,0,0,width,height);
      canvas.toBlob(b=>{ b?resolve(b):reject(new Error('sıkıştırma hatası')); }, 'image/jpeg', quality);
    };
    img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error('resim okunamadı')); };
    img.src=url;
  });
}

/* Blob'u Storage'a yükle + ekipmana kaydet */
async function uploadDocBlob(blob, name, type){
  const equipId=_docTargetEquip;
  const e=equipById(equipId); if(!e){ return; }
  // Son kontroller (yarış önleme)
  if(_docUploading){ toast('⏳ Zaten bir yükleme sürüyor'); return; }
  if(getEquipDocs(e).length>=MAX_DOCS){ toast(`⚠️ En fazla ${MAX_DOCS} belge`); return; }
  if(!_fbConnected){ toast('📡 İnternet yok — yükleme iptal'); return; }
  // Boyut kontrolü
  const sizeMB=blob.size/(1024*1024);
  if(sizeMB>MAX_DOC_MB){
    toast(`⚠️ Belge çok büyük (${sizeMB.toFixed(1)} MB). En fazla ${MAX_DOC_MB} MB olabilir.`,5000);
    return;
  }

  _docUploading=true;
  const loadingToast=showPersistentToast('⬆️ Belge yükleniyor… %0');
  try{
    const ext = type==='application/pdf'?'pdf':(type==='image/jpeg'?'jpg':(type.split('/')[1]||'bin'));
    const docId='doc'+Date.now()+Math.random().toString(36).slice(2,6);
    // Şirkete özel yol: belgeler/{şirketId}/{equipId}/{docId}.ext (izolasyon + güvenlik kuralları)
    const cid=S.activeCompanyId||'_ortak';
    const path=`belgeler/${cid}/${equipId}/${docId}.${ext}`;
    const ref=_storage.ref(path);
    const task=ref.put(blob, {contentType:type});

    await new Promise((resolve,reject)=>{
      task.on('state_changed',
        snap=>{
          const pct=Math.round((snap.bytesTransferred/snap.totalBytes)*100);
          updatePersistentToast(loadingToast, `⬆️ Belge yükleniyor… %${pct}`);
        },
        err=>reject(err),
        ()=>resolve()
      );
    });
    const url=await ref.getDownloadURL();

    // Ekipmana kaydet
    if(!Array.isArray(e.documents)) e.documents=[];
    e.documents.push({ id:docId, name, type, path, url, size:(blob?.size||0), ts:Date.now(), by:S.cur?.username||'—', pinned:false });
    await save();
    hidePersistentToast(loadingToast);
    toast('✅ Belge yüklendi: '+name);
    renderEquipDetail();
    try{ renderFbUsage(); }catch(e){}   // depolama barını hemen güncelle
  }catch(err){
    hidePersistentToast(loadingToast);
    if(err.code==='storage/unauthorized') toast('🔒 Yetki hatası — belge yüklenemedi',5000);
    else if(err.code==='storage/canceled') toast('Yükleme iptal edildi');
    else toast('❌ Yükleme başarısız: '+(err.message||'bilinmeyen hata'),5000);
  }finally{
    _docUploading=false;
  }
}

