// Serviços: a Nuvem Serviços do Lab 3D, presa ao lado dos cartões. O progresso
// da seção escolhe a forma (∞ -> lupa -> janela -> faísca -> barras).
import { montarObjeto } from "./lab/runtime";
import { paletaDeHex } from "./lab/palettes";
import { nuvemServicos } from "./lab/objects/nuvem-servicos";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export async function montarNuvem(canvas: HTMLCanvasElement, secao: HTMLElement) {
  // a forma i aparece INTEIRA quando o cartão i gruda no topo: o motor fecha a
  // forma no fim de cada trecho, então progresso = i/(n-1) nesse instante.
  const cards = Array.from(secao.querySelectorAll<HTMLElement>(".stack .card"));
  let gruda: number[] = [];
  const pilha = secao.querySelector<HTMLElement>(".stack")!;
  const medir = () => {
    // posição de fluxo de cada cartão = topo da pilha + alturas + vãos. Não usa o
    // rect do cartão: com ele já grudado (link do menu pula direto) a conta erra.
    const gap = parseFloat(getComputedStyle(pilha).rowGap) || 0;
    let y = pilha.getBoundingClientRect().top + scrollY;
    gruda = cards.map((c) => {
      const g = y - parseFloat(getComputedStyle(c).top);
      y += c.offsetHeight + gap;
      return g;
    });
  };
  medir();
  addEventListener("resize", medir);
  const progresso = () => {
    const de = gruda[0];
    const ate = gruda[gruda.length - 1];
    return clamp01((scrollY - de) / Math.max(1, ate - de));
  };
  const h = montarObjeto(canvas, nuvemServicos, {
    paleta: paletaDeHex("#0059fc", "#00f2de"),
    modo: ["scroll", "mouse"],
    scrollSource: progresso,
    transparente: true,
    glow: false,
  });
  new IntersectionObserver((es) => h.pausar(!es[0].isIntersecting), { rootMargin: "100px" }).observe(secao);
  await h.pronto;
  return h;
}
