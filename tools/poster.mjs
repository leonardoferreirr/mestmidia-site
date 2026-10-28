// Gera o pôster do hero com o PRÓPRIO 3D (fundo transparente), pra a troca
// pôster -> canvas não dar salto. Uma versão por formato de tela.
// uso: node tools/poster.mjs (com o dev rodando na 5340)
import { chromium } from "/Users/Leonardo/dev/agencia-ia-escritorio/node_modules/playwright/index.mjs";
import { execFileSync } from "node:child_process";

const alvos = [
  { nome: "orbit-poster", w: 1440, h: 900 },
  { nome: "orbit-poster-m", w: 390, h: 844 },
];
const browser = await chromium.launch({
  executablePath:
    process.env.HOME +
    "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
for (const a of alvos) {
  const ctx = await browser.newContext({ viewport: { width: a.w, height: a.h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto("http://localhost:5340/", { waitUntil: "load" });
  await page.evaluate(() => window.dispatchEvent(new Event("touchstart")));
  await page.waitForSelector(".orbit.is-live", { timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.addStyleTag({
    content: `.sky,.orbit__labels,.orbit__poster,.nav,.orbit__titles,.orbit__side,.orbit__progress{opacity:0!important;transition:none!important}
      .orbit__titles *,.orbit__side *{opacity:0!important}
      html,body{background:#000!important}`,
  });
  await page.waitForTimeout(300);
  const el = await page.$(".orbit__scene");
  const png = `/tmp/${a.nome}.png`;
  await el.screenshot({ path: png }); // fundo preto: no site o pôster usa mix-blend-mode: screen
  execFileSync("magick", [png, "-resize", "50%", "-quality", "82", `public/assets/${a.nome}.webp`]);
  console.log(a.nome, "ok");
  await ctx.close();
}
await browser.close();
