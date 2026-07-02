/* ══════════════════════════════════════
   DASHBOARD & ANALİZ (admin/yönetici)
══════════════════════════════════════ */
function openDashboard(){
  if(ROLE_LEVEL[S.cur?.role]<3){ toast('🚫 Yetkiniz yok'); return; }
  renderDashboard();
  showPage('dashboard');
}

// Dashboard'da gösterilecek kartlar (kullanıcı seçebilir, sessionStorage'da)
function getDashCards(){
  try{ const v=sessionStorage.getItem('te_dash'); return v?JSON.parse(v):['summary','byCat','byMahal','topFail','timeline','due','workorders']; }
  catch{ return ['summary','byCat','byMahal','topFail','timeline','due','workorders']; }
}
function setDashCards(arr){ try{ sessionStorage.setItem('te_dash',JSON.stringify(arr)); }catch(e){} }

/* Dashboard özet kartından ekipmanlar sayfasına FİLTRELİ git */
function dashGoEquip(filter){
  S.filterCat=filter||'all';
  S.searchQ=''; S.pgEquip=1;
  const sb=document.getElementById('search-bar'); if(sb) sb.value='';
  showPage('equipments');
  try{ renderEquipments(); }catch(e){}
}

function renderDashboard(){
  const el=document.getElementById('dashboard-container'); if(!el) return;
  const active=getDashCards();
  const total=S.equips.length;
  const ok=S.equips.filter(e=>getStatus(e)==='ok').length;
  const fail=S.equips.filter(e=>getStatus(e)==='fail').length;
  const pend=S.equips.filter(e=>getStatus(e)==='pend').length;

  const allCards=[
    {id:'summary',  label:'📊 Genel Özet'},
    {id:'byCat',    label:'🔧 Kategori Dağılımı'},
    {id:'byMahal',  label:'🏨 Mahal Durumu'},
    {id:'topFail',  label:'⚠️ En Sorunlu Ekipmanlar'},
    {id:'timeline', label:'📈 Aylık Denetim Trendi'},
    {id:'due',      label:'⏰ Denetim Bekleyenler'},
    {id:'workorders', label:'🗂️ Açık İş Emirleri'},
  ];

  let html=`<button class="page-back-btn" onclick="goBack()">← Geri</button>
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px">
      <h2 style="font-size:22px;font-weight:800;color:var(--txt)">📊 Dashboard</h2>
      <button class="btn btn-secondary btn-sm" onclick="openDashSettings()">⚙️ Kartları Seç</button>
    </div>`;

  // Kart seçim paneli (gizli)
  html+=`<div id="dash-settings" style="display:none;background:var(--card);border:1px solid var(--brd);border-radius:var(--r12);padding:14px;margin-bottom:14px">
    <p style="font-size:13px;font-weight:700;margin-bottom:10px">Gösterilecek Kartlar</p>
    ${allCards.map(c=>`<label style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;cursor:pointer">
      <input type="checkbox" value="${c.id}" ${active.includes(c.id)?'checked':''} onchange="toggleDashCard('${c.id}',this.checked)"/>
      ${c.label}
    </label>`).join('')}
  </div>`;

  // SUMMARY
  if(active.includes('summary')){
    const rate=total?Math.round(ok/total*100):0;
    html+=`<div class="ed-card" style="margin-bottom:14px">
      <p class="sec-label" style="margin-top:0">Genel Özet</p>
      <div class="hstat-grid">
        <div class="hstat-card" style="cursor:pointer" onclick="dashGoEquip('all')"><div class="hstat-icon">🔧</div><div class="hstat-num">${total}</div><div class="hstat-lbl">Ekipman</div></div>
        <div class="hstat-card ok" style="cursor:pointer" onclick="dashGoEquip('ok')"><div class="hstat-icon">✅</div><div class="hstat-num">${ok}</div><div class="hstat-lbl">Uygun</div></div>
        <div class="hstat-card fail" style="cursor:pointer" onclick="dashGoEquip('fail')"><div class="hstat-icon">❌</div><div class="hstat-num">${fail}</div><div class="hstat-lbl">Uygun Değil</div></div>
      </div>
      <div style="margin-top:14px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px"><span style="color:var(--txt2)">Uygunluk Oranı</span><span style="font-weight:700;color:var(--gtxt)">%${rate}</span></div>
        <div style="height:10px;background:var(--bg);border-radius:6px;overflow:hidden"><div style="height:100%;width:${rate}%;background:linear-gradient(90deg,#22c55e,#16a34a)"></div></div>
      </div>
    </div>`;
  }

  // BY CATEGORY
  if(active.includes('byCat')){
    html+=`<div class="ed-card" style="margin-bottom:14px"><p class="sec-label" style="margin-top:0">Kategori Dağılımı</p>`;
    allCats().forEach(cat=>{
      const eqs=S.equips.filter(e=>e.cat===cat.id);
      if(!eqs.length) return;
      const cOk=eqs.filter(e=>getStatus(e)==='ok').length;
      const cFail=eqs.filter(e=>getStatus(e)==='fail').length;
      const pct=eqs.length?Math.round(cOk/eqs.length*100):0;
      html+=`<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span>${cat.icon} ${cat.name}</span>
          <span style="color:var(--txt2)">${cOk}/${eqs.length}${cFail?` · <span style="color:var(--rtxt)">${cFail} sorunlu</span>`:''}</span>
        </div>
        <div style="height:8px;background:var(--bg);border-radius:5px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${cFail>0?'linear-gradient(90deg,#f59e0b,#ef4444)':'linear-gradient(90deg,#22c55e,#16a34a)'}"></div>
        </div>
      </div>`;
    });
    html+=`</div>`;
  }

  // BY MAHAL
  if(active.includes('byMahal')){
    html+=`<div class="ed-card" style="margin-bottom:14px"><p class="sec-label" style="margin-top:0">Mahal Durumu</p>`;
    S.mahals.forEach(m=>{
      const eqs=S.equips.filter(e=>e.mahalId===m.id);
      const mFail=eqs.filter(e=>getStatus(e)==='fail').length;
      html+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--brd)">
        <span style="font-size:13px;font-weight:600">${safe(m.name)}</span>
        <span style="font-size:12px">${mFail>0?`<span style="color:var(--rtxt);font-weight:700">⚠️ ${mFail} sorunlu</span>`:'<span style="color:var(--gtxt)">✅ Temiz</span>'} · ${eqs.length} ekipman</span>
      </div>`;
    });
    html+=`</div>`;
  }

  // TOP FAIL (arıza geçmişi analizi)
  if(active.includes('topFail')){
    const failCounts={};
    S.reports.filter(r=>r.result==='fail').forEach(r=>{
      failCounts[r.equipId]=(failCounts[r.equipId]||0)+1;
    });
    const ranked=Object.entries(failCounts).map(([id,cnt])=>({e:equipById(id),cnt})).filter(x=>x.e).sort((a,b)=>b.cnt-a.cnt).slice(0,8);
    html+=`<div class="ed-card" style="margin-bottom:14px"><p class="sec-label" style="margin-top:0">En Sorunlu Ekipmanlar (Arıza Geçmişi)</p>`;
    if(!ranked.length) html+=`<p style="font-size:13px;color:var(--txt3);padding:8px 0">Henüz uygunsuz rapor yok.</p>`;
    else ranked.forEach((x,i)=>{
      const cat=catById(x.e.cat);
      html+=`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--brd);cursor:pointer" onclick="openEquipDetail('${x.e.id}')">
        <span style="font-weight:800;color:var(--txt3);width:20px">${i+1}</span>
        <span style="font-size:18px">${cat.icon}</span>
        <div style="flex:1"><div style="font-size:13px;font-weight:600">${safe(x.e.name)}</div>
        <div style="font-size:11px;color:var(--txt3)">${mahalById(x.e.mahalId)?.name||''}</div></div>
        <span style="background:var(--rbg);color:var(--rtxt);padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700">${x.cnt}× arıza</span>
      </div>`;
    });
    html+=`</div>`;
  }

  // TIMELINE (aylık trend)
  if(active.includes('timeline')){
    const months={};
    S.reports.forEach(r=>{
      if(!r.createdAt) return;
      const d=new Date(r.createdAt);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months[key]=months[key]||{ok:0,fail:0};
      if(r.result==='ok') months[key].ok++; else if(r.result==='fail') months[key].fail++;
    });
    const sorted=Object.entries(months).sort().slice(-6);
    const maxV=Math.max(1,...sorted.map(([k,v])=>v.ok+v.fail));
    html+=`<div class="ed-card" style="margin-bottom:14px"><p class="sec-label" style="margin-top:0">Aylık Denetim Trendi (Son 6 Ay)</p>`;
    if(!sorted.length) html+=`<p style="font-size:13px;color:var(--txt3);padding:8px 0">Veri yok.</p>`;
    else {
      html+=`<div style="display:flex;align-items:flex-end;gap:8px;height:140px;padding:10px 0">`;
      sorted.forEach(([k,v])=>{
        const okH=Math.round(v.ok/maxV*110);
        const failH=Math.round(v.fail/maxV*110);
        const [y,mo]=k.split('-');
        const mn=['','Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'][+mo];
        html+=`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;height:100%;justify-content:flex-end">
          <div style="display:flex;flex-direction:column-reverse;gap:2px;width:100%;align-items:center">
            ${v.fail?`<div style="width:70%;height:${failH}px;background:#ef4444;border-radius:3px" title="${v.fail} uygunsuz"></div>`:''}
            ${v.ok?`<div style="width:70%;height:${okH}px;background:#22c55e;border-radius:3px" title="${v.ok} uygun"></div>`:''}
          </div>
          <span style="font-size:10px;color:var(--txt3)">${mn}</span>
        </div>`;
      });
      html+=`</div><div style="display:flex;gap:14px;justify-content:center;font-size:11px;color:var(--txt2)"><span>🟩 Uygun</span><span>🟥 Uygun Değil</span></div>`;
    }
    html+=`</div>`;
  }

  // DUE (denetim bekleyenler)
  if(active.includes('due')){
    const due=getDueEquips();
    html+=`<div class="ed-card" style="margin-bottom:14px"><p class="sec-label" style="margin-top:0">Denetim Bekleyenler (${due.length})</p>`;
    if(!due.length) html+=`<p style="font-size:13px;color:var(--gtxt);padding:8px 0">✅ Tüm denetimler güncel.</p>`;
    else due.slice(0,10).forEach(({e,st})=>{
      const cat=catById(e.cat);
      const lbl=st.state==='overdue'?`<span style="color:var(--rtxt);font-weight:700">${st.days} gün gecikmiş</span>`
               :st.state==='never'?`<span style="color:var(--otxt);font-weight:700">Hiç denetlenmedi</span>`
               :`<span style="color:var(--otxt)">${st.days} gün kaldı</span>`;
      html+=`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--brd);cursor:pointer" onclick="openEquipDetail('${e.id}')">
        <span style="font-size:18px">${cat.icon}</span>
        <div style="flex:1"><div style="font-size:13px;font-weight:600">${safe(e.name)}</div>
        <div style="font-size:11px;color:var(--txt3)">${mahalById(e.mahalId)?.name||''}</div></div>
        <span style="font-size:12px">${lbl}</span>
      </div>`;
    });
    html+=`</div>`;
  }

  // WORK ORDERS (açık iş emirleri)
  if(active.includes('workorders')){
    const open=(S.workOrders||[]).filter(w=>w.status!=='approved').sort((a,b)=>(b.ts||0)-(a.ts||0));
    html+=`<div class="ed-card" style="margin-bottom:14px"><p class="sec-label" style="margin-top:0">Açık İş Emirleri (${open.length})</p>`;
    if(!open.length) html+=`<p style="font-size:13px;color:var(--gtxt);padding:8px 0">✅ Açık iş emri yok.</p>`;
    else open.slice(0,8).forEach(w=>{
      const names=(w.assignees||[]).map(id=>{ const u=userById(id); return u?(u.fullname||u.username):'?'; }).join(', ');
      html+=`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--brd);cursor:pointer" onclick="openWorkOrderDetail('${w.id}')">
        <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(w.title)}</div>
        <div style="font-size:11px;color:var(--txt3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${names?('👤 '+safe(names)):'atanmadı'} · ${w.createdAt||''}</div></div>
        ${woStatusBadge(w.status)}
      </div>`;
    });
    html+=`</div>`;
  }

  el.innerHTML=html;
}

function openDashSettings(){
  const s=document.getElementById('dash-settings');
  if(s) s.style.display=s.style.display==='none'?'block':'none';
}
function toggleDashCard(id,checked){
  let cards=getDashCards();
  if(checked&&!cards.includes(id)) cards.push(id);
  if(!checked) cards=cards.filter(c=>c!==id);
  setDashCards(cards);
  renderDashboard();
  // Ayar panelini açık tut
  setTimeout(()=>{ const s=document.getElementById('dash-settings'); if(s) s.style.display='block'; },10);
}

/* ══════════════════════════════════════
   PROFİL
══════════════════════════════════════ */
function renderProfile(){
  const u=S.cur; if(!u) return;
  const myRpts=S.reports.filter(r=>r.by===(u.fullname||u.username));

  document.getElementById('profile-container').innerHTML=`
    <div class="ed-card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
        <div class="user-av" style="width:52px;height:52px;font-size:20px">${(u.fullname||u.username).charAt(0).toUpperCase()}</div>
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--txt)">${safe(u.fullname||u.username)}</div>
          <div style="font-size:12px;color:var(--txt2)">@${safe(u.username)}</div>
          <span class="role-badge rb-${u.role}" style="margin-top:6px;display:inline-block">${roleLabel(u.role)}</span>
        </div>
      </div>
      <div class="info-row"><span class="ir-key">Toplam Raporum</span><span class="ir-val">${myRpts.length}</span></div>
    </div>
    <div style="margin-bottom:14px">
      <button class="btn btn-secondary btn-full" onclick="openChangePw()">🔑 Şifremi Değiştir</button>
    </div>
    <div style="margin-bottom:14px">
      <button class="btn btn-primary btn-full" onclick="openInstallGuide()">📲 Uygulamayı Telefona İndir</button>
    </div>
    ${ROLE_LEVEL[u.role]>=3?`
    <div style="margin-bottom:14px">
      <button class="btn btn-primary btn-full" onclick="openDashboard()">📊 Analiz Paneli (Dashboard)</button>
    </div>`:''}
    ${canDo('manage_users')?`
    <p class="sec-label">👥 Kullanıcı Yönetimi</p>
    <div style="margin-bottom:10px"><button class="btn btn-accent btn-sm" id="btn-add-user-prof">+ Yeni Kullanıcı</button></div>
    <div id="user-list-prof"></div>
    <div class="divider"></div>`:''}
    ${isSuperAdmin()?`
    <p class="sec-label">📞 İletişim Bilgileri <span style="font-weight:400;text-transform:none;color:var(--txt3);font-size:11px">(tüm giriş ekranlarında görünür — global)</span></p>
    <div class="ed-card" style="margin-bottom:14px">
      <p style="font-size:12px;color:var(--txt2);margin-bottom:10px;line-height:1.5">QR okutan veya giriş ekranındaki kişiler bu bilgileri görür. Bu bilgiler TÜM şirketler için geçerlidir (süper admin geneli). Boş bırakırsanız görünmez.</p>
      <div class="form-group"><label class="form-label">TELEFON</label><input class="form-input" id="ci-tel" placeholder="Örn: 0532 123 45 67" value="${safe((S.contactInfo&&S.contactInfo.tel)||'')}"/></div>
      <div class="form-group"><label class="form-label">E-POSTA</label><input class="form-input" id="ci-mail" type="email" placeholder="ornek@firma.com" value="${safe((S.contactInfo&&S.contactInfo.mail)||'')}"/></div>
      <button class="btn btn-primary btn-sm" onclick="saveContactInfo()">💾 İletişim Bilgilerini Kaydet</button>
    </div>
    <div class="divider"></div>`:''}
    <p class="sec-label">Son Raporlarım</p>
    <div id="my-rpts"></div>
    ${isAdmin()?`
    <div class="divider"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <p class="sec-label" style="margin:0">📊 Son Aktiviteler</p>
      <button class="btn btn-secondary btn-sm" onclick="clearActivity()" style="font-size:11px;padding:4px 10px">🧹 Temizle</button>
    </div>
    <div class="ed-card" style="margin-bottom:14px" id="activity-list"></div>`:''}
    ${isAdmin()?`
    <div class="divider"></div>
    <p class="sec-label">🔐 Rol Yetkileri</p>
    <div class="ed-card" style="margin-bottom:14px">
      <p style="font-size:12.5px;color:var(--txt2);margin-bottom:12px;line-height:1.5">Her rolün varsayılan yetkilerini düzenle. (Kişiye özel yetki için kullanıcıyı düzenleyin.)</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${isSuperAdmin()?`<button class="btn btn-secondary btn-sm" onclick="openRolePerms('admin')">🛡️ Admin Yetkileri</button>`:''}
        <button class="btn btn-secondary btn-sm" onclick="openRolePerms('manager')">🧑‍💼 Yönetici Yetkileri</button>
        <button class="btn btn-secondary btn-sm" onclick="openRolePerms('inspector')">🔍 Denetçi Yetkileri</button>
        <button class="btn btn-secondary btn-sm" onclick="openRolePerms('viewer')">👁️ Görüntüleyici Yetkileri</button>
        ${Object.entries(S.customRoles||{}).map(([id,r])=>`<div style="display:flex;gap:6px"><button class="btn btn-secondary btn-sm" style="flex:1" onclick="openRolePerms('${id}')">🏷️ ${safe(r.label)} Yetkileri</button>${isSuperAdmin()?`<button class="btn btn-danger btn-sm" onclick="deleteCustomRole('${id}')" title="Rolü sil">🗑️</button>`:''}</div>`).join('')}
      </div>
      ${isSuperAdmin()?`<button class="btn btn-primary btn-sm btn-full" style="margin-top:10px" onclick="addCustomRole()">➕ Yeni Rol Ekle</button>`:''}
      ${isSuperAdmin()?'<p style="font-size:11px;color:var(--txt3);margin-top:10px;line-height:1.4">🛡️ Admin yetkilerini yalnızca süper admin düzenleyebilir. Süper admin her zaman tam yetkilidir, kısıtlanamaz.</p>':''}
    </div>`:''}
    ${isAdmin()?`
    <div class="divider"></div>
    <p class="sec-label">💾 Veri Yedekleme</p>
    <div class="ed-card" style="margin-bottom:14px">
      <p style="font-size:12.5px;color:var(--txt2);margin-bottom:12px;line-height:1.5">Tüm verileri (mahaller, ekipmanlar, raporlar, kullanıcılar) dosyaya indir veya yedekten geri yükle.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="backupData()">📥 Yedek İndir</button>
        <button class="btn btn-secondary btn-sm" onclick="triggerRestore()">📤 Geri Yükle</button>
      </div>
      <input type="file" id="restore-file-input" accept="application/json,.json" style="display:none"/>
    </div>
    ${isSuperAdmin()?`<p class="sec-label">🗓️ Veri Saklama Süreleri</p>
    <div class="ed-card" style="margin-bottom:14px;cursor:pointer" onclick="openRetentionPanel()">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="min-width:0">
          <div style="font-size:13.5px;font-weight:600;color:var(--txt)">Otomatik temizlik</div>
          <div style="font-size:11.5px;color:var(--txt3);margin-top:2px">Rapor ${getRetention().reports}g · Bildirim ${getRetention().notifications}g · Log ${getRetention().logs}g · İş Emri ${getRetention().workorders}g</div>
        </div>
        <span style="font-size:11px;color:var(--accent);font-weight:600;white-space:nowrap">⚙️ Ayarla</span>
      </div>
    </div>`:''}`:''}
    <div class="divider"></div>
    <button class="btn btn-danger btn-full" onclick="doLogout()">🚪 Çıkış Yap</button>`;

  // Kullanıcı listesi + ekleme: "Kullanıcı Yönetimi" bölümüyle (manage_users) tutarlı
  if(canDo('manage_users')){
    renderUserList();
    document.getElementById('btn-add-user-prof')?.addEventListener('click',openAddUser);
  }
  if(isAdmin()){
    renderCatManageList();
    document.getElementById('restore-file-input')?.addEventListener('change',handleRestoreFile);
    const actEl=document.getElementById('activity-list');
    if(actEl){
      const PER=10;
      // Süper admin işlemlerini sadece süper admin görür
      const visibleActs=S.activity.filter(a=>!a.bySuper || isSuperAdmin());
      const total=visibleActs.length;
      const pages=Math.ceil(total/PER)||1;
      if(S.pgActivity>pages) S.pgActivity=pages;
      if(S.pgActivity<1) S.pgActivity=1;
      const start=(S.pgActivity-1)*PER;
      const acts=visibleActs.slice(start, start+PER);
      const icons={inspect:'🔍',equip_add:'➕',equip_del:'🗑️',mahal_add:'🏨',mahal_del:'🗑️',report_del:'🗑️',user_del:'👤',user_add:'👤',user_pw:'🔑',cat_add:'🏷️',restore:'📤',role_perms:'🔐'};
      actEl.innerHTML=(acts.length?acts.map(a=>{
        const ic=icons[a.type]||'•';
        const extraHtml=a.extra==='ok'?'<span style="color:var(--gtxt);font-weight:700"> ✅</span>':a.extra==='fail'?'<span style="color:var(--rtxt);font-weight:700"> ❌</span>':'';
        return `<div class="activity-item">
        <div class="act-avatar">${(a.by||'?').charAt(0).toUpperCase()}</div>
        <div class="act-body"><div class="act-text">${ic} <strong>${safe(a.by)}</strong>: ${safe(a.desc)}${extraHtml}</div>
        <div class="act-time">${a.date}</div></div>
      </div>`;}).join(''):'<p style="font-size:13px;color:var(--txt3);padding:10px 0">Aktivite yok.</p>')
      +pagerHTML(total, S.pgActivity, PER, 'S.pgActivity=%P%;renderProfile()');
    }
  }

  const myRE=document.getElementById('my-rpts');
  if(!myRpts.length){ myRE.innerHTML=`<div class="empty-state" style="padding:16px 0"><p>Henüz rapor yok.</p></div>`; }
  else {
    myRE.innerHTML=myRpts.slice(0,6).map(r=>`
      <div class="report-row ${r.result}" data-rid="${r.id}">
        <div class="rr-info"><div class="rr-no">${r.id}</div>
          <div class="rr-name">${r.catIcon||''} ${safe(r.equipName)}</div>
          <div class="rr-meta">${r.date}</div></div>
        <span class="status-badge ${r.result==='ok'?'sb-ok':'sb-fail'}">${r.result==='ok'?'✅':'❌'}</span>
      </div>`).join('');
    myRE.querySelectorAll('.report-row').forEach(row=>row.addEventListener('click',()=>openReportDetail(row.dataset.rid)));
  }
}

