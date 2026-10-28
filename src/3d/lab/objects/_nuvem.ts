// MOTOR DE NUVEM
// Uma nuvem de N particulas que assume QUALQUER forma e morfa entre elas.
//
// A ideia: toda forma aqui e uma funcao (indice, total) -> posicao. Como todas
// recebem o mesmo indice e devolvem uma posicao, a particula 37 existe em todas
// as formas — e o morph vira interpolar a posicao 37 da forma A ate a posicao 37
// da forma B. Nada de "converter esfera em toro": as duas ja sao a mesma nuvem
// em poses diferentes.
//
// POR ISSO a regra: toda forma usa o MESMO N e cobre o indice inteiro. Uma forma
// que "usa so metade das particulas" deixa a outra metade parada na origem e o
// morph vira uma explosao no centro.
//
// Quem importa este motor declara "src/objects/_nuvem.ts" no campo `arquivos`,
// senao o snippet manda copiar so o objeto e o cliente quebra.

import {
  Scene,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Matrix,
  Quaternion,
  Vector3,
  Color3,
  TransformNode,
} from "@babylonjs/core";
import type { Paleta, Frame } from "../types";

const TAU = Math.PI * 2;
/** angulo aureo: distribui pontos sem alinhar em fileiras. */
const AUREO = Math.PI * (3 - Math.sqrt(5));

export type Forma = {
  nome: string;
  /** escreve em `out` a posicao da particula i (de n) */
  pos: (i: number, n: number, out: Vector3) => void;
};

// ---------------------------------------------------------------- FORMAS

/** casca esferica por fibonacci: sem aglomerar nos polos */
export const esfera: Forma = {
  nome: "esfera",
  pos: (i, n, out) => {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * AUREO;
    out.set(Math.cos(a) * r * 2.3, y * 2.3, Math.sin(a) * r * 2.3);
  },
};

export const toro: Forma = {
  nome: "toro",
  pos: (i, n, out) => {
    // duas voltas incomensuraveis: cobre a superficie sem repetir trilha
    const u = (i / n) * TAU * 7;
    const v = i * AUREO;
    const R = 1.85,
      r = 0.72;
    out.set((R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u));
  },
};

/** superficie do cubo: 6 faces, particula distribuida por face */
export const cubo: Forma = {
  nome: "cubo",
  pos: (i, n, out) => {
    const porFace = Math.floor(n / 6);
    const face = Math.min(5, Math.floor(i / porFace));
    const k = i - face * porFace;
    const lado = Math.ceil(Math.sqrt(porFace));
    const u = ((k % lado) / (lado - 1) - 0.5) * 3.4;
    const v = (Math.floor(k / lado) / (lado - 1) - 0.5) * 3.4;
    const h = 1.7;
    if (face === 0) out.set(u, v, h);
    else if (face === 1) out.set(u, v, -h);
    else if (face === 2) out.set(h, u, v);
    else if (face === 3) out.set(-h, u, v);
    else if (face === 4) out.set(u, h, v);
    else out.set(u, -h, v);
  },
};

export const helice: Forma = {
  nome: "helice",
  pos: (i, n, out) => {
    const t = i / (n - 1);
    // duas fitas: metade das particulas em cada, defasadas de meia volta
    const fita = i % 2;
    const a = t * TAU * 2.6 + fita * Math.PI;
    out.set(Math.cos(a) * 1.25, t * 5.4 - 2.7, Math.sin(a) * 1.25);
  },
};

export const noTorico: Forma = {
  nome: "no",
  pos: (i, n, out) => {
    const t = (i / n) * TAU;
    const p = 2,
      q = 3;
    const r = 0.75 * Math.cos(q * t) + 2.2;
    // jitter radial pelo indice: sem ele a nuvem vira um fio de 1 particula de
    // espessura e some de longe
    const j = ((i * 7919) % 100) / 100 - 0.5;
    out.set(
      r * Math.cos(p * t) + j * 0.24,
      -0.75 * Math.sin(q * t) + j * 0.24,
      r * Math.sin(p * t) + j * 0.24
    );
    out.scaleInPlace(0.82);
  },
};

/** galaxia: braços em espiral logaritmica */
export const galaxia: Forma = {
  nome: "galaxia",
  pos: (i, n, out) => {
    const BRACOS = 3;
    const braco = i % BRACOS;
    const t = Math.pow(i / n, 0.62); // mais denso no centro
    const a = t * 5.2 + (braco / BRACOS) * TAU;
    const r = t * 3.3;
    // espalha em volta do braco, senao vira 3 riscos limpos
    const disp = (((i * 7919) % 100) / 100 - 0.5) * (0.28 + t * 0.5);
    out.set(
      Math.cos(a) * r + disp,
      (((i * 104729) % 100) / 100 - 0.5) * 0.32 * (1 - t * 0.6),
      Math.sin(a) * r + disp
    );
  },
};

/** plano ondulado */
export const onda: Forma = {
  nome: "onda",
  pos: (i, n, out) => {
    const lado = Math.ceil(Math.sqrt(n));
    const x = ((i % lado) / (lado - 1) - 0.5) * 5.6;
    const z = (Math.floor(i / lado) / (lado - 1) - 0.5) * 5.6;
    out.set(x, Math.sin(x * 1.1) * 0.5 + Math.cos(z * 0.9) * 0.5, z);
  },
};

export const cilindro: Forma = {
  nome: "cilindro",
  pos: (i, n, out) => {
    const a = i * AUREO;
    const y = (i / (n - 1) - 0.5) * 4.2;
    out.set(Math.cos(a) * 1.7, y, Math.sin(a) * 1.7);
  },
};

export const cone: Forma = {
  nome: "cone",
  pos: (i, n, out) => {
    const t = i / (n - 1);
    const a = i * AUREO;
    const r = (1 - t) * 2.3;
    out.set(Math.cos(a) * r, t * 4 - 2, Math.sin(a) * r);
  },
};

/** disco plano de frente */
export const disco: Forma = {
  nome: "disco",
  pos: (i, n, out) => {
    const r = Math.sqrt(i / n) * 2.5; // sqrt = densidade uniforme por area
    const a = i * AUREO;
    out.set(Math.cos(a) * r, Math.sin(a) * r, 0);
  },
};

// ---------------------------------------------------------------- MOTOR

export type EstiloNuvem = "ponto" | "cubo" | "risco";

export type OpcoesNuvem = {
  formas: Forma[];
  n?: number;
  estilo?: EstiloNuvem;
  tamanho?: number;
  /** segundos parado em cada forma antes de morfar pra proxima */
  ciclo?: number;
  /** true = o scroll escolhe a forma, em vez do tempo */
  porScroll?: boolean;
  girar?: number;
};

export type Nuvem = {
  root: TransformNode;
  update: (f: Frame) => void;
  raio: () => number;
};

const suave = (t: number) => t * t * (3 - 2 * t);

export function criarNuvem(scene: Scene, p: Paleta, o: OpcoesNuvem): Nuvem {
  const n = o.n ?? 1100;
  const estilo = o.estilo ?? "ponto";
  const tam = o.tamanho ?? 0.055;
  const ciclo = o.ciclo ?? 3.4;
  const formas = o.formas;

  const root = new Mesh("nuvem", scene);

  const base =
    estilo === "ponto"
      ? MeshBuilder.CreateIcoSphere("part", { radius: tam, subdivisions: 1 }, scene)
      : estilo === "cubo"
      ? MeshBuilder.CreateBox("part", { size: tam * 1.7 }, scene)
      : MeshBuilder.CreateBox("part", { width: tam * 5, height: tam * 0.7, depth: tam * 0.7 }, scene);
  base.parent = root;

  const mat = new PBRMaterial("nuvemMat", scene);
  mat.metallic = 0.72;
  mat.roughness = 0.24;
  mat.albedoColor = new Color3(1, 1, 1); // a cor real vem do buffer por instancia
  mat.emissiveColor = p.emissivo;
  mat.environmentIntensity = 2.4;
  base.material = mat;

  // ---- pré-calcula TODAS as poses: morph e so ler dois arrays ----
  const poses: Float32Array[] = [];
  const raios: number[] = [];
  const tmp = new Vector3();
  for (const forma of formas) {
    const arr = new Float32Array(n * 3);
    let maxR = 0;
    for (let i = 0; i < n; i++) {
      forma.pos(i, n, tmp);
      arr[i * 3] = tmp.x;
      arr[i * 3 + 1] = tmp.y;
      arr[i * 3 + 2] = tmp.z;
      const r = tmp.length();
      if (r > maxR) maxR = r;
    }
    poses.push(arr);
    raios.push(maxR);
  }

  const cores = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const c = Color3.Lerp(p.acento1, p.acento2, ((i * 7919) % 100) / 100);
    cores[i * 4] = c.r;
    cores[i * 4 + 1] = c.g;
    cores[i * 4 + 2] = c.b;
    cores[i * 4 + 3] = 1;
  }

  const buf = new Float32Array(n * 16);
  base.thinInstanceSetBuffer("matrix", buf, 16, false);
  base.thinInstanceSetBuffer("color", cores, 4, true);

  const esc = new Vector3(1, 1, 1);
  const pos = new Vector3();
  const rot = new Quaternion();
  const m = new Matrix();
  let raioAtual = raios[0];

  const update = (f: Frame) => {
    // qual par de formas e quanto do caminho entre elas
    let bruto: number;
    if (o.porScroll) bruto = f.scroll * (formas.length - 1);
    else bruto = (f.t / ciclo) % formas.length;

    const iA = Math.floor(bruto) % formas.length;
    const iB = (iA + 1) % formas.length;
    const frac = bruto - Math.floor(bruto);
    // segura na forma e depois morfa rapido: com lerp puro a nuvem passa a vida
    // no meio do caminho e nunca LE como esfera nem como toro.
    const t = formas.length === 1 ? 0 : suave(Math.min(1, Math.max(0, (frac - 0.55) / 0.45)));

    const A = poses[iA];
    const B = poses[iB];
    raioAtual = raios[iA] + (raios[iB] - raios[iA]) * t;

    for (let i = 0; i < n; i++) {
      const k = i * 3;
      const x = A[k] + (B[k] - A[k]) * t;
      const y = A[k + 1] + (B[k + 1] - A[k + 1]) * t;
      const z = A[k + 2] + (B[k + 2] - A[k + 2]) * t;
      pos.set(x, y, z);

      if (estilo === "risco") {
        // alinha o risco com a direcao do movimento: no meio do morph vira rastro
        const dx = B[k] - A[k],
          dy = B[k + 1] - A[k + 1],
          dz = B[k + 2] - A[k + 2];
        const len = Math.hypot(dx, dy, dz);
        if (len > 0.001 && t > 0.01 && t < 0.99) {
          Quaternion.FromLookDirectionLHToRef(
            tmp.set(dz / len, dy / len, dx / len),
            Vector3.UpReadOnly,
            rot
          );
        } else {
          Quaternion.RotationYawPitchRollToRef(i * 0.7, i * 0.3, 0, rot);
        }
      } else {
        Quaternion.RotationYawPitchRollToRef(f.t * 0.3 + i, f.t * 0.2 + i, 0, rot);
      }

      // incha no meio da transicao: da energia ao morph em vez de escorregar
      const s = 1 + Math.sin(t * Math.PI) * 0.5;
      esc.set(s, s, s);
      Matrix.ComposeToRef(esc, rot, pos, m);
      m.copyToArray(buf, i * 16);
    }
    base.thinInstanceBufferUpdated("matrix");

    root.rotation.y = f.t * (o.girar ?? 0.12);
    root.rotation.x = 0.1 + f.my * 0.12;
  };

  return { root, update, raio: () => raioAtual + tam * 3 };
}
