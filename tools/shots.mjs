// Capturas por posição de scroll num Chromium próprio (nunca o Chrome do Leonardo).
// uso: node tools/shots.mjs <url> <largura> <altura> <saida> <y1,y2,...|seletor;seletor>
import { chromium } from "/Users/Leonardo/dev/agencia-ia-escritorio/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";

const [url = "http://localhost:5340/", w = "1440", h = "900", out = "docs/shots", alvos = "0"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.HOME +
    "/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({
  viewport: { width: +w, height: +h },
  deviceScaleFactor: 1,
  isMobile: +w < 700,
  hasTouch: +w < 700,
});
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));
page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
await page.goto(url, { waitUntil: "load" });
await page.waitForTimeout(3500);
const lista = alvos.split(alvos.includes(";") ? ";" : ",");
for (const [i, a] of lista.entries()) {
  await page.evaluate((a) => {
    const y = /^[\d.]+$/.test(a) ? +a : document.querySelector(a).getBoundingClientRect().top + scrollY;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, y);
  }, a);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${out}/${w}-${String(i).padStart(2, "0")}.jpg`, type: "jpeg", quality: 70 });
}
console.log(JSON.stringify({ erros, altura: await page.evaluate(() => document.documentElement.scrollHeight) }));
await browser.close();
