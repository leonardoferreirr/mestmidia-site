// Hero: o Sistema Orbital do Lab 3D. O progresso da seção fixada vira o
// progresso da transformação (sistema -> gráfico). Os nomes dos planetas são
// HTML por cima do canvas, projetados das âncoras a cada frame.
import { montarObjeto } from "./lab/runtime";
import { paletaDeHex } from "./lab/palettes";
import { sistemaOrbital } from "./lab/objects/sistema-orbital";
import { LOGOS } from "./logos";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

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
  // celular: renderizar em 3x de densidade é GPU queimando sem diferença visível
  // num disco de partículas; 1.5x no celular e 2x no computador
  const dpr = devicePixelRatio || 1;
  h.scene.getEngine().setHardwareScalingLevel(1 / Math.min(dpr, matchMedia("(max-width: 960px)").matches ? 1.5 : 2));

  // por planeta: o SELO (logo do canal, do tamanho do planeta na tela) e o
  // RÓTULO (nome, some na transformação). O selo acompanha o planeta até ele
  // virar ponto do gráfico: a linha passa a ligar as logos.
  const celular = matchMedia("(max-width: 960px)");
  // cache do último valor escrito: com 13 selos + rótulos, reescrever estilo
  // igual a cada frame é recálculo de estilo à toa (pesa no celular)
  type Item = { selo?: HTMLElement; rot: HTMLElement; so?: string; sz?: string; ro?: string };
  const itens = new Map<string, Item>();
  for (const a of h.ancoras()) {
    const rot = document.createElement("span");
    rot.className = a.id === "empresa" ? "olabel olabel--sun" : "olabel";
    rot.textContent = a.nome;
    let selo: HTMLElement | undefined;
    if (LOGOS[a.id]) {
      selo = document.createElement("span");
      selo.className = "oseal";
      selo.innerHTML = LOGOS[a.id];
      camada.appendChild(selo);
    }
    camada.appendChild(rot);
    itens.set(a.id, { selo, rot });
  }
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  h.scene.onAfterRenderObservable.add(() => {
    const w = canvas.clientWidth;
    const cel = celular.matches;
    // o selo tem tamanho fixo no CSS (o MAX) e encolhe por scale: mexer em
    // width/height a cada frame forçava layout da camada inteira
    const [MIN, MAX] = cel ? [20, 34] : [28, 52];
    const lista = h.ancoras();
    const sol = lista.find((a) => a.id === "empresa");
    const solC = sol?.centro ? h.projetar(sol.centro) : null;
    const solR = sol && solC ? dist(solC, h.projetar(sol.pos)) : 0;
    const cam = h.scene.activeCamera?.globalPosition;
    for (const a of lista) {
      const it = itens.get(a.id);
      if (!it) continue;
      const topo = h.projetar(a.pos);
      let yRot = topo.y;
      let x = topo.x;
      if (it.selo && a.centro) {
        const c = h.projetar(a.centro);
        const tam = Math.min(MAX, Math.max(MIN, dist(c, topo) * 2.3));
        // atrás do sol = escondido (o selo é HTML e ficaria por cima dele):
        // mais longe da câmera que o sol E dentro do disco dele na tela
        const atras =
          !!sol?.centro && !!solC && !!cam &&
          Vector3.Distance(cam, a.centro) > Vector3.Distance(cam, sol.centro) &&
          dist(c, solC) < solR + tam * 0.35;
        it.selo.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${(tam / MAX).toFixed(3)})`;
        const so = atras ? "0" : (0.72 + 0.28 * (a.frente ?? 1)).toFixed(2);
        if (so !== it.so) it.selo.style.opacity = it.so = so;
        const sz = String(Math.round((a.frente ?? 1) * 10));
        if (sz !== it.sz) it.selo.style.zIndex = it.sz = sz;
        x = c.x;
        yRot = c.y - tam / 2;
      }
      const minVis = cel ? 0.7 : 0;
      const vis = a.visivel < minVis && a.id !== "empresa" ? 0 : a.visivel;
      if (vis < 0.02) {
        if (it.ro !== "0") it.rot.style.opacity = it.ro = "0";
        continue;
      }
      const xr = Math.min(w - 40, Math.max(40, x));
      it.rot.style.transform = `translate3d(${xr.toFixed(1)}px, ${yRot.toFixed(1)}px, 0) translate(-50%, calc(-100% - 5px))`;
      const ro = vis.toFixed(2);
      if (ro !== it.ro) it.rot.style.opacity = it.ro = ro;
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
