# Overenie MVP

Overené 16. 9. 2026 na Windows, Node.js 24.

- Produkčný Next.js build a TypeScript: úspešné.
- Deväť testov plánovania a automatického strihu: úspešné. Pokrývajú rozdelenie jedného videa, striedanie zdrojov, neprekrývanie, tempo, opakovanie a limit 48 úsekov.
- Skutočný FFmpeg export cez HTTP pre všetkých šesť prechodov: úspešné. Overený MP4, H.264, AAC, 1080 × 1920 a očakávaná dĺžka vrátane prekrytia. Sedemúsekové prelínanie zo zdieľaných zdrojov overuje aj spájanie vo viacerých dávkach.
- Grafika: export s teplým, studeným, čiernobielym a vintage vzhľadom; pixelové kontroly limetkového rámu a čiernobieleho obrazu; čistý titulok a farebný pás.
- Ovládanie automatického strihu v prehliadači: dva vstupy rozdelené na štyri úseky, vrátenie na pôvodné dva vstupy, následný automatický strih a export s grafikou.
- Vstupy testu: horizontálne video so zvukom, vertikálne video bez zvuku, rôzne snímkové frekvencie, vlastná syntetická hudba. Overený trim, automatické skrátenie, stlmenie, titulok so slovenskou diakritikou a znakmi `% <`.
- Stiahnutie hotového súboru a HTTP Range pre prehrávač: úspešné.
- Neplatný upload a požiadavka z cudzieho Origin: odmietnuté.
- V prehliadači overené nahratie súboru, načítanie jeho dĺžky, ručný trim 0,5–3,5 s, vloženie titulku a dokončenie exportu s odkazom na MP4.
- Rozšírenie pre širokouhlé videá: export zmiešaných horizontálnych/vertikálnych klipov, zachovanie celého záberu s pozadím aj pôvodný stredový orez. Test kontroluje pixely ľavého a pravého okraja v reálne exportovanej snímke a štvorcový pomer pixelov, aby odhalil nežiaduce orezanie.
- npm audit po aktualizácii Sharp: 0 hlásených zraniteľností v npm závislostiach. Toto nenahrádza audit natívnych FFmpeg binárnych súborov ani bezpečnostné posúdenie verejného nasadenia.

Výkon pri maximálnych 500 MB/12 zdrojoch/48 úsekoch a všetky kombinácie zariadení/kodekov neboli záťažovo testované. Limity lokálneho MVP a postup pre verejné nasadenie sú popísané v README.
