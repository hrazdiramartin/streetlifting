# Streetlifting Tracker

Osobní streetlifting tréninková aplikace pro Martina. Statický web bez frameworků,
funguje na PC i mobilu, data se ukládají lokálně v prohlížeči.

## Co umí

- **Dashboard** — dnešní trénink, aktuální blok, tělesná váha, rychlé akce
- **Trénink** — záznam tréninků (cvik, série, opak., váha, RPE, rest, poznámky)
- **Plán** — bloky 5–7 týdnů, plánování budoucích tréninků podle dní
- **Statistiky** — dlouhodobé grafy 4 hlavních cviků (Shyby, Dipy, Muscle ups, Dřepy),
  estimovaný 1RM, týdenní objem, heatmapa konzistence
- **Profil** — tělesná váha (záznamy + grafy), export/import dat (JSON), nastavení

## Spuštění

### Možnost 1: Otevřít přímo v prohlížeči
Stačí dvojklikem otevřít `index.html` v Chrome / Edge / Firefox.

### Možnost 2: Lokální HTTP server (doporučeno)
Z příkazové řádky (PowerShell), ve složce projektu:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Pak otevři v prohlížeči: http://localhost:8765/

## Synchronizace mezi zařízeními

Data jsou uložena v `localStorage` prohlížeče (lokálně, neodchází nikam).

**Pro sync mezi PC a mobilem:**
1. Na PC: **Profil → Exportovat JSON** → uloží zálohu
2. Pošli si soubor (e-mail, cloud, USB, ...)
3. Na mobilu: **Profil → Importovat JSON** → načte data

## Struktura projektu

```
StreetLifting/
├─ index.html         # Dashboard
├─ training.html      # Záznam tréninku
├─ plan.html          # Bloky a týdny
├─ stats.html         # Statistiky a grafy
├─ profile.html       # Profil, váha, nastavení
├─ css/main.css       # Design system
├─ js/
│  ├─ data.js         # localStorage + datové API
│  ├─ app.js          # Sdílené UI (navigace, modaly, toasty)
│  ├─ seed.js         # Martinovy bloky z Notion (první spuštění)
│  ├─ dashboard.js
│  ├─ training.js
│  ├─ plan.js
│  ├─ stats.js
│  └─ profile.js
└─ serve.ps1          # Lokální HTTP server (PowerShell)
```

## Tech stack

- Pure HTML / CSS / JS — bez build procesu
- [Chart.js](https://www.chartjs.org/) — grafy (z CDN)
- Inter + Cormorant Garamond fonts (Google Fonts)
- localStorage pro perzistenci

## Design

Tmavé téma, teplé tóny (espresso / amber / terracotta). Mobile-first responsivní.
Spodní navigace na mobilu, horní lišta na desktopu.

## Datový model

**Workout** — záznam jednoho tréninku
```js
{
  id, date, type,           // type: 'Bodyweight Intensity' atd.
  block_id, week_number,    // přiřazení k bloku
  exercises: [
    { name, sets, reps, weight, rpe, rest, note }
  ],
  notes,
  created_at, updated_at
}
```

**Block** — 5-7 týdenní tréninkový blok
```js
{
  id, name, type,           // type: volume/strength/hypertrophy/peaking
  start_date, end_date,
  weeks: [
    { number, start_date, end_date, is_deload,
      planned_workouts: [{ day, type }] }
  ]
}
```

**BodyWeight** — záznam tělesné váhy
```js
{ date, weight, note }
```
