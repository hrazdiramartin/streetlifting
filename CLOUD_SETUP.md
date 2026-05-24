# Návod: Google Drive sync + hosting na GitHub Pages

Tahle příručka tě provede:
1. **Vytvoření Google OAuth Client ID** (pro Drive sync)
2. **Nahrání appky na GitHub Pages** (veřejně dostupná URL pro PC i mobil)
3. **Propojení** (dosadit Client ID, ověřit že vše funguje)

---

## Část 1: GitHub Pages (~10 minut)

> **Proč nejdřív GitHub Pages?** Drive sync potřebuje OAuth, který funguje jen z domény (ne `file://`). Hosting potřebujeme nejdřív.

### 1.1 Vytvoř GitHub účet (pokud nemáš)
Jdi na <https://github.com> → "Sign up" → vyplň jméno + email + heslo.

### 1.2 Vytvoř nový repozitář
1. Na GitHubu vpravo nahoře klikni **`+` → "New repository"**
2. **Repository name:** `streetlifting` (nebo cokoli)
3. **Visibility:** **Public** (důležité pro Pages zdarma)
4. **Initialize:** nech vše prázdné
5. Klikni **"Create repository"**

### 1.3 Nahraj kód
Otevři PowerShell ve složce `C:\Users\hrazd\Desktop\StreetLifting`:

```powershell
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TVÉ_JMENO/streetlifting.git
git push -u origin main
```

> Místo `TVÉ_JMENO` dej své GitHub uživatelské jméno.
> První push se zeptá na přihlášení — projdi browser flow.

### 1.4 Zapni GitHub Pages
1. V repozitáři jdi do **Settings** (nahoře vpravo)
2. Vlevo dole klikni **"Pages"**
3. V "Source" vyber: **Deploy from a branch**
4. Branch: **main**, folder: **/ (root)**
5. Klikni **Save**

Po ~2 minutách bude aplikace dostupná na:
```
https://TVÉ_JMENO.github.io/streetlifting/
```

Tu URL si zapamatuj — budeš ji potřebovat v dalším kroku.

---

## Část 2: Google Cloud Console (~5 minut)

### 2.1 Vytvoř projekt
1. Jdi na <https://console.cloud.google.com>
2. Přihlas se Google účtem (stejným, na kterém chceš mít data)
3. Vpravo nahoře klikni **dropdown projektu → "New Project"**
4. **Project name:** `Streetlifting` (cokoli)
5. **Create**

### 2.2 Aktivuj Google Drive API
1. V menu vlevo: **APIs & Services → Library**
2. Najdi **Google Drive API** → klikni na něj → **Enable**

### 2.3 OAuth consent screen
1. V menu vlevo: **APIs & Services → OAuth consent screen**
2. **User Type:** External → **Create**
3. **App name:** Streetlifting
4. **User support email:** tvůj email
5. **Developer contact:** tvůj email
6. **Save and Continue** přes všechny kroky
7. V kroku **Scopes** → "Add or Remove Scopes" → vyhledej `drive.appdata` → vyber `auth/drive.appdata` → Update → Save
8. V kroku **Test users** → Add Users → přidej **tvůj Google email** (s tímhle účtem se budeš přihlašovat)
9. **Save and Continue → Back to Dashboard**

### 2.4 OAuth Client ID
1. V menu vlevo: **APIs & Services → Credentials**
2. Nahoře **+ CREATE CREDENTIALS → OAuth client ID**
3. **Application type:** Web application
4. **Name:** Streetlifting Web
5. **Authorized JavaScript origins** → ADD URI:
   - `https://TVÉ_JMENO.github.io` (z kroku 1.4 — jen origin, bez `/streetlifting/`)
   - volitelně: `http://localhost:8765` (pro lokální testování)
6. **Create**

Otevře se modal s **Client ID** — vypadá takhle:
```
123456789012-abc1234567890.apps.googleusercontent.com
```

**Zkopíruj ho** — budeš ho potřebovat v dalším kroku.

---

## Část 3: Propojení (~2 minuty)

### 3.1 Dosaď Client ID do kódu
Otevři **`js/cloud-sync.js`** a najdi řádek:

```js
CLIENT_ID: 'TVOJE_CLIENT_ID.apps.googleusercontent.com',
```

Nahraď `TVOJE_CLIENT_ID.apps.googleusercontent.com` Client IDčkem z kroku 2.4:

```js
CLIENT_ID: '123456789012-abc1234567890.apps.googleusercontent.com',
```

### 3.2 Push změnu na GitHub
```powershell
git add js/cloud-sync.js
git commit -m "Add Drive Client ID"
git push
```

GitHub Pages auto-deployne během minuty.

### 3.3 Otevři appku v prohlížeči
Jdi na `https://TVÉ_JMENO.github.io/streetlifting/` (z kroku 1.4).

### 3.4 Připoj Google Drive
1. **Profil → Google Drive synchronizace → Připojit Google Drive**
2. Otevře se Google permission popup → vyber svůj účet → "Continue"
3. Schval přístup k **App Data Folder** → done
4. Badge se změní na **"připojeno"** (zelený)

**Hotovo!** 🎉

---

## Jak to teď funguje

- **Auto-sync při změně**: každá změna (záznam tréninku, váhy, PR…) se uloží na Drive po 3 s (debounce).
- **Polling z jiných zařízení**: každou minutu se zkontroluje, zda nepřišly změny z mobilu/jiného PC.
- **Při startu**: pokud je vzdálená verze novější, lokální data se přepíší a stránka se obnoví.
- **Offline**: appka funguje bez netu, sync proběhne až bude online.
- **Soukromí**: data jsou v Drive **appDataFolder** — skrytá složka kterou nikdo (ani ty z UI Drive) nevidí, jen tahle appka.

## Použití na mobilu

1. Otevři Chrome (Android) nebo Safari (iPhone)
2. Jdi na `https://TVÉ_JMENO.github.io/streetlifting/`
3. **Přidej na plochu** (Safari: ikona Share → Add to Home Screen / Chrome: ⋮ → Add to Home Screen)
4. Otevři z plochy → **Profil → Připojit Google Drive** stejným účtem
5. Data se okamžitě stáhnou z Drive

## Problémy?

**"Access blocked: This app's request is invalid"**
→ V Google Cloud Console zkontroluj že `https://TVÉ_JMENO.github.io` je v **Authorized JavaScript origins** (bez koncového lomítka).

**"Error 403: access_denied"**
→ V OAuth consent screen → Test users přidej svůj email.

**Data se nesynchronizují**
→ Otevři DevTools (F12) → Console — uvidíš případnou chybu z Drive API.

**Chci sync vypnout dočasně**
→ Profil → Odpojit. Lokální data zůstanou, jen se přestanou synchronizovat.

## Bezpečnost

- OAuth token žije v `sessionStorage` (po zavření tabu zmizí, příště se obnoví automaticky pokud Google session ještě platí).
- Žádná hesla nikde neukládáme.
- Data v Drive `appDataFolder` jsou viditelná **pouze této appce** — žádná jiná appka ani web k nim přístup nemá.
- Pro maximální izolaci: vytvoř si na to nový Google účet.
