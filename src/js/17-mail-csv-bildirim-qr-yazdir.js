/* ══════════════════════════════════════
   UYGUNSUZ RAPORLARI MAİL GÖNDER (kısa format)
══════════════════════════════════════ */
function mailFailReports(){
  const failEquips=S.equips.filter(e=>getStatus(e)==='fail');
  if(!failEquips.length){ toast('✅ Uygunsuz ekipman yok'); return; }
  const today=new Date().toLocaleDateString('tr-TR');
  let body=`Uygunsuz Ekipman Bildirimi — ${today}\n`;
  body+=`Toplam ${failEquips.length} ekipmanda uygunsuzluk tespit edildi.\n\n`;
  failEquips.forEach(e=>{
    const m=mahalById(e.mahalId)?.name||'—';
    const reasons=failReasonsShort(e);
    const date=e.lastInsp?e.lastInsp.date:'—';
    // Tek satır: [sebepler] sebebiyle [mahal]'deki [ekipman] uygunsuzdur. (tarih)
    body+=`• ${reasons} sebebiyle ${m} lokasyonundaki "${e.name}" ekipmanı uygunsuzdur. (${date})\n`;
  });
  body+=`\nTakipEt Denetim Sistemi`;
  const subject=`Uygunsuz Ekipman Bildirimi — ${today} (${failEquips.length} adet)`;
  window.location.href=`mailto:${NOTIFY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  toast('📧 Mail uygulaması açılıyor…');
}

/* ══════════════════════════════════════
   GİDERİLEN UYGUNSUZLUKLARI MAİL GÖNDER
══════════════════════════════════════ */
function mailResolvedReports(){
  // Son denetimde "ok" olan ve daha önce uygunsuzluk geçmişi olan ekipmanlar
  const resolved=S.equips.filter(e=>{
    if(getStatus(e)!=='ok') return false;
    const reps=S.reports.filter(r=>r.equipId===e.id).sort((a,b)=>b.createdAt>a.createdAt?1:-1);
    return reps.length>=2 && reps[1].result==='fail'; // bir önceki uygunsuzdu
  });
  if(!resolved.length){ toast('ℹ️ Yeni giderilen uygunsuzluk yok'); return; }
  const today=new Date().toLocaleDateString('tr-TR');
  let body=`Giderilen Uygunsuzluk Bildirimi — ${today}\n`;
  body+=`${resolved.length} ekipmandaki uygunsuzluk giderildi.\n\n`;
  resolved.forEach(e=>{
    const m=mahalById(e.mahalId)?.name||'—';
    const date=e.lastInsp?e.lastInsp.date:'—';
    body+=`• ${m} lokasyonundaki "${e.name}" ekipmanındaki uygunsuzluk giderildi. (${date})\n`;
  });
  body+=`\nTakipEt Denetim Sistemi`;
  const subject=`Giderilen Uygunsuzluk Bildirimi — ${today} (${resolved.length} adet)`;
  window.location.href=`mailto:${NOTIFY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  toast('📧 Mail uygulaması açılıyor…');
}

/* ══════════════════════════════════════
   EXCEL (CSV) EXPORT
══════════════════════════════════════ */
function exportReportsExcel(){
  if(!S.reports.length){ toast('⚠️ Rapor yok'); return; }
  const rows=[['Rapor No','Tarih','Ekipman','Kategori','Mahal','Denetleyen','Sonuç','Uygun','Uygun Değil','Not']];
  [...S.reports].sort((a,b)=>b.createdAt>a.createdAt?1:-1).forEach(r=>{
    // Uygun/uygunsuz sayısı — dinamik form veya eski format
    let okC=r.okCount||0, failC=r.failCount||0;
    if(r.form && r.formAnswers){
      okC=0; failC=0;
      for(const f of r.form.fields){
        if(f.type==='table'){
          (r.formAnswers[f.id]||[]).forEach(row=>{
            (f.columns||[]).forEach(c=>{ const v=row[c.id]; if(v!==undefined&&v!==''&&c.type!=='text'){ isFieldNegative(c,v)?failC++:okC++; }});
          });
        } else if(f.type!=='text'){
          const v=r.formAnswers[f.id];
          if(v!==undefined&&v!==''){ isFieldNegative(f,v)?failC++:okC++; }
        }
      }
    }
    rows.push([
      r.id, r.date, r.equipName, r.catName, r.mahalName, r.by,
      r.result==='ok'?'UYGUN':r.result==='fail'?'UYGUN DEĞİL':'EKSİK',
      okC, failC, (r.note||'').replace(/[\n\r;]/g,' ')
    ]);
  });
  // CSV — Excel Türkçe karakter için BOM + ; ayraç
  const csv='\uFEFF'+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`TakipEt-Raporlar-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('📊 Excel (CSV) indirildi');
}

/* ══════════════════════════════════════
   YÖNETİCİYE BİLDİR
══════════════════════════════════════ */
async function notifyManagers(reportId){
  const r=rptById(reportId); if(!r) return;
  const note=await promptDialog({
    title:'🔔 Yöneticiye Bildir',
    message:'İletmek istediğiniz not (isteğe bağlı):',
    placeholder:'Örn: Acil müdahale gerekiyor…',
    multiline:true, okText:'Gönder'
  });
  if(note===null) return; // iptal
  const notif={
    id:'n'+Date.now(),
    reportId:r.id, equipName:r.equipName, mahalName:r.mahalName,
    result:r.result, by:S.cur?.fullname||S.cur?.username||'—',
    note:note||'', date:nowStr(), ts:Date.now(),
    readBy:[],  // okuyan admin/yönetici id'leri
  };
  S.notifications.unshift(notif);
  if(S.notifications.length>100) S.notifications=S.notifications.slice(0,100);
  try{
    await save();
    updateNotifBell();
    toast('🔔 Yöneticilere bildirim gönderildi');
  }catch(e){ toast('❌ '+e.message,5000); }
}

/* Okunmamış bildirim sayısı (admin/yönetici için) */
function unreadNotifCount(){
  if(!S.cur) return 0;
  return S.notifications.filter(n=>isNotifVisibleToMe(n) && !(n.readBy||[]).includes(S.cur.id)).length;
}

async function markNotifRead(id){
  const n=S.notifications.find(x=>x.id===id);
  if(!n) return;
  n.readBy=n.readBy||[];
  if(!n.readBy.includes(S.cur.id)){ n.readBy.push(S.cur.id); await save(); }
}

function openNotifications(){
  renderNotifications();
  showPage('notifications');
}

function renderNotifications(){
  const el=document.getElementById('notif-container'); if(!el) return;
  // Sadece bana görünür bildirimler (hedef kitledeyim + silmediğim) — zil ile aynı kural
  const notifs=S.notifications.filter(n=>isNotifVisibleToMe(n)).sort((a,b)=>b.ts-a.ts);
  const PER=10;
  if(!S.pgNotif) S.pgNotif=1;
  const pages=Math.ceil(notifs.length/PER)||1;
  if(S.pgNotif>pages) S.pgNotif=pages;
  if(S.pgNotif<1) S.pgNotif=1;
  const start=(S.pgNotif-1)*PER;
  let html=`<button class="page-back-btn" onclick="goBack()">← Geri</button>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
      <p class="sec-label" style="margin:0">🔔 Bildirimler (${notifs.length})</p>
      ${notifs.length?`<button class="btn btn-secondary btn-sm" onclick="clearAllNotifs()" style="font-size:11px;padding:5px 10px">🗑️ Tümünü Temizle</button>`:''}
    </div>`;
  if(!notifs.length){
    html+=`<div class="empty-state"><div class="empty-icon">🔔</div><p>Bildirim yok.</p></div>`;
  } else {
    html+=notifs.slice(start, start+PER).map(n=>{
      const unread=!(n.readBy||[]).includes(S.cur.id);
      const t=n.type||n.result;
      // Türe göre renk + ikon
      let icon='🔔', accent='var(--accent)';
      if(t==='fail'){ icon='🔴'; accent='#ef4444'; }
      else if(t==='resolved'){ icon='🟢'; accent='#22c55e'; }
      else if(t==='ok'){ icon='✅'; accent='#22c55e'; }
      else if(t==='overdue'){ icon='⏰'; accent='#f59e0b'; }
      else if(t==='incomplete'){ icon='⏳'; accent='#f59e0b'; }
      else if(t==='wo_new'){ icon='🗂️'; accent='var(--accent)'; }
      else if(t==='wo_done'){ icon='✅'; accent='#22c55e'; }
      else if(t==='wo_approved'){ icon='👍'; accent='#22c55e'; }
      return `<div class="ed-card" style="margin-bottom:10px;border-left:3px solid ${accent};${unread?'':'opacity:.82'}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1;min-width:0;cursor:pointer" onclick="markNotifRead('${n.id}').then(()=>{${n.woId?`openWorkOrderDetail('${n.woId}')`:n.reportId?`openReportDetail('${n.reportId}')`:n.equipId?`openEquipDetail('${n.equipId}')`:''}})">
            <div style="font-weight:700;color:var(--txt);font-size:14px">${icon} ${safe(n.equipName)}</div>
            <div style="font-size:12px;color:var(--txt2);margin-top:2px">${safe(n.mahalName)}${n.by?' · '+safe(n.by):''}</div>
            ${n.note?`<div style="font-size:13px;color:var(--txt);margin-top:6px;padding:8px;background:var(--bg);border-radius:8px">${safe(n.note)}</div>`:''}
            <div style="font-size:11px;color:var(--txt3);margin-top:8px">${n.date}</div>
          </div>
          <button class="fd-mini fd-del" onclick="event.stopPropagation();deleteNotif('${n.id}')" title="Bildirimi sil">🗑️</button>
        </div>
      </div>`;
    }).join('');
    html+=pagerHTML(notifs.length, S.pgNotif, PER, 'S.pgNotif=%P%;renderNotifications()');
  }
  el.innerHTML=html;
}

async function deleteNotif(id){
  // Kişiye özel silme: bildirimi tamamen kaldırma, sadece bu kullanıcıdan gizle
  const n=S.notifications.find(x=>x.id===id);
  if(n){
    n.deletedBy=n.deletedBy||[];
    if(S.cur?.id && !n.deletedBy.includes(S.cur.id)) n.deletedBy.push(S.cur.id);
    // Herkes sildiyse tamamen kaldır (yer kaplamasın)
    const recipients=notifRecipients(n);
    if(recipients.length && recipients.every(uid=>n.deletedBy.includes(uid))){
      S.notifications=S.notifications.filter(x=>x.id!==id);
    }
  }
  try{ await save(); renderNotifications(); updateNotifBell(); }catch(e){ toast('❌ '+e.message); }
}
async function clearAllNotifs(){
  if(!await confirmDialog({title:'Bildirimleriniz Temizlensin mi?',message:'Sadece sizin bildirim listeniz temizlenecek (diğer kullanıcıları etkilemez).',danger:true,okText:'Temizle'})) return;
  // Kişiye özel: sadece kendi görünür bildirimlerini deletedBy'a ekle
  S.notifications.forEach(n=>{
    if(isNotifVisibleToMe(n)){
      n.deletedBy=n.deletedBy||[];
      if(S.cur?.id && !n.deletedBy.includes(S.cur.id)) n.deletedBy.push(S.cur.id);
    }
  });
  // Tamamen herkesçe silinmişleri kaldır
  S.notifications=S.notifications.filter(n=>{
    const recipients=notifRecipients(n);
    return !(recipients.length && recipients.every(uid=>(n.deletedBy||[]).includes(uid)));
  });
  try{ await save(); renderNotifications(); updateNotifBell(); toast('🗑️ Bildirimleriniz temizlendi'); }catch(e){ toast('❌ '+e.message); }
}
/* Bir bildirimin HEDEF KİTLESİ (rol/yetki sistemine göre alması gereken kullanıcı id'leri).
   TEK KAYNAK — zil sayısı, liste ve temizlik hep bunu kullanır (tutarlılık). */
function notifRecipients(n){
  // Bakım bildirimi: bakım uyarısı alanlar
  if(n && n.type==='maintenance'){
    return S.users.filter(u=>u.isSuper || roleLevel(u.role)>=3 || getUserPerms(u).includes('maint_warn')).map(u=>u.id);
  }
  // Diğerleri: yönetici+ (rol seviyesi 3+) VEYA "Bildirim Al" yetkisi olanlar
  return S.users.filter(u=>u.isSuper || roleLevel(u.role)>=3 || getUserPerms(u).includes('view_notifications')).map(u=>u.id);
}
/* Bu bildirim BANA görünür mü? (hedef kitledeyim VE silmemişsem) */
function isNotifVisibleToMe(n){
  if(!S.cur) return false;
  if((n.deletedBy||[]).includes(S.cur.id)) return false;
  if(S.cur.isSuper) return true;                 // süper admin tümünü görür (S.users'ta yok)
  if(Array.isArray(n.toIds)) return n.toIds.includes(S.cur.id); // HEDEFLİ bildirim (iş emri vb.)
  return notifRecipients(n).includes(S.cur.id);  // rol bazlı: sadece hedef kitledeysem
}

/* ══════════════════════════════════════
   QR TOPLU YAZDIRMA
══════════════════════════════════════ */
function printAllQR(){
  if(!S.equips.length){ toast('⚠️ Ekipman yok'); return; }
  const cards=S.equips.map(e=>{
    const cat=catById(e.cat);
    const m=mahalById(e.mahalId);
    const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=150x150&ecc=H&data=${encodeURIComponent(qrPayload(e.id))}`;
    return `<div style="display:inline-block;width:190px;border:1px solid #ddd;border-radius:8px;padding:12px;margin:6px;text-align:center;page-break-inside:avoid;vertical-align:top">
      <img src="${qrUrl}" width="150" height="150" style="border-radius:6px"/>
      <div style="font-weight:700;font-size:13px;margin-top:8px">${cat.icon} ${safe(e.name)}</div>
      <div style="font-size:11px;color:#666;margin-top:2px">${m?safe(m.name):''}</div>
    </div>`;
  }).join('');
  showPrintOverlay('Tüm QR Etiketleri', S.equips.length+' ekipman', `<div style="text-align:center">${cards}</div>`);
  toast(`✅ ${S.equips.length} QR etiketi hazır`);
}

