/* ══════════════════════════════════════
   KULLANICI CRUD
══════════════════════════════════════ */
function renderUserList(){
  const el=document.getElementById('user-list-prof'); if(!el) return;
  // Süper admin'i sadece süper admin görebilir
  const visible=S.users.filter(u=>!u.isSuper || isSuperAdmin());
  el.innerHTML=visible.map(u=>`
    <div class="user-card">
      <div class="user-av">${(u.fullname||u.username).charAt(0).toUpperCase()}</div>
      <div class="user-info">
        <div class="user-name">${safe(u.fullname||u.username)}${u.isSuper?' 👑':''}</div>
        <div class="user-uname">@${safe(u.username)}</div>
      </div>
      <span class="role-badge rb-${u.role}">${u.isSuper?'Süper Admin':roleLabel(u.role)}</span>
      <button class="btn btn-secondary btn-sm" onclick="openEditUser('${u.id}')">✏️</button>
    </div>`).join('');
}

let _rpRole=null, _rpPerms=null;
function openRolePerms(role){
  if(!isAdmin()) return;
  _rpRole=role;
  _rpPerms=[...getRolePerms(role)];
  document.getElementById('role-perms-title').textContent='🔐 '+roleLabel(role)+' Yetkileri';
  const el=document.getElementById('role-perms-list');
  el.innerHTML=PERM_DEFS.map(p=>`
    <label class="perm-item">
      <input type="checkbox" ${_rpPerms.includes(p.id)?'checked':''} onchange="toggleRpPerm('${p.id}',this.checked)"/>
      <div><div class="perm-label">${p.label}</div><div class="perm-desc">${p.desc}</div></div>
    </label>`).join('');
  openModal('modal-role-perms');
}
function toggleRpPerm(pid,on){
  if(on){ if(!_rpPerms.includes(pid)) _rpPerms.push(pid); }
  else { _rpPerms=_rpPerms.filter(x=>x!==pid); }
}
async function saveRolePerms(){
  if(!isAdmin()||!_rpRole) return;
  if(!S.rolePerms) S.rolePerms={};
  S.rolePerms[_rpRole]=_rpPerms;
  logActivity('role_perms', `${roleLabel(_rpRole)} rol yetkileri güncellendi`);
  try{ await save(); closeModal('modal-role-perms'); toast('✅ Rol yetkileri kaydedildi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* Yeni özel rol ekle (süper admin) */
async function addCustomRole(){
  if(!isSuperAdmin()){ toast('🔒 Sadece süper admin'); return; }
  const name=await promptDialog({title:'Yeni Rol',message:'Rol adı (örn: Teknisyen, Bölge Müdürü):',placeholder:'Rol adı',okText:'Devam'});
  if(name===null||!name.trim()){ return; }
  const label=name.trim();
  // id üret
  const id='role_'+Date.now().toString(36);
  // Yetki seviyesi sor (1=en düşük, 4=admin seviyesi)
  const lvlStr=await promptDialog({title:'Yetki Seviyesi',message:'Sıralama seviyesi (1=düşük … 4=yüksek). Sadece sıralama içindir, asıl yetkiler bir sonraki adımda seçilir:',value:'2',okText:'Oluştur'});
  if(lvlStr===null) return;
  let lvl=parseInt(lvlStr); if(isNaN(lvl)||lvl<1) lvl=2; if(lvl>4) lvl=4;
  if(!S.customRoles) S.customRoles={};
  S.customRoles[id]={label,level:lvl};
  if(!S.rolePerms) S.rolePerms={};
  S.rolePerms[id]=['inspect']; // varsayılan minimal yetki
  logActivity('role_perms', `"${label}" özel rolü eklendi`);
  try{
    await save();
    renderProfile();
    toast('✅ "'+label+'" rolü eklendi. Şimdi yetkilerini seç.');
    setTimeout(()=>openRolePerms(id), 400);
  }catch(e){ toast('❌ '+e.message,5000); }
}

/* Özel rol sil (süper admin) */
async function deleteCustomRole(roleId){
  if(!isSuperAdmin()){ toast('🔒 Sadece süper admin'); return; }
  const r=S.customRoles&&S.customRoles[roleId]; if(!r) return;
  // Bu rolde kullanıcı var mı?
  const inUse=S.users.filter(u=>u.role===roleId);
  if(inUse.length){
    toast(`⚠️ ${inUse.length} kullanıcı bu rolde. Önce onların rolünü değiştirin.`, 5000);
    return;
  }
  const ok=await confirmDialog({title:'Rolü Sil',message:`"${r.label}" rolü silinsin mi?`,okText:'Sil',danger:true});
  if(!ok) return;
  delete S.customRoles[roleId];
  if(S.rolePerms) delete S.rolePerms[roleId];
  logActivity('role_perms', `"${r.label}" özel rolü silindi`);
  try{ await save(); renderProfile(); toast('🗑️ Rol silindi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* Rol seçim dropdown'unu doldur (sabit + özel roller) */
function populateRoleSelect(selId, selected){
  const sel=document.getElementById(selId); if(!sel) return;
  sel.innerHTML=allRoles().map(r=>`<option value="${r.id}" ${r.id===selected?'selected':''}>${safe(r.label)}${r.custom?' (özel)':''}</option>`).join('');
}

function openAddUser(){
  S.editUserId=null;
  _uePerms=null; // yeni kullanıcı: rol varsayılanı kullanılır
  document.getElementById('user-edit-title').textContent='👤 Yeni Kullanıcı';
  ['ue-uname','ue-fname','ue-pass'].forEach(id=>document.getElementById(id).value='');
  populateRoleSelect('ue-role','inspector');
  document.getElementById('ue-role').value='inspector';
  const roleSel=document.getElementById('ue-role'); if(roleSel) roleSel.disabled=false;
  const permsGroup=document.getElementById('ue-perms-group'); if(permsGroup) permsGroup.style.display='';
  document.getElementById('btn-del-user').style.display='none';
  const h=document.getElementById('ue-pass-hint'); if(h) h.textContent='(zorunlu)';
  renderUePerms('inspector');
  openModal('modal-user-edit');
}

function openEditUser(id){
  S.editUserId=id;
  const u=userById(id); if(!u) return;
  // Süper admin'i sadece süper admin düzenleyebilir
  if(u.isSuper && !isSuperAdmin()){ toast('🔒 Süper admin hesabını yalnızca kendisi düzenleyebilir'); return; }
  _uePerms = (u.perms&&Array.isArray(u.perms)) ? [...u.perms] : null; // null = rol varsayılanı
  document.getElementById('user-edit-title').textContent=u.isSuper?'👑 Süper Admin':'✏️ Kullanıcıyı Düzenle';
  document.getElementById('ue-uname').value=u.username;
  document.getElementById('ue-fname').value=u.fullname||'';
  document.getElementById('ue-pass').value='';
  populateRoleSelect('ue-role',u.role);
  document.getElementById('ue-role').value=u.role;
  // Süper admin silinemez, rolü/yetkisi kısıtlanamaz
  document.getElementById('btn-del-user').style.display=(u.id!==S.cur?.id && !u.isSuper)?'':'none';
  const roleSel=document.getElementById('ue-role'); if(roleSel) roleSel.disabled=!!u.isSuper;
  const permsGroup=document.getElementById('ue-perms-group'); if(permsGroup) permsGroup.style.display=u.isSuper?'none':'';
  const h=document.getElementById('ue-pass-hint'); if(h) h.textContent='(değiştirmek için doldurun, boş bırakırsanız aynı kalır)';
  renderUePerms(u.role);
  openModal('modal-user-edit');
}

let _uePerms=null; // düzenlenen kullanıcının yetki listesi (null = rol varsayılanı)

/* Kullanıcı yetki checkbox'larını render et */
function renderUePerms(role){
  const el=document.getElementById('ue-perms'); if(!el) return;
  const group=document.getElementById('ue-perms-group');
  // Tüm roller için yetki seçimi görünür (admin dahil — kişiye özel kısıtlanabilir)
  if(group) group.style.display='';
  const active = _uePerms!==null ? _uePerms : getRolePerms(role);
  el.innerHTML=PERM_DEFS.map(p=>`
    <label class="perm-item">
      <input type="checkbox" ${active.includes(p.id)?'checked':''} onchange="toggleUePerm('${p.id}',this.checked)"/>
      <div><div class="perm-label">${p.label}</div><div class="perm-desc">${p.desc}</div></div>
    </label>`).join('');
}

function toggleUePerm(pid,on){
  // İlk değişiklikte rol varsayılanından kopya al
  if(_uePerms===null){ _uePerms=[...getRolePerms(document.getElementById('ue-role').value)]; }
  if(on){ if(!_uePerms.includes(pid)) _uePerms.push(pid); }
  else { _uePerms=_uePerms.filter(x=>x!==pid); }
}

function onUeRoleChange(){
  _uePerms=null; // rol değişti → o rolün varsayılanına dön
  renderUePerms(document.getElementById('ue-role').value);
}

async function saveUser(){
  if(!canDo('manage_users')){ toast('🚫 Yetkiniz yok'); return; }
  const uname=document.getElementById('ue-uname').value.trim();
  const fname=document.getElementById('ue-fname').value.trim();
  const pass =document.getElementById('ue-pass').value;
  const role =document.getElementById('ue-role').value;
  if(!uname){ toast('⚠️ Kullanıcı adı zorunlu'); return; }
  // Yetki yükseltme koruması: admin olmayan, admin rolü atayamaz ve admin/süper hesabı düzenleyemez
  if(!isAdmin()){
    if(role==='admin'){ toast('🚫 "Admin" rolü atama yetkiniz yok'); return; }
    const tgt=S.editUserId?userById(S.editUserId):null;
    if(tgt && (tgt.role==='admin'||tgt.isSuper)){ toast('🚫 Admin hesabını düzenleyemezsiniz'); return; }
  }
  if(S.editUserId){
    const u=userById(S.editUserId); if(!u) return;
    // Süper admin'i sadece süper admin düzenleyebilir, bayrağı/rolü korunur
    if(u.isSuper && !isSuperAdmin()){ toast('🔒 Süper admin yalnızca kendisi tarafından düzenlenebilir'); return; }
    u.username=uname; u.fullname=fname;
    if(u.isSuper){ u.role='admin'; u.isSuper=true; delete u.perms; } // süper admin sabit, tam yetki
    else {
      u.role=role;
      // Tüm roller (admin dahil) kişiye özel yetki taşıyabilir
      if(_uePerms!==null){ u.perms=_uePerms; }
      else { delete u.perms; }
    }
    if(pass.length>0){
      const err=checkPasswordStrength(pass);
      if(err){ toast('⚠️ '+err); return; }
      const hp=await hashPassword(pass);
      u.pwSalt=hp.salt; u.pwHash=hp.hash; u.mustChangePw=false;
      logActivity('user_pw', `"${u.fullname||u.username}" şifresi değiştirildi`);
    }
  } else {
    const err=checkPasswordStrength(pass);
    if(err){ toast('⚠️ '+err); return; }
    if(S.users.find(u=>u.username===uname)){ toast('⚠️ Bu kullanıcı adı bu şirkette alınmış'); return; }
    // Süper admin kullanıcı adıyla çakışma
    if(uname===SUPER_USERNAME){ toast('⚠️ Bu kullanıcı adı sistem tarafından kullanılıyor'); return; }
    // TÜM şirketlerde benzersizlik kontrolü (çakışma → giriş karışıklığı engellenir)
    const btn=document.querySelector('#modal-user-edit .btn-primary');
    if(btn){ btn.disabled=true; btn.textContent='Kontrol ediliyor…'; }
    const existing=await findUserAcrossCompanies(uname);
    if(btn){ btn.disabled=false; btn.textContent='Kaydet'; }
    if(existing){
      const cName=existing.companyName||'başka bir şirket';
      toast('⚠️ "'+uname+'" kullanıcı adı zaten alınmış ('+cName+'). Farklı bir ad seçin.', 5000);
      return;
    }
    const hp=await hashPassword(pass);
    const newU={id:'u'+Date.now(),username:uname,fullname:fname,role,pwSalt:hp.salt,pwHash:hp.hash,createdAt:nowStr()};
    if(_uePerms!==null) newU.perms=_uePerms;
    S.users.push(newU);
    logActivity('user_add', `"${fname||uname}" kullanıcısı eklendi (${roleLabel(role)})`);
  }
  try{ await save(); closeModal('modal-user-edit'); toast('✅ Kaydedildi'); if(S.page==='profile') renderProfile(); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* ── PROFİLDEN ŞİFRE DEĞİŞTİRME (herkes kendi) ── */
function openChangePw(){
  document.getElementById('cpw-old').value='';
  document.getElementById('cpw-new').value='';
  document.getElementById('cpw-new2').value='';
  openModal('modal-change-pw');
}

async function saveChangePw(){
  if(!S.cur){ return; }
  const oldPw =document.getElementById('cpw-old').value;
  const newPw =document.getElementById('cpw-new').value;
  const newPw2=document.getElementById('cpw-new2').value;

  // Mevcut şifre doğru mu?
  const ok=await verifyPassword(oldPw, S.cur);
  if(!ok){ toast('⚠️ Mevcut şifre yanlış'); return; }

  // Yeni şifre güç kontrolü
  const err=checkPasswordStrength(newPw);
  if(err){ toast('⚠️ '+err); return; }
  if(newPw!==newPw2){ toast('⚠️ Yeni şifreler eşleşmiyor'); return; }

  // Güncelle
  const hp=await hashPassword(newPw);
  const u=userById(S.cur.id);
  if(u){ u.pwSalt=hp.salt; u.pwHash=hp.hash; u.mustChangePw=false; S.cur=u; setSession(u); }
  logActivity('user_pw', `Kendi şifresini değiştirdi`);
  try{ await save(); closeModal('modal-change-pw'); toast('✅ Şifreniz değiştirildi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

async function deleteUser(){
  if(!canDo('manage_users')){ toast('🚫 Yetkiniz yok'); return; }
  const u=userById(S.editUserId); if(!u) return;
  if(u.isSuper){ toast('🔒 Süper admin hesabı silinemez'); return; }
  if(u.id===S.cur?.id){ toast('⚠️ Kendinizi silemezsiniz'); return; }
  if(!isAdmin() && u.role==='admin'){ toast('🚫 Admin hesabını silemezsiniz'); return; }
  if(!await confirmDialog({title:'Kullanıcı Silinsin mi?',message:`"${u.fullname||u.username}" kullanıcısı kalıcı olarak silinecek.`,danger:true,okText:'Evet, Sil'})) return;
  S.users=S.users.filter(x=>x.id!==S.editUserId);
  logActivity('user_del', `"${u.fullname||u.username}" kullanıcısı silindi`);
  try{ await save(); closeModal('modal-user-edit'); toast('🗑️ Silindi'); if(S.page==='profile') renderProfile(); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* ══════════════════════════════════════
   MAHAL CRUD
══════════════════════════════════════ */
function populateMahalSelects(){
  ['inp-equip-mahal','edit-equip-mahal'].forEach(id=>{
    const s=document.getElementById(id); if(!s) return;
    s.innerHTML=S.mahals.map(m=>`<option value="${m.id}">${safe(m.name)}</option>`).join('');
  });
}
function populateCatSelects(){
  ['inp-equip-cat','edit-equip-cat'].forEach(id=>{
    const s=document.getElementById(id); if(!s) return;
    let html=allCats().map(c=>`<option value="${c.id}">${c.icon} ${safe(c.name)}</option>`).join('');
    // Ekipman ekleme select'inde "Yeni Tür Ekle" seçeneği
    if(id==='inp-equip-cat') html+=`<option value="__new__">➕ Yeni Tür Ekle…</option>`;
    s.innerHTML=html;
  });
}

/* Mahal ikon seçici */
function renderMahalIconPicker(wrapId, selected){
  const wrap=document.getElementById(wrapId); if(!wrap) return;
  wrap.innerHTML=MAHAL_ICONS.map(ic=>`<button type="button" class="icon-opt${ic===selected?' active':''}" data-ic="${ic}">${ic}</button>`).join('');
  wrap.querySelectorAll('.icon-opt').forEach(b=>b.addEventListener('click',()=>{
    wrap.querySelectorAll('.icon-opt').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    if(wrapId==='add-mahal-icons') S.addMahalIcon=b.dataset.ic;
    else S.editMahalIcon=b.dataset.ic;
  }));
}

function openAddMahal(){
  document.getElementById('inp-mahal-name').value='';
  document.getElementById('inp-mahal-desc').value='';
  S.addMahalIcon=MAHAL_ICONS[0];
  renderMahalIconPicker('add-mahal-icons', S.addMahalIcon);
  openModal('modal-add-mahal');
}

async function saveMahal(){
  if(!canDo('add_mahal')){ toast('🚫 Yetkiniz yok'); return; }
  const name=document.getElementById('inp-mahal-name').value.trim();
  const desc=document.getElementById('inp-mahal-desc').value.trim();
  if(!name){ toast('⚠️ Mahal adı gerekli'); return; }
  S.mahals.push({id:mid(),name,desc,icon:S.addMahalIcon||MAHAL_ICONS[0],createdAt:nowStr()});
  logActivity('mahal_add',`"${name}" mahali eklendi`);
  try{
    await save(); populateMahalSelects(); closeModal('modal-add-mahal');
    document.getElementById('inp-mahal-name').value='';
    document.getElementById('inp-mahal-desc').value='';
    toast('🏨 Mahal eklendi');
  }catch(e){ toast('❌ '+e.message,5000); }
}

function openEditMahal(id){
  if(!canDo('add_mahal')){ toast('🚫 Yetkiniz yok'); return; }
  S.editMahalId=id;
  const m=mahalById(id); if(!m) return;
  document.getElementById('edit-mahal-name').value=m.name;
  document.getElementById('edit-mahal-desc').value=m.desc||'';
  S.editMahalIcon=m.icon||MAHAL_ICONS[0];
  renderMahalIconPicker('edit-mahal-icons', S.editMahalIcon);
  openModal('modal-edit-mahal');
}

async function saveEditMahal(){
  if(!canDo('add_mahal')){ toast('🚫 Yetkiniz yok'); return; }
  const m=mahalById(S.editMahalId); if(!m) return;
  const name=document.getElementById('edit-mahal-name').value.trim();
  if(!name){ toast('⚠️ Ad boş olamaz'); return; }
  m.name=name; m.desc=document.getElementById('edit-mahal-desc').value.trim();
  m.icon=S.editMahalIcon||m.icon||MAHAL_ICONS[0];
  try{ await save(); populateMahalSelects(); closeModal('modal-edit-mahal'); toast('✅ Güncellendi'); }
  catch(e){ toast('❌ '+e.message,5000); }
}

/* Mahali ekipmanlarıyla kopyala (raporlar hariç — temiz başlangıç) */
async function copyMahal(){
  if(!canDo('add_mahal')){ toast('🚫 Yetkiniz yok'); return; }
  const m=mahalById(S.editMahalId); if(!m) return;
  const srcEquips=S.equips.filter(e=>e.mahalId===m.id);
  const newName=await promptDialog({
    title:'Mahali Kopyala',
    message:`"${m.name}" mahali ${srcEquips.length} ekipmanıyla birlikte kopyalanacak (raporlar hariç). Yeni mahal adı:`,
    value:m.name+' (Kopya)', okText:'Kopyala'
  });
  if(newName===null) return;
  if(!newName.trim()){ toast('⚠️ Ad boş olamaz'); return; }
  // Yeni mahal
  const newMahalId=uid();
  S.mahals.push({id:newMahalId, name:newName.trim(), desc:m.desc||'', icon:m.icon||MAHAL_ICONS[0], createdAt:nowStr()});
  // Ekipmanları kopyala (form snapshot dahil, lastInsp sıfır)
  let count=0;
  srcEquips.forEach(e=>{
    S.equips.push({
      id:uid(), name:e.name, cat:e.cat, desc:e.desc||'', mahalId:newMahalId, imageUrl:e.imageUrl||'',
      form: e.form?JSON.parse(JSON.stringify(e.form)):getCatForm(e.cat),
      lastInsp:null, createdAt:nowStr(), createdBy:S.cur?.username||'admin'
    });
    count++;
  });
  logActivity('mahal_add', `"${newName}" mahali kopyalandı (${count} ekipman)`);
  try{
    await save();
    populateMahalSelects();
    closeModal('modal-edit-mahal');
    toast(`✅ "${newName}" oluşturuldu (${count} ekipman kopyalandı)`);
    renderCurrent();
  }catch(e){ toast('❌ '+e.message,5000); }
}

async function deleteMahal(){
  if(!canDo('del_mahal')){ toast('🚫 Yetkiniz yok'); return; }
  const m=mahalById(S.editMahalId); if(!m) return;
  if(!await confirmDialog({title:'Mahal Silinsin mi?',message:`"${m.name}" ve içindeki tüm ekipman/raporlar kalıcı olarak silinecek.`,danger:true,okText:'Evet, Sil'})) return;
  const delEquips=S.equips.filter(e=>e.mahalId===S.editMahalId);
  const ids=delEquips.map(e=>e.id);
  // Silinen ekipmanların belgeleri çöpe (dosyalar Storage'da sahipsiz kalmasın, 30 gün geri alınabilir)
  for(const e of delEquips){ for(const d of (e.documents||[])){ await trashDoc(d, 'Silinen mahal: '+(m.name||'')); } }
  S.equips  =S.equips.filter(e=>e.mahalId!==S.editMahalId);
  S.reports =S.reports.filter(r=>!ids.includes(r.equipId));
  S.mahals  =S.mahals.filter(x=>x.id!==S.editMahalId);
  logActivity('mahal_del', `"${m.name}" mahali silindi (${ids.length} ekipman)`);
  try{ await save(); populateMahalSelects(); closeModal('modal-edit-mahal'); toast('🗑️ Silindi'); showPage('home',false); }
  catch(e){ toast('❌ '+e.message,5000); }
}

