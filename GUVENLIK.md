# TakipEt — Güvenlik Notları ve Öneriler

> Bu dosya canlı sisteme dokunmaz; Firebase Console'da uygulanacak öneriler için referanstır.
> Değişiklikleri **Console'da uygula → login + kaydet + yedek/geri-yükle test et → sorun olursa Console kural geçmişinden geri al.**

## Mimari gerçek (neden tek bir kural yetmez)
- Firebase yalnızca **anonim** kimlik veriyor (`signInAnonymously`). Firebase ziyaretçinin **hangi şirkete/kullanıcıya** ait olduğunu bilmiyor.
- Login (`findUserAcrossCompanies`) eşleşme için **tüm şirketlerin** kullanıcı listesini okuyor → okuma izni geniş olmak zorunda.
- Şifre doğrulaması istemcide yapılıyor → hash'ler istemciye okunabilir olmak zorunda.
- **Sonuç:** Gerçek tenant izolasyonu + hash gizleme + aynı-tenant kurcalamayı engelleme **backend (Cloud Function ile sunucu-taraflı giriş + custom claim)** gerektirir. Bu büyük bir iş (README "gelecek").

## Katman 1 — App Check ENFORCEMENT (EN ÖNEMLİ, risksiz, kod değişmez)
Kod zaten App Check'i reCAPTCHA ile etkinleştiriyor (`firebase.appCheck(app).activate(...)`, app.js ~1010).
Firebase Console → **App Check** → **Realtime Database** ve **Storage** için **"Enforce"** (zorunlu kıl) açık olmalı.
- Açıksa: yalnızca geçerli App Check token'ı taşıyan istekler (gerçek uygulama) geçer. F12/curl/dış script ile doğrudan DB erişimi **engellenir**.
- Bu, anonim-auth açığının pratikteki en büyük korumasıdır. Önce bunu doğrula/aç.

## Katman 2 — Kuralları sıkılaştırma (test ederek)
### Realtime Database (kök yazımını engelle — toptan silmeyi zorlaştırır)
```json
{
  "rules": {
    "takipet": {
      ".read": "auth != null",
      "companies":     { ".read": "auth != null", ".write": "auth != null" },
      "data":          { ".read": "auth != null", ".write": "auth != null" },
      "superadmin":    { ".read": "auth != null", ".write": "auth != null" },
      "superlogs":     { ".read": "auth != null", ".write": "auth != null" },
      "globalContact": { ".read": "auth != null", ".write": "auth != null" },
      "globalCats":    { ".read": "auth != null", ".write": "auth != null" },
      "globalDocs":    { ".read": "auth != null", ".write": "auth != null" },
      "errorLogs":     { ".read": "auth != null", ".write": "auth != null" },
      "backups":       { ".read": "auth != null", ".write": "auth != null" }
    }
  }
}
```
Fark: kökte `.write` YOK → `ref('takipet').set(null)` (her şeyi tek komutla silme) reddedilir.
Kök `.read` duruyor çünkü `backupSystem` kök düğümü okuyor. **Not:** `takipet/data` hâlâ toptan yazılabilir (sistem geri-yükleme bunu gerektiriyor) — tam koruma Katman 3 ister.

### Storage (mevcut kural korunur — README'de teyit edilmiş)
`belgeler/{allPaths=**}` altı auth!=null read/delete + write max 3MB (pdf/image). Diğer her yer kapalı.

## Katman 3 — Gerçek izolasyon (backend, büyük iş)
- Cloud Function ile **sunucu-taraflı login** → kullanıcının `companyId`'sini **custom claim** olarak token'a koy.
- Kurallar: `data/$cid` yalnızca `auth.token.companyId === $cid` olana açılır; super admin ayrı claim.
- Hash'ler artık istemciye okunmaz; login fonksiyonu doğrular.
- Gerçek 03:00 yedek + push bildirim de bu Cloud Function altyapısıyla gelir.
