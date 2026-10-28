// NUVEM SERVIÇOS
// A nuvem que muda de forma a cada serviço de uma agência de tráfego, dirigida
// pelo scroll: infinito (Meta) -> lupa (busca no Google) -> janela (site) ->
// faísca (criativo) -> barras (dados). Fica presa ao lado dos cartões que
// empilham, e cada cartão que sobe troca a forma.
//
// Todas as formas usam o mesmo N e cobrem o índice inteiro (regra do motor): a
// partícula 37 existe nas cinco, então o morph é só interpolar a posição dela.
// Cada forma reparte o índice em pedaços (anel e cabo da lupa, barra 1..5) por
// FRAÇÃO de i/n, nunca por contagem fixa: assim nenhuma partícula sobra na origem.

import type { Scene } from "@babylonjs/core/scene";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Objeto3D, Paleta } from "../types";
import { criarNuvem, type Forma } from "./_nuvem";

const TAU = Math.PI * 2;
const AUREO = Math.PI * (3 - Math.sqrt(5));
/** ruído determinístico por índice: espessura sem sortear a cada frame */
const h = (i: number, s: number) => {
  const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** lemniscata de Bernoulli com espessura de tubo: o "∞" do Meta */
const infinito: Forma = {
  nome: "infinito",
  pos: (i, n, out: Vector3) => {
    const t = (i / n) * TAU;
    const s = Math.sin(t);
    const d = 1 + s * s;
    const a = 2.5;
    const v = i * AUREO;
    const r = 0.26 * (0.4 + 0.6 * h(i, 1));
    out.set((a * Math.cos(t)) / d, (a * s * Math.cos(t)) / d + Math.sin(v) * r, Math.cos(v) * r);
  },
};

/** lupa: anel (busca) + cabo na diagonal */
const lupa: Forma = {
  nome: "lupa",
  pos: (i, n, out: Vector3) => {
    const f = i / n;
    const v = i * AUREO;
    if (f < 0.74) {
      const u = (f / 0.74) * TAU * 5;
      const R = 1.35;
      const r = 0.2 * (0.4 + 0.6 * h(i, 2));
      out.set(-0.45 + (R + r * Math.cos(v)) * Math.cos(u), 0.45 + (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v));
    } else {
      const k = (f - 0.74) / 0.26; // ao longo do cabo
      const L = 0.55 + k * 1.55;
      const r = 0.24 * Math.sqrt(h(i, 3));
      const c = Math.SQRT1_2;
      out.set(-0.45 + c * (1.35 + L) + Math.cos(v) * r * c, 0.45 - c * (1.35 + L) + Math.cos(v) * r * c, Math.sin(v) * r);
    }
  },
};

/** janela de navegador: moldura, barra de endereço e blocos de conteúdo */
const janela: Forma = {
  nome: "janela",
  pos: (i, n, out: Vector3) => {
    const f = i / n;
    const W = 2.6;
    const H = 1.75;
    const z = (h(i, 4) - 0.5) * 0.12;
    if (f < 0.42) {
      // moldura: perímetro
      const p = (f / 0.42) * (2 * W + 2 * H) * 2;
      let x: number, y: number;
      if (p < 2 * W) [x, y] = [-W + p, H];
      else if (p < 2 * W + 2 * H) [x, y] = [W, H - (p - 2 * W)];
      else if (p < 4 * W + 2 * H) [x, y] = [W - (p - 2 * W - 2 * H), -H];
      else [x, y] = [-W, -H + (p - 4 * W - 2 * H)];
      out.set(x, y, z);
    } else if (f < 0.58) {
      // barra do topo
      out.set(-W + h(i, 5) * 2 * W, H - 0.22 - h(i, 6) * 0.28, z);
    } else if (f < 0.8) {
      // título grande
      out.set(-W + 0.35 + h(i, 7) * 2.6, 0.55 - h(i, 8) * 0.55, z);
    } else {
      // botão
      out.set(-W + 0.35 + h(i, 9) * 1.3, -0.65 - h(i, 10) * 0.4, z);
    }
  },
};

/** faísca de 4 pontas (astroide preenchida): o "criativo" */
const faisca: Forma = {
  nome: "faisca",
  pos: (i, n, out: Vector3) => {
    const th = i * AUREO * 3;
    const k = Math.pow(h(i, 11), 0.35); // mais denso na borda
    const R = 2.5;
    const c = Math.cos(th);
    const s = Math.sin(th);
    out.set(R * k * c * c * c, R * k * s * s * s, (h(i, 12) - 0.5) * 0.25 * (1 - k));
  },
};

/** cinco barras crescendo: os dados */
const barras: Forma = {
  nome: "barras",
  pos: (i, n, out: Vector3) => {
    const f = i / n;
    const b = Math.min(4, Math.floor(f * 5));
    const alt = [1.1, 1.7, 1.45, 2.6, 3.6][b];
    const x = -2.2 + b * 1.1;
    out.set(x + (h(i, 13) - 0.5) * 0.62, -1.8 + h(i, 14) * alt, (h(i, 15) - 0.5) * 0.62);
  },
};

export const nuvemServicos: Objeto3D = {
  id: "nuvem-servicos",
  nome: "Nuvem Serviços",
  tags: ["nuvem", "scroll", "morph", "marketing"],
  serve:
    "agência de tráfego/marketing: seção de serviços com cartões empilhando. cada serviço uma forma (meta, google, site, criativo, dados).",
  custo: "medio",
  nota:
    "PRECISA de modo scroll com scrollSource = progresso da seção de serviços. as formas repartem o índice por fração de i/n, nunca por contagem: forma nova segue a mesma regra.",
  autoRotacao: false,
  camera: { distancia: 11, fov: 0.55 },
  arquivos: ["src/objects/_nuvem.ts"],

  build(scene: Scene, p: Paleta) {
    const nuvem = criarNuvem(scene, p, {
      formas: [infinito, lupa, janela, faisca, barras],
      n: 1400,
      estilo: "ponto",
      tamanho: 0.05,
      porScroll: true,
      girar: 0,
    });
    // forma chapada (janela, barras) de perfil some: em vez de girar inteiro,
    // balança de frente. Relógio real, não f.t: no modo scroll f.t para quando a
    // pessoa para de rolar, e a nuvem ficaria morta na tela.
    return {
      root: nuvem.root,
      raio: nuvem.raio,
      update(f) {
        nuvem.update(f);
        const tt = performance.now() / 1000;
        nuvem.root.rotation.y = Math.sin(tt * 0.45) * 0.34 + f.mx * 0.3;
      },
    };
  },
};
