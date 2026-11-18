// Liest "News" und "Landes-News" von der öffentlichen edupool-Startseite (Standort 26)
// und schreibt sie nach news.json. Läuft im GitHub-Workflow .github/workflows/seite-veroeffentlichen.yml.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const START = process.env.NEWS_START || 'https://hessen.edupool.de/home?standort=26';
const ZIEL = process.argv[2] || 'news.json';

// Wird im Browser auf der edupool-Seite ausgeführt
function auslesen() {
  const bereiche = [
    ['news_kategorie_news', 'News'],
    ['news_kategorie_themen', 'Landes-News'],
  ];
  const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  return bereiche.map(([klasse, titel]) => {
    const area = document.querySelector('.slider_area.' + klasse);
    const eintraege = area ? [...area.querySelectorAll('.swiper-slide')].map(s => {
      const oc = s.getAttribute('data-onclick') || '';
      const id = (oc.match(/id=(\d+)/) || [])[1];
      let bild = s.querySelector('.media-image img')?.getAttribute('src') || '';
      if (/DUMMY-EMPTY/i.test(bild)) bild = '';
      return {
        id,
        datum: text(s.querySelector('.newsdate')),
        titel: text(s.querySelector('h4')),
        text: text(s.querySelector('.sildertext')),
        bild,
      };
    }).filter(e => e.id && e.titel) : [];
    return { titel, eintraege };
  });
}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
try {
  const page = await browser.newPage({ locale: 'de-DE' });
  await page.goto(START, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.slider_area .swiper-slide', { timeout: 60000 });
  await page.waitForTimeout(1500);
  const bereiche = await page.evaluate(auslesen);
  const anzahl = bereiche.reduce((n, b) => n + b.eintraege.length, 0);
  if (!anzahl) throw new Error('Keine News gefunden – Aufbau der edupool-Seite geändert?');
  writeFileSync(ZIEL, JSON.stringify({ abgerufen: new Date().toISOString(), bereiche }, null, 1));
  console.log(`news.json geschrieben: ${bereiche.map(b => `${b.titel} ${b.eintraege.length}`).join(', ')}`);
} finally {
  await browser.close();
}
