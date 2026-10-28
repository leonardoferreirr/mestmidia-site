// Hero: o Sistema Orbital do Lab 3D. O progresso da seção fixada vira o
// progresso da transformação (sistema -> gráfico). Os nomes dos planetas são
// HTML por cima do canvas, projetados das âncoras a cada frame.
import { montarObjeto } from "./lab/runtime";
import { paletaDeHex } from "./lab/palettes";
import { sistemaOrbital } from "./lab/objects/sistema-orbital";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** trecho do progresso da seção em que o sistema vira gráfico */
const MORPH_DE = 0.34;
const MORPH_ATE = 0.86;

export async function montarOrbita(canvas: HTMLCanvasElement, camada: HTMLElement) {
  let alvo = 0;
  const h = montarObjeto(canvas, sistemaOrbital, {
    paleta: paletaDeHex("#0059fc", "#00f2de"),
    modo: ["auto", "mouse"], // NÃO "scroll": as órbitas parariam
    explosao: "scroll",
    scrollSource: () => alvo,
    transparente: true,
  });

  // rótulos: um elemento por âncora, criado uma vez
  const celular = matchMedia("(max-width: 960px)");
  const rotulos = new Map<string, HTMLElement>();
  for (const a of h.ancoras()) {
    const el = document.createElement("span");
    el.className = a.id === "empresa" ? "olabel olabel--sun" : "olabel";
    el.textContent = a.nome;
    camada.appendChild(el);
    rotulos.set(a.id, el);
  }
  h.scene.onAfterRenderObservable.add(() => {
    const w = canvas.clientWidth;
    const minVis = celular.matches ? 0.7 : 0;
    for (const a of h.ancoras()) {
      const el = rotulos.get(a.id);
      if (!el) continue;
      const vis = a.visivel < minVis && a.id !== "empresa" ? 0 : a.visivel;
      if (vis < 0.02) {
        el.style.opacity = "0";
        continue;
      }
      const p = h.projetar(a.pos);
      // não deixa o rótulo sair pela lateral do canvas
      const x = Math.min(w - 40, Math.max(40, p.x));
      el.style.transform = `translate3d(${x}px, ${p.y}px, 0) translate(-50%, calc(-100% - 6px))`;
      el.style.opacity = String(vis);
    }
  });

  // só renderiza com a seção na tela
  const secao = canvas.closest("[data-orbit]");
  if (secao) {
    new IntersectionObserver((es) => h.pausar(!es[0].isIntersecting), { rootMargin: "80px" }).observe(secao);
  }

  await h.pronto;
  return {
    /** p = progresso 0..1 da seção fixada inteira */
    progresso(p: number) {
      alvo = clamp01((p - MORPH_DE) / (MORPH_ATE - MORPH_DE));
    },
  };
}
