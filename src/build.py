#!/usr/bin/env python3
"""
TakipEt — Tek Dosya Build Script
================================
Kaynak dosyaları (app.js + style.css + qrcode-generator.js) tek bir index.html
içine inline eder. Çıktı: dist/index.html (GitHub Pages'e deploy edilecek tek dosya).

Kullanım:
    python build.py

Build sonrası ZORUNLU kontrol:
    node --check app.js     (syntax hatası var mı)
"""
import re, json, base64, os, sys

# Windows konsolu (cp1254) emoji basamaz; çıktıyı UTF-8'e zorla.
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.dirname(os.path.abspath(__file__))

def read(name):
    with open(os.path.join(ROOT, name), encoding='utf-8') as f:
        return f.read()

def main():
    # 1) Kaynakları oku
    css  = read('style.css')
    qr   = read('qrcode-generator.js')
    app  = read('app.js')
    html = read('index.html')
    icons = json.loads(read('icons.json'))

    # 2) İkonları base64 data-uri yap
    apple = f"data:image/png;base64,{icons['apple']}"
    i192  = f"data:image/png;base64,{icons['fav192']}"
    i512  = f"data:image/png;base64,{icons['fav512']}"
    i32   = f"data:image/png;base64,{icons['fav32']}"

    # 3) Manifest (PWA)
    manifest = {
        "name": "TakipEt — Denetim Sistemi",
        "short_name": "TakipEt",
        "start_url": "./", "scope": "./",
        "display": "standalone", "orientation": "portrait",
        "background_color": "#F5F7FA", "theme_color": "#F5F7FA",
        "icons": [
            {"src": i192, "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
            {"src": i512, "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
        ],
    }
    manifest_uri = f"data:application/manifest+json;base64,{base64.b64encode(json.dumps(manifest).encode()).decode()}"

    # 4) index.html body'sini al, içindeki <script> etiketlerini temizle
    body = html
    if '<body>' in body:
        body = re.search(r'<body>(.*?)</body>', body, re.DOTALL).group(1)
    body = re.sub(r'<script[^>]*>.*?</script>', '', body, flags=re.DOTALL)

    icon_head = f'''<link rel="icon" type="image/png" sizes="32x32" href="{i32}"/>
<link rel="icon" type="image/png" sizes="192x192" href="{i192}"/>
<link rel="apple-touch-icon" sizes="180x180" href="{apple}"/>
<link rel="apple-touch-icon" href="{apple}"/>
<link rel="manifest" href="{manifest_uri}"/>'''

    # 5) Birleştir
    out = f'''<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no,viewport-fit=cover"/>
<meta name="theme-color" content="#F5F7FA" media="(prefers-color-scheme: light)"/>
<meta name="theme-color" content="#0D1117" media="(prefers-color-scheme: dark)"/>
<meta name="theme-color" content="#F5F7FA" id="meta-theme-color"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="default"/>
<meta name="apple-mobile-web-app-title" content="TakipEt"/>
<meta name="mobile-web-app-capable" content="yes"/>
<title>TakipEt — Denetim Sistemi</title>
{icon_head}
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-check-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js"></script>
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<style>
{css}
</style>
</head>
<body>
{body}
<script>
{qr}
</script>
<script>
{app}
</script>
</body>
</html>'''

    # 6) Repo köküne index.html olarak yaz (src/ üst dizini = repo kökü).
    #    Pages bu kök index.html'i yayınlar; src/ içindeki kaynaklar versiyonlanır.
    repo_root = os.path.dirname(ROOT)          # .../takipet/src -> .../takipet
    out_path = os.path.join(repo_root, 'index.html')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(out)

    kb = len(out) // 1024
    print(f"✅ BUILD TAMAM: index.html ({kb} KB) -> repo kökü")
    print("")
    print("Sonraki adım:")
    print("  1) node --check src/app.js   → syntax kontrolü")
    print("  2) git add -A && git commit && git push → GitHub Pages'e deploy")

if __name__ == '__main__':
    main()
