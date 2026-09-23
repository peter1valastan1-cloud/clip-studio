# Clipstudio

Funkčné lokálne MVP na skladanie vlastných videí do vertikálneho MP4. Slovenské rozhranie, drag & drop, zmena poradia myšou aj tlačidlami, výber úsekov, hudba a titulok.

## Spustenie

Potrebujete **Node.js 22 alebo 24 LTS**, npm a internet pri prvej inštalácii.

```sh
npm install
npm run dev
```

Otvorte **http://127.0.0.1:3000**. V PowerShelli môžete použiť `npm.cmd`, ak systém blokuje `npm.ps1`.

FFmpeg a FFprobe sa nainštalujú s balíčkami `ffmpeg-static` a `ffprobe-static`. Inštalácia sťahuje binárne súbory; sieť musí povoľovať npm a GitHub. Pre inú platformu alebo vlastnú verziu nastavte absolútne cesty `FFMPEG_PATH` a `FFPROBE_PATH` v `.env.local`. FFmpeg musí obsahovať libx264 a AAC. Text sa rasterizuje cez Sharp, takže filter drawtext nie je potrebný.

Produkčné lokálne spustenie:

```sh
npm run build
npm start
```

## Použitie

1. Nahrajte 1–12 vlastných videí. Najistejšie funguje MP4 s H.264; MOV/WebM závisia aj od podpory prehliadača. Jeden súbor max. 250 MB, video 0,5 s až 10 minút, všetky vstupy v UI max. 490 MB vrátane hudby (serverový limit 500 MB vrátane formulára).
2. Presuňte klipy do správneho poradia alebo použite šípky. Kliknutím na klip otvoríte náhľad a trim. Začiatok/koniec upravíte číselne alebo posuvníkmi.
3. Vyberte maximálnu dĺžku 15, 30, 60 sekúnd alebo Celé (max. 120 s). Zvoľte tempo a kliknite na **Vytvoriť automatický strih**. Funguje aj s jediným dlhým videom. Výsledné úseky môžete upraviť alebo vrátiť späť pred ďalšou úpravou projektu. Bez automatického strihu sa pri prekročení limitu použijú skrátené stredové úseky.
4. Vyberte prechod, farebný vzhľad, grafický rám a štýl titulku. Pridajte titulok do 80 znakov a vlastnú hudbu. Hudba sa opakuje do dĺžky výstupu, na konci stíši a mieša s pôvodným zvukom. Pôvodný zvuk možno vypnúť. Maximálna veľkosť hudby v UI je 100 MB.
5. Exportujte. Po dokončení je dostupný prehrávač finálneho videa aj odkaz na stiahnutie MP4. Pracovný náhľad prehráva iba vybraný klip a približnú polohu titulku; hudbu, prechody a presný vzhľad titulku overíte v hotovom exporte.

### Automatický strih, prechody a grafika

- **Tempo:** dynamické (~1,5 s), vyvážené (~3 s), pokojné (~5 s). Vybraná dĺžka sa rozdelí medzi zdrojové videá; z ich aktuálne zvoleného rozsahu sa vyberú neprekrývajúce sa, rovnomerne rozložené úseky. Zdroje sa striedajú, chronológia v každom zdroji zostáva zachovaná. Najviac 48 úsekov z 12 videí; pri limite sa úseky predĺžia. Dĺžky sú približné, lebo algoritmus využije dostupný čas bez vytvárania príliš krátkych zvyškov.
- **Rozsah automatizácie:** ide o rytmický strih podľa časov, nie AI hodnotenie scén, detekciu reči či strih podľa úderov hudby. Pri opakovaní sa použije rozsah od najskoršieho začiatku po najneskorší koniec úsekov každého zdroja. Môže teda znovu vybrať medzery medzi predchádzajúcimi úsekmi. Krátke vstupy nenadstavuje.
- **6 prechodov:** priamy strih, stmavenie, biely záblesk, prelínanie, stieranie doľava, posun doľava. Stmavenie/záblesk majú max. 0,25 s na okrajoch. Prelínanie/stieranie/posun prekrývajú susedné klipy o 0,2 s a krížovo prelínajú zvuk. Tým skracujú celkovú dĺžku; zobrazené trvanie už zahŕňa prekrytie. Pri jedinom úseku sa prekrytie nepoužije.
- **6 farebných vzhľadov:** originál, teplý, studený, čiernobiely, živé farby, vintage.
- **Grafika:** bez rámu / biely / limetkový / rohové značky; titulok na tmavej karte, čistý text alebo farebný pás. Vzhľad a grafika platia pre celý zostrih.
- **Náhľad:** vybraný klip, približné farby, rám a titulok. Prechody, hudbu a presnú grafiku ukazuje až hotový export. Snímkové zaokrúhľovanie môže mierne zmeniť trvanie.

Automatické úseky používajú spoločné zdroje: každé pôvodné video sa na server odošle iba raz, aj keď sa v zostrihu vyskytuje viackrát. API používa `clips[].sourceIndex` ako index multipart videa (od nuly); bez neho zachováva pôvodné mapovanie podľa poradia. Voliteľné polia `look`, `frame`, `titleStyle` majú predvolené hodnoty `none`, `none`, `classic`.

### Širokouhlé videá

Môžete miešať širokouhlé aj vertikálne videá. Pri nahratí širokouhlého klipu sa automaticky zvolí **Zachovať celý záber**. Celé video sa vycentruje bez natiahnutia a bez orezania, voľný priestor vyplní zväčšená rozmazaná kópia záberu. Pod náhľadom je pre každý klip samostatná voľba **Zobrazenie klipu**:

- **Zachovať celý záber** — celý obraz s rozmazaným pozadím; náhľad ukazuje rovnaké rozloženie, intenzita rozmazania sa môže od exportu mierne líšiť.
- **Orezať na 9:16** — vyplnenie celého rámu stredovým orezaním, pri ktorom sa môžu stratiť okraje. Predvolené pre vertikálne klipy.

Voľba sa prenáša do exportu individuálne cez `clips[].framing` (`fit` alebo `crop`). Staršie API požiadavky bez tejto hodnoty zachovávajú stredový orez. Orientáciu telefónneho videa pri spracovaní zohľadňuje FFmpeg; pomer pixelov sa pred zmenou veľkosti normalizuje.

Export zostáva **vertikálny 1080 × 1920, 30 FPS, H.264 / yuv420p, AAC 48 kHz stereo**, faststart. Trvanie sa môže líšiť približne o snímku v dôsledku časovania a AAC.

## Architektúra a voľba stacku

- **React 19 + Next.js App Router + TypeScript**: responzívny editor, lokálne blob náhľady, Node.js route handlers.
- **Serverové FFmpeg**: spoľahlivejšie pre 1080p video ako ffmpeg.wasm, menšie nároky na pamäť prehliadača a bez nutnosti cross-origin isolation. Vyžaduje bežiaci Node proces a disk; tento projekt nie je statický web ani edge/serverless funkcia.
- **Busboy**: streamovaný multipart upload na disk, bez načítania všetkých videí do pamäte.
- **FFprobe** overuje skutočné video/audio streamy. **Sharp** pripravuje priehľadný PNG titulok so slovenskou diakritikou. Používa systémové fonty (Arial/DejaVu Sans); na minimálnom Linuxe doinštalujte `fonts-dejavu-core`. Emoji a exotické písma závisia od systému.
- Jeden export naraz v jednom Node procese. Klipy sa normalizujú postupne, potom spoja a finálne zakódujú s hudbou/titulkom. Stav exportu je v súbore a klient ho kontroluje každých 1,5 s.

### Súbory a API

| Cesta | Účel |
|---|---|
| `app/page.tsx`, `app/globals.css` | Editor a vzhľad |
| `lib/plan.mjs` | Zdieľaný výpočet úsekov |
| `lib/editing.mjs` | Automatický strih, prechody a farebné vzhľady |
| `lib/media.mjs` | Bezshellové spúšťanie FFmpeg/FFprobe |
| `lib/jobs.mjs` | Render, stav exportu a čistenie |
| `POST /api/exports` | Multipart: `manifest`, opakované `video`, voliteľné `music`; odpoveď 202 s `id` |
| `GET /api/exports/:id` | Stav, priebeh a chyba |
| `GET /api/exports/:id/download` | MP4; `?preview=1` na prehrávanie, podpora Range |

Medzisúbory sa ukladajú do `.data/<náhodné UUID>` (možno zmeniť cez `DATA_DIR`). Vstupy a pracovné médiá sa odstránia po dokončení alebo chybe exportu. Výsledky staršie než 24 hodín sa odstraňujú pri nasledujúcom exporte; nejde o presnú časovú garanciu vymazania. Dáta neopúšťajú počítač/server, kde projekt beží. Fonty rozhrania sa voliteľne načítavajú z Google Fonts; bez internetu sa použije systémový font.

## Testy

```sh
npm test
npm run build
```

So spusteným serverom v druhom termináli:

```sh
npm run test:integration
```

Integračný test sám vytvorí farebné video a syntetickú hudbu, odošle upload cez HTTP a overí všetkých šesť prechodov vrátane sedemúsekového prelínania zo zdieľaných zdrojov. Kontroluje nemý klip, mix hudby, stlmenie, slovenský titulok so špeciálnymi znakmi, rám, čiernobiely filter, zachovanie širokého obrazu, kodeky, rozlíšenie, trvanie a čiastočné sťahovanie. Jednotkové testy overujú aj tempo, striedanie zdrojov, hranice trimu a limit 48 úsekov. Test nepoužíva žiadny cudzí obsah. `TEST_URL` prepíše adresu testovaného servera.

## Hranice MVP

Lokálny nástroj pre jedného používateľa. Projekt nemá prihlásenie, trvalé uloženie projektu, obnovu rozpracovaného renderu po reštarte, zrušenie renderu ani distribuovanú frontu. Nezatvárajte server počas exportu; každý proces FFmpeg má limit 20 minút. Obnovenie stránky zahodí editor, hotový súbor zostáva do čistenia na disku. Percentá exportu zodpovedajú fázam, nie presnému času do dokončenia.

Server je štandardne viazaný na localhost. Pred verejným nasadením doplňte autentifikáciu, vlastníctvo exportov (UUID nie je autorizácia), per-user limity, izolované pracovné procesy/kontajner bez siete, trvalú job frontu, plánované čistenie a obmedzenia CPU/disku. Kontrola Origin a obmedzené FFmpeg protokoly sú základná ochrana lokálneho MVP, nie úplný sandbox na nedôveryhodné médiá. Na verejné nasadenie použite Node server/VPS s FFmpeg workermi; serverless a Sites/Cloudflare Workers nemôžu priamo spúšťať tento natívny FFmpeg pipeline.

Žiadne prihlasovanie do Instagramu, scraping, sťahovanie cez Instagram URL ani obchádzanie ochrany. Aplikácia pracuje iba s nahranými súbormi, na ktoré má používateľ oprávnenie.

Referencie: [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [FFmpeg filtre](https://ffmpeg.org/ffmpeg-filters.html). Verzie použitých balíčkov sú uzamknuté v `package-lock.json`. Pri ďalšom vývoji skontrolujte aj licencie distribúcie FFmpeg a použitých médií/fontov.
