import "./styles/main.css";
import { ADS, DASH, INSTAGRAM, SITES, waLink } from "./config";

const doc = document.documentElement;
doc.classList.add("js");
const reduz = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T | null;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  Array.from(r.querySelectorAll(s)) as T[];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const suave = (t: number) => t * t * (3 - 2 * t);

/* ---------- links ---------- */
for (const a of $$<HTMLAnchorElement>("[data-wa]")) {
  a.href = waLink();
  a.target = "_blank";
  a.rel = "noopener";
}
for (const a of $$<HTMLAnchorElement>("[data-ig]")) {
  if (INSTAGRAM) {
    a.href = INSTAGRAM;
    a.target = "_blank";
    a.rel = "noopener";
  } else a.remove();
}

/* ---------- conteúdo vindo do config ---------- */
const rail = $("[data-ads-rail]");
if (rail) {
  rail.innerHTML = `<div class="ads__track">${ADS.map(
    (ad, i) => `
    <figure class="ad">
      <div class="ad__phone"><div class="ad__screen">
        ${ad.src ? `<img src="${ad.src}" alt="Criativo de anúncio: ${ad.segment}" loading="lazy" width="540" height="960" />` : `<span class="ad__ph">Criativo ${String(i + 1).padStart(2, "0")} · [A PREENCHER]</span>`}
      </div></div>
      <figcaption class="ad__cap"><b>${ad.src ? ad.segment : "[A PREENCHER: segmento]"}</b>${ad.meta}</figcaption>
    </figure>`
  ).join("")}</div>`;
}
const janela = (st: (typeof SITES)[number]) => `
    <figure class="win">
      <div class="win__frame">
        <div class="win__chrome" aria-hidden="true"><span class="win__dots"><i></i><i></i><i></i></span><span class="win__url"></span><span></span></div>
        <img src="/assets/sites/${st.slug}-sm.webp" alt="Site ${st.name}" loading="lazy" decoding="async" width="520" height="325" />
      </div>
      <figcaption class="win__cap"><b>${st.name}</b><span>${st.segment}</span></figcaption>
    </figure>`;
$$("[data-srow]").forEach((row, r) => {
  const inner = $(".srow__inner", row)!;
  inner.innerHTML = SITES.slice(r * 10, r * 10 + 10).map(janela).join("");
});

/* ---------- traço curvo: comprimento normalizado pra desenhar ---------- */
for (const p of $$<SVGPathElement>(".swash path")) p.setAttribute("pathLength", "1");

/* ---------- entrada no scroll (com reserva) ---------- */
const reveals = $$(".reveal");
const io = new IntersectionObserver(
  (es) => {
    for (const e of es) {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    }
  },
  { rootMargin: "0px 0px -12% 0px" }
);
reveals.forEach((el) => io.observe(el));
// reserva: se por algum motivo o observer não disparar, nada fica invisível
setTimeout(() => {
  for (const el of reveals) {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) el.classList.add("is-in");
  }
}, 2500);

/* ---------- faixas infinitas: copias até cobrir 2x a largura, número par ---------- */
function duplicar(row: HTMLElement, inner: HTMLElement) {
  const base = inner.innerHTML;
  let n = 1;
  while (inner.scrollWidth < row.clientWidth * 2.2 && n < 12) {
    inner.insertAdjacentHTML("beforeend", base);
    n++;
  }
  if (n % 2) {
    inner.insertAdjacentHTML("beforeend", base);
    n++;
  }
  const filhos = Array.from(inner.children);
  filhos.forEach((el, i) => {
    if (i >= filhos.length / n) {
      el.setAttribute("aria-hidden", "true");
      el.querySelectorAll("img").forEach((img) => (img.alt = ""));
    }
  });
}
for (const row of $$("[data-marquee]")) duplicar(row, $(".marquee__inner", row)!);
for (const row of $$("[data-srow]")) duplicar(row, $(".srow__inner", row)!);
if (rail) duplicar(rail, $(".ads__track", rail)!);

/* ---------- painel: abas, contadores e gráfico ---------- */
type Dados = (typeof DASH)["meta"];
const dash = $("[data-dash]");
const fmtR = (v: number, dec = 0) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtN = (v: number) => Math.round(v).toLocaleString("pt-BR");
let atual: Dados = DASH.meta;
let mostrado = { invest: 0, conv: 0, cpc: 0, ret: 0, serie: DASH.meta.serie.map(() => 0) };

function caminho(serie: number[]) {
  const max = 70;
  const pts = serie.map((v, i) => [(i / (serie.length - 1)) * 600, 170 - (v / max) * 150] as const);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
  }
  return { linha: d, area: `${d} L600 180 L0 180 Z` };
}
function pintarPainel(v: typeof mostrado) {
  if (!dash) return;
  $("[data-kpi=invest]", dash)!.textContent = fmtR(v.invest);
  $("[data-kpi=conv]", dash)!.textContent = fmtN(v.conv);
  $("[data-kpi=cpc]", dash)!.textContent = fmtR(v.cpc, 2);
  $("[data-kpi=ret]", dash)!.textContent = fmtR(v.ret);
  const c = caminho(v.serie);
  $(".dash__line", dash)!.setAttribute("d", c.linha);
  $(".dash__area", dash)!.setAttribute("d", c.area);
}
function animarPara(alvo: Dados, dur = 1300) {
  const de = { ...mostrado, serie: [...mostrado.serie] };
  const t0 = performance.now();
  const passo = (now: number) => {
    const k = reduz ? 1 : suave(clamp01((now - t0) / dur));
    mostrado = {
      invest: de.invest + (alvo.invest - de.invest) * k,
      conv: de.conv + (alvo.conv - de.conv) * k,
      cpc: de.cpc + (alvo.cpc - de.cpc) * k,
      ret: de.ret + (alvo.ret - de.ret) * k,
      serie: de.serie.map((s, i) => s + (alvo.serie[i] - s) * k),
    };
    pintarPainel(mostrado);
    if (k < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}
if (dash) {
  pintarPainel(mostrado);
  let auto: number | undefined;
  let tocou = false;
  const tabs = $$<HTMLButtonElement>("[data-tab]", dash);
  const escolher = (id: "meta" | "google") => {
    tabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === id)));
    atual = DASH[id];
    animarPara(atual, 900);
  };
  tabs.forEach((b) =>
    b.addEventListener("click", () => {
      tocou = true;
      clearInterval(auto);
      escolher(b.dataset.tab as "meta" | "google");
    })
  );
  new IntersectionObserver(
    (es) => {
      for (const e of es) {
        if (e.isIntersecting) {
          if (mostrado.invest === 0) animarPara(atual);
          if (!tocou && !reduz && auto === undefined)
            auto = window.setInterval(() => escolher(atual === DASH.meta ? "google" : "meta"), 5200);
        } else if (auto !== undefined) {
          clearInterval(auto);
          auto = undefined;
        }
      }
    },
    { threshold: 0.35 }
  ).observe(dash);
}

/* ---------- motor de scroll: um rAF lê o scroll e atualiza tudo ---------- */
const nav = $("[data-nav]");
const orbit = $("[data-orbit]");
const beats = $$("[data-beat]");
const bar = $("[data-orbit-bar]");
const cards = $$(".stack .card");
const steps = $$(".step");
const stepsPath = $<SVGPathElement>("[data-steps-path]");
const stepsSvg = stepsPath?.ownerSVGElement ?? null;
const desktop = matchMedia("(min-width: 961px)");

let progressoOrbita = 0;
let aoProgresso: ((k: number) => void) | null = null;
export function ouvirOrbita(fn: (k: number) => void) {
  aoProgresso = fn;
  fn(progressoOrbita);
}

let geo = { orbitTop: 0, orbitH: 0 };
function medir() {
  const y = scrollY;
  if (orbit) {
    const r = orbit.getBoundingClientRect();
    geo.orbitTop = r.top + y;
    geo.orbitH = r.height;
  }
  if (stepsPath && stepsSvg && steps.length) {
    const h = stepsSvg.getBoundingClientRect().height;
    stepsSvg.setAttribute("viewBox", `0 0 2 ${h}`);
    const first = steps[0].offsetTop + 10;
    const last = steps[steps.length - 1].offsetTop + 10;
    stepsPath.setAttribute("d", `M1 ${first} L1 ${last}`);
    stepsPath.setAttribute("pathLength", "1");
    stepsPath.style.strokeDasharray = "1";
  }
}

let ultimoY = -1;
function quadro() {
  const y = scrollY;
  if (y !== ultimoY) {
    ultimoY = y;
    nav?.classList.toggle("is-scrolled", y > 30);

    // órbita: progresso da seção fixada
    if (orbit && geo.orbitH) {
      const p = clamp01((y - geo.orbitTop) / (geo.orbitH - innerHeight));
      progressoOrbita = p;
      const idx = p < 0.16 ? 0 : p < 0.4 ? 1 : p < 0.64 ? 2 : 3;
      beats.forEach((b) => b.classList.toggle("is-on", Number(b.dataset.beat) === idx));
      if (bar) bar.style.transform = `scaleX(${p})`;
      aoProgresso?.(p);
    }

    // serviços: o cartão de baixo empurra o de cima pra trás
    for (let i = 0; i < cards.length - 1; i++) {
      const prox = cards[i + 1].getBoundingClientRect().top;
      const topo = parseFloat(getComputedStyle(cards[i + 1]).top);
      const coberto = clamp01(1 - (prox - topo) / (innerHeight * 0.55));
      cards[i].style.transform = coberto > 0 ? `scale(${1 - coberto * 0.05})` : "";
      cards[i].style.setProperty("--dim", String(coberto * 0.55));
    }

    // processo: a linha desce e acende as etapas
    if (stepsPath && steps.length) {
      const r = stepsSvg!.getBoundingClientRect();
      const linha = innerHeight * 0.62;
      const first = steps[0].offsetTop + 10;
      const last = steps[steps.length - 1].offsetTop + 10;
      const k = clamp01((linha - r.top - first) / (last - first));
      stepsPath.style.strokeDashoffset = String(1 - k);
      steps.forEach((s) => s.classList.toggle("is-lit", s.getBoundingClientRect().top + 10 < linha));
    }
  }
  requestAnimationFrame(quadro);
}

medir();
quadro();
addEventListener("resize", () => {
  medir();
  ultimoY = -1;
});
document.fonts?.ready.then(() => {
  medir();
  ultimoY = -1;
});

/* ---------- depois do load: céu, scroll suave e 3D (fora do caminho do LCP) ---------- */
function depoisDoLoad(fn: () => void) {
  if (document.readyState === "complete") fn();
  else addEventListener("load", fn, { once: true });
}
depoisDoLoad(() => {
  medir();
  ultimoY = -1;
  import("./sky").then((m) => m.ceu($<HTMLCanvasElement>(".sky")!, reduz));
  if (!reduz) {
    import("lenis").then(({ default: Lenis }) => {
      const lenis = new Lenis({ lerp: 0.11, smoothWheel: true });
      const raf = (t: number) => {
        lenis.raf(t);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
      for (const a of $$<HTMLAnchorElement>('a[href^="#"]')) {
        a.addEventListener("click", (e) => {
          const id = a.getAttribute("href")!;
          const alvo = id === "#topo" ? 0 : $(id);
          if (alvo === null) return;
          e.preventDefault();
          lenis.scrollTo(alvo as HTMLElement | number, { offset: -70 });
        });
      }
    });
  }
  const canvas = $<HTMLCanvasElement>("[data-orbit-canvas]");
  const labels = $("[data-orbit-labels]");
  if (canvas && labels && orbit) {
    const ir = () =>
      import("./3d/hero3d")
        .then((m) => m.montarOrbita(canvas, labels))
        .then((h) => {
          if (!h) return;
          orbit.classList.add("is-live");
          ouvirOrbita((p) => h.progresso(p));
        })
        .catch((err) => console.warn("3D indisponível, fica o pôster", err));
    // celular: espera um pouco ou o primeiro toque; computador: sobe logo após o load
    if (desktop.matches) ir();
    else {
      let foi = false;
      const uma = () => {
        if (foi) return;
        foi = true;
        ir();
      };
      setTimeout(uma, 2500);
      addEventListener("touchstart", uma, { once: true, passive: true });
      addEventListener("scroll", uma, { once: true, passive: true });
    }
  }
});
