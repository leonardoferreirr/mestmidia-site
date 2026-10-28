// SISTEMA ORBITAL
// Um sol no centro (a empresa do cliente) e doze planetas em tres orbitas (os
// canais e publicos). Com f.explosao subindo, o sistema VIRA um grafico de
// crescimento: o plano deita de quina, as orbitas achatam e viram a grade, cada
// planeta voa pro seu ponto de dado, a linha se desenha entre eles e o sol vai
// pro pico. Feito pro hero de agencia de trafego: "sua empresa no centro de
// tudo" e, rolando, "e e isso que vira resultado".
//
// KEPLER, E NAO VELOCIDADE BONITA.
//
// ω = KEPLER · r^-1.5 (a terceira lei: T² ∝ r³). O anel de dentro da uma volta
// em ~19s, o do meio em ~38s, o de fora em ~61s. Com todos na mesma velocidade angular o sistema
// gira como um disco de vinil — um decalque. E a diferenca de passo entre os
// aneis que faz o olho ler "sistema", igual ao Anel Orbital. Planetas do mesmo
// anel tem o mesmo ω (mesmo raio), entao o espacamento entre eles nunca muda.
//
// A COREOGRAFIA E FUNCAO PURA DE (t, explosao). Nada acumula.
//
// Cada planeta e lerp(posicao orbital em t, ponto do grafico), com k em rampa
// propria, atrasada pelo indice do ponto. Por isso o scrub de volta desfaz
// perfeito: a posicao orbital e recalculada do t, nao lembrada. O cronograma tem
// uma regra que nao pode quebrar: a CABECA DA LINHA chega no ponto j DEPOIS do
// planeta j pousar (cabeca 0.36 + 0.04j contra pouso 0.34 + 0.03j). Com a linha
// na frente, ela ligaria pontos vazios; voltando, o pacto se inverte sozinho e a
// linha recolhe antes de os planetas decolarem.
//
// Ordem dos atos, em f.explosao:
//   0.00-0.42  o plano deita de quina (de 32° em paisagem, 50° em retrato)
//   0.05-0.58  cada orbita vira uma linha da grade (sobe/desce e alarga)
//   0.06-0.67  planetas voam, um por vez, da esquerda pra direita
//   0.28-0.50  a linha de base se desenha
//   0.36-0.84  a linha do grafico se desenha (crescer e PREENCHER: ver README)
//   0.30-0.80  o sol encolhe (0.30-0.68) e so entao vai pro pico (0.38-0.80)
//   0.34-0.92  as barras sobem atras de cada ponto
// Tudo assenta antes de 0.95, porque o runtime chega em 1 por lerp (assintota).
//
// POR QUE ANCORAS.
//
// O nome de cada planeta e rotulo HTML por cima do canvas (texto nitido,
// selecionavel, leitor de tela ve). A peca nao desenha texto: ela expoe
// `ancoras()` (id, nome, posicao de mundo, visivel) e o host projeta com
// `Handle.projetar`. Os rotulos dos planetas somem no primeiro gesto da
// transformacao (no grafico eles viram pontos anonimos, o eixo x e tempo); o do
// sol volta quando ele chega no pico — "seu negocio" no topo do grafico.

// Imports profundos de propósito: "@babylonjs/core" na raiz arrasta o Babylon
// inteiro (4,4 MB no bundle). Só o que a peça usa.
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Constants } from "@babylonjs/core/Engines/constants";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { FresnelParameters } from "@babylonjs/core/Materials/fresnelParameters";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import "@babylonjs/core/Meshes/thinInstanceMesh"; // thinInstanceSetBuffer
import type { Objeto3D, Paleta, Ancora } from "../types";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const suave = (t: number) => t * t * (3 - 2 * t);
const rampa = (v: number, de: number, ate: number) => suave(clamp01((v - de) / (ate - de)));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---- sistema ----------------------------------------------------------------
const ANEIS = [1.5, 2.4, 3.3];
const KEPLER = 0.62;
/** rotation.x do plano. NEGATIVO = visto de cima (README, "rotation.x positivo
 *  mostra o objeto POR BAIXO"). Em paisagem -0.56 rad (~32°): menos que isso as
 *  orbitas viram risco e os rotulos se empilham; mais vira alvo de dardo. Em
 *  tela retrato a largura e o limite e sobra altura: a 32° o disco virava uma
 *  faixa fina no meio do celular, com doze rotulos brigando na mesma linha.
 *  Vendo mais de cima (~50°) o disco ocupa a altura e os rotulos se separam. */
const inclinacaoPara = (aspect: number) => lerp(-0.88, -0.56, rampa(aspect, 0.62, 1.35));
/** um tico de rolagem em Z: diagrama celeste reto demais parece clip-art */
const ROLAGEM = 0.12;
const R_SOL = 0.42;
const ESP_ORBITA = 0.009;

type Planeta = {
  id: string;
  nome: string;
  anel: 0 | 1 | 2;
  /** raio da esfera */
  tam: number;
  /** 0 = acento1 .. 1 = acento2 */
  mist: number;
  /** quanto de branco entra na cor: sem isso doze planetas em dois matizes
   *  viram duas manchas */
  branco: number;
  /** anel fino de planeta. dois no maximo: com mais, o anel deixa de marcar */
  anelProprio?: boolean;
};

// os ids sao estaveis: o host mapeia por id pro proprio texto.
// anel 1 = o que e do cliente; anel 2 = midia paga e redes; anel 3 = alcance.
const PLANETAS: Planeta[] = [
  { id: "site", nome: "Site", anel: 0, tam: 0.09, mist: 0.9, branco: 0.2 },
  { id: "whatsapp", nome: "WhatsApp", anel: 0, tam: 0.085, mist: 1, branco: 0.0 },
  { id: "clientes", nome: "Clientes", anel: 0, tam: 0.1, mist: 0.35, branco: 0.3 },
  { id: "meta-ads", nome: "Meta Ads", anel: 1, tam: 0.14, mist: 0.0, branco: 0.05, anelProprio: true },
  { id: "google-ads", nome: "Google Ads", anel: 1, tam: 0.125, mist: 0.6, branco: 0.12 },
  { id: "instagram", nome: "Instagram", anel: 1, tam: 0.095, mist: 0.85, branco: 0.0 },
  { id: "facebook", nome: "Facebook", anel: 1, tam: 0.09, mist: 0.15, branco: 0.25 },
  { id: "youtube", nome: "YouTube", anel: 2, tam: 0.115, mist: 0.45, branco: 0.0 },
  { id: "tiktok", nome: "TikTok", anel: 2, tam: 0.09, mist: 0.95, branco: 0.25 },
  { id: "shopping", nome: "Google Shopping", anel: 2, tam: 0.08, mist: 0.2, branco: 0.4 },
  { id: "parceiros", nome: "Parceiros", anel: 2, tam: 0.09, mist: 0.7, branco: 0.1 },
  { id: "midia", nome: "Veículos de mídia", anel: 2, tam: 0.13, mist: 0.05, branco: 0.2, anelProprio: true },
];
const SOL = { id: "empresa", nome: "Seu negócio" };

/** onde cada orbita comeca. somado ao espacamento igual dentro do anel e a um
 *  desvio por planeta: a peca nasce no meio do gesto, nada alinhado em t=0. */
const FASE_ANEL = [0.5, 2.3, 4.1];
const DESVIO = [0.12, -0.18, 0.05, -0.1, 0.16, -0.06, 0.09, -0.14, 0.2, -0.04, 0.11, -0.2];

// ---- grafico ----------------------------------------------------------------
/** quem vai pra qual ponto, da esquerda pra direita. o sol fecha a fila (pico).
 *  curado: os de fora (alcance) abrem, os de dentro chegam perto do resultado. */
const ORDEM = [
  "parceiros", "midia", "shopping", "youtube", "tiktok", "facebook",
  "instagram", "google-ads", "meta-ads", "clientes", "whatsapp", "site",
];
/** a curva, em fracao da altura. sobe com dois respiros (indices 3 e 7):
 *  crescimento reto de regua le como mentira, e quem vende trafego sabe. */
const CURVA = [0.06, 0.12, 0.19, 0.16, 0.26, 0.34, 0.41, 0.36, 0.49, 0.6, 0.7, 0.83, 1.0];
const NP = CURVA.length; // 13 = 12 planetas + o sol
const R_PONTO = 0.085;
const R_PICO = 0.15;
/** fracao da altura onde cada orbita vira linha da grade (anel 0, 1, 2) */
const GRADE = [0.5, 0.25, 0.75];

const cabecaEm = (j: number) => 0.36 + 0.04 * j;
const vooDe = (s: number) => 0.06 + 0.03 * s; // pousa em vooDe + 0.28

/** caixa do grafico: em tela retrato mais estreita e bem mais alta. A largura
 *  e o limite no celular; com a caixa de paisagem o grafico virava uma tira
 *  no meio de uma tela vazia. */
const caixaGrafico = (aspect: number) => {
  const k = rampa(aspect, 0.62, 1.35);
  return { w: lerp(5.4, 7.8, k), h: lerp(5.2, 3.7, k) };
};

/**
 * Raio que CABE a caixa (hx, hy) no canvas, na conta do runtime.
 *
 * O runtime enquadra uma esfera de raio r: meia-altura visivel 1.12·r/min(1,a),
 * meia-largura 1.12·r·a/min(1,a). Pra uma caixa larga (o grafico, o disco visto
 * de cima) a esfera desperdica metade da tela em paisagem. Invertendo a conta,
 * r = min(1,a)·max(hy, hx/a) cabe a caixa justa nos dois formatos.
 */
const raioPraCaixa = (hx: number, hy: number, a: number) => Math.min(1, a) * Math.max(hy, hx / a);

export const sistemaOrbital: Objeto3D = {
  id: "sistema-orbital",
  nome: "Sistema Orbital",
  tags: ["orbita", "sistema", "grafico", "crescimento", "hero", "rotulos"],
  serve:
    "agencia de trafego, marketing, growth, ecossistema de canais, plataforma com integracoes. 'sua empresa no centro' que, rolando, vira grafico de resultado. pede o host com rotulos HTML (ancoras).",
  custo: "medio",
  nota:
    "f.explosao e o progresso da transformacao (sistema -> grafico). no site: modo auto+mouse, explosao:'scroll' e scrollSource = progresso da secao fixada; NAO ligar modo scroll (t viraria scroll·14 e as orbitas parariam). rotulos via h.ancoras() + h.projetar() dentro de scene.onAfterRenderObservable. glow off: tudo aqui ja e luz aditiva, e o blur lavaria as linhas finas. ~23 draw calls (12 planetas PBR + aditivos). usa o grupo de render 1 (planetas por cima das orbitas): nao combinar com peca que use grupo 1 na mesma cena. no celular sao 12 rotulos em ~300px: o host deve usar fonte menor e/ou esconder os de visivel < 0.7 (a metade de tras).",
  glow: false,
  autoRotacao: false, // o plano tem inclinacao propria e deita no grafico: girar em Y desmonta o diagrama
  explode: true,
  // fov baixo: diagrama, nao cena. com 0.45 o planeta da frente saia o dobro do
  // de tras, e o grafico (que precisa ler reto) ganhava fuga
  camera: { distancia: 18, fov: 0.36 },

  build(scene: Scene, p: Paleta) {
    const root = new Mesh("sistema-orbital", scene);
    const engine = scene.getEngine();
    const aspect = () => engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const r = rng(40213);

    // ---- materiais de luz ----
    // LUZ E ADITIVA e o brilho mora no emissivo (README, Farol). alpha < 1 senao
    // o StandardMaterial vira opaco e ignora o alphaMode sem avisar. Sem escrita
    // de profundidade: linha fina aditiva escrevendo depth recorta a vizinha.
    const matLuz = (nome: string) => {
      const m = new StandardMaterial(nome, scene);
      m.diffuseColor = Color3.Black();
      m.specularColor = Color3.Black();
      m.disableLighting = true;
      m.alphaMode = Constants.ALPHA_ADD;
      m.alpha = 0.9;
      m.disableDepthWrite = true;
      m.backFaceCulling = false;
      return m;
    };
    const corLinha = Color3.Lerp(p.acento1, p.acento2, 0.62);
    const branco = new Color3(1, 1, 1);
    const corPonto = Color3.Lerp(p.acento2, corLinha, 0.25);
    const emisPonto = Color3.Lerp(corPonto, branco, 0.2).scale(0.8);
    const corNucleo = Color3.Lerp(corLinha, branco, 0.3);
    const corBarra = Color3.Lerp(p.acento1, corLinha, 0.4);

    // ---- plano orbital ----
    const plano = new TransformNode("plano", scene);
    plano.parent = root;
    const qPlano = new Quaternion();
    plano.rotationQuaternion = qPlano;
    const mPlano = new Matrix();

    const circulo = (raio: number, n: number) => {
      const path: Vector3[] = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        path.push(new Vector3(Math.cos(a) * raio, 0, Math.sin(a) * raio));
      }
      return path;
    };

    // as tres orbitas. tubo e nao linha de 1px: tubo tem espessura em unidade de
    // cena, entao acompanha o enquadramento em qualquer tela e DPR.
    const orbitas = ANEIS.map((raio, i) => {
      const m = MeshBuilder.CreateTube(
        "orbita" + i,
        { path: circulo(raio, 220), radius: ESP_ORBITA, tessellation: 6 },
        scene
      );
      m.parent = plano;
      const mat = matLuz("orbitaMat" + i);
      m.material = mat;
      return { m, mat, raio };
    });

    // ---- poeira: um mesh, thin instances, gira o node inteiro (Anel Orbital) ----
    const N_POEIRA = 260;
    const poeiraNode = new TransformNode("poeiraNode", scene);
    poeiraNode.parent = plano;
    // icosfera e nao caixa: caixa de 3px vira confete quadrado na tela
    const poeira = MeshBuilder.CreateIcoSphere("poeira", { radius: 0.5, subdivisions: 1 }, scene);
    poeira.parent = poeiraNode;
    poeira.alwaysSelectAsActiveMesh = true;
    const matPoeira = matLuz("poeiraMat");
    poeira.material = matPoeira;
    {
      const mats = new Float32Array(N_POEIRA * 16);
      const cores = new Float32Array(N_POEIRA * 4);
      const m = new Matrix();
      const q = new Quaternion();
      const esc = new Vector3();
      const pos = new Vector3();
      for (let k = 0; k < N_POEIRA; k++) {
        const ang = r() * Math.PI * 2;
        // mais densa perto das orbitas: poeira uniforme vira chuvisco de TV
        const anel = ANEIS[k % 3];
        const rad = Math.max(0.75, anel + (r() + r() + r() - 1.5) * 0.7);
        pos.set(Math.cos(ang) * rad, (r() - 0.5) * 0.08, Math.sin(ang) * rad);
        const s = 0.008 + r() * r() * 0.02;
        esc.set(s, s, s);
        Quaternion.RotationYawPitchRollToRef(r() * 3, r() * 3, r() * 3, q);
        Matrix.ComposeToRef(esc, q, pos, m);
        m.copyToArray(mats, k * 16);
        const b = 0.25 + r() * 0.75;
        cores[k * 4] = b;
        cores[k * 4 + 1] = b;
        cores[k * 4 + 2] = b;
        cores[k * 4 + 3] = 1;
      }
      poeira.thinInstanceSetBuffer("matrix", mats, 16, true);
      poeira.thinInstanceSetBuffer("color", cores, 4, true);
    }

    // ---- sol ----
    // nucleo azul royal, borda ciano: fresnel no emissivo (centro = right,
    // borda = left). Sem luz de cena: sol nao e iluminado, ele ilumina.
    const sol = MeshBuilder.CreateSphere("sol", { diameter: 2, segments: 48 }, scene);
    sol.parent = root;
    const matSol = new StandardMaterial("solMat", scene);
    matSol.disableLighting = true;
    matSol.diffuseColor = Color3.Black();
    matSol.specularColor = Color3.Black();
    matSol.emissiveColor = branco.clone();
    const fr = new FresnelParameters();
    fr.leftColor = Color3.Lerp(p.acento2, branco, 0.15);
    fr.rightColor = Color3.Lerp(p.acento1, branco, 0.08).scale(0.92);
    // power < 1 empurra o termo pra perto de 1 em quase todo o disco: o royal
    // ocupa o miolo e o ciano fica so na borda. com 1.6 o sol virou bola ciana.
    fr.bias = 0;
    fr.power = 0.55;
    matSol.emissiveFresnelParameters = fr;
    sol.material = matSol;

    // halo: billboard com degrade radial, aditivo. Contido de proposito: o host
    // tem fundo animado proprio, e halo grande lava o titulo do lado.
    const texHalo = new DynamicTexture("haloTex", { width: 256, height: 256 }, scene, false);
    {
      const g = texHalo.getContext() as unknown as CanvasRenderingContext2D;
      g.fillStyle = "#000";
      g.fillRect(0, 0, 256, 256);
      const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      const a1 = p.acento1.toHexString();
      const a2 = p.acento2.toHexString();
      // o sol cobre ate ~0.31 do raio do quad (halo = 3.2x o sol)
      // a regiao de dentro fica atras do sol (o depth recorta); ela so aparece
      // no pico, onde o halo cresce em relacao ao sol e vira o ponto aceso
      grad.addColorStop(0.0, a2);
      grad.addColorStop(0.2, a2);
      grad.addColorStop(0.32, hexAlpha(a2, 0.5));
      grad.addColorStop(0.55, hexAlpha(a1, 0.2));
      grad.addColorStop(1.0, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
      texHalo.update();
    }
    const halo = MeshBuilder.CreatePlane("halo", { size: 2 }, scene);
    halo.parent = root;
    halo.billboardMode = Mesh.BILLBOARDMODE_ALL;
    const matHalo = matLuz("haloMat");
    matHalo.emissiveColor = Color3.Black();
    matHalo.emissiveTexture = texHalo;
    halo.material = matHalo;

    // ---- planetas ----
    const slotDe = PLANETAS.map((pl) => ORDEM.indexOf(pl.id));
    const porAnel = [0, 0, 0];
    const contAnel = [0, 0, 0];
    PLANETAS.forEach((pl) => porAnel[pl.anel]++);

    // ORBITA SEMPRE ATRAS DO PLANETA.
    // A orbita passa pelo centro do planeta e, vista de 32° de cima, SAI pela
    // face de baixo-frente da esfera: geometricamente certo, e na tela vira um
    // palito espetado em cada planeta. Diagrama desenha a orbita atras do no.
    // Os planetas vao pro grupo de render 1 SEM limpar o depth: desenham depois
    // das linhas (que nao escrevem depth, entao nao os recortam) e continuam
    // testando contra o sol, que escreveu depth no grupo 0 — planeta atras do
    // sol continua escondido. A regra e da cena, mas cada montagem tem cena
    // propria e nenhuma outra peca usa o grupo 1.
    scene.setRenderingAutoClearDepthStencil(1, false, false, false);

    const planetas = PLANETAS.map((pl, i) => {
      const m = MeshBuilder.CreateSphere("planeta-" + pl.id, { diameter: 2, segments: 24 }, scene);
      m.parent = root;
      m.renderingGroupId = 1;
      const cor = Color3.Lerp(Color3.Lerp(p.acento1, p.acento2, pl.mist), branco, pl.branco);
      // sem metal e com o estudio baixo: planeta precisa MOSTRAR cor (README,
      // "Metal nao tem cor propria"), e com o estudio forte os softboxes viravam
      // listras brancas — bolha de sabao, nao planeta. Acetinado le como corpo.
      const mat = new PBRMaterial("planetaMat-" + pl.id, scene);
      mat.metallic = 0;
      mat.roughness = 0.55;
      mat.albedoColor = cor.clone();
      mat.emissiveColor = cor.scale(0.16);
      mat.environmentIntensity = 0.65;
      m.material = mat;

      const n = contAnel[pl.anel]++;
      const fase = FASE_ANEL[pl.anel] + (n / porAnel[pl.anel]) * Math.PI * 2 + DESVIO[i];
      const raio = ANEIS[pl.anel];

      let aro: { m: Mesh; mat: StandardMaterial } | null = null;
      if (pl.anelProprio) {
        // filho do planeta: herda escala, entao o raio aqui e em "raios do planeta"
        const am = MeshBuilder.CreateTube(
          "aro-" + pl.id,
          { path: circulo(1.85, 96), radius: 0.05, tessellation: 6 },
          scene
        );
        am.parent = m;
        am.renderingGroupId = 1; // mesmo grupo do planeta: a metade de tras some atras dele
        am.rotation.set(0.42, 0, i % 2 ? 0.5 : -0.38);
        const amat = matLuz("aroMat-" + pl.id);
        am.material = amat;
        aro = { m: am, mat: amat };
      }

      return {
        pl,
        m,
        mat,
        cor,
        // emissivo no sistema e no grafico, prontos: Color3 novo por planeta por
        // frame e lixo que o coletor cobra em engasgo (README, thin instances)
        emis0: cor.scale(0.16),
        fase,
        raio,
        omega: KEPLER * Math.pow(raio, -1.5),
        slot: slotDe[i],
        aro,
        ancora: { id: pl.id, nome: pl.nome, pos: new Vector3(), visivel: 1, centro: new Vector3(), frente: 1 } as Ancora,
      };
    });

    // ---- grafico: linha (preencher, nao esticar), barras, base ----
    // Cada trecho da linha e um cilindro unitario com o pe na origem, posto no
    // ponto j e apontado pro j+1. A cabeca da linha diz quantos trechos existem;
    // o trecho da ponta entra com comprimento parcial. Trecho reto de espessura
    // uniforme encurtado a partir do pe E preencher — a armadilha do README e
    // escalar UM tubo do caminho inteiro.
    const NS = NP - 1;
    const mkTrecho = (nome: string, diam: number) => {
      const c = MeshBuilder.CreateCylinder(nome, { height: 1, diameter: 1, tessellation: 10 }, scene);
      c.bakeTransformIntoVertices(Matrix.Translation(0, 0.5, 0));
      c.parent = root;
      c.alwaysSelectAsActiveMesh = true;
      const buf = new Float32Array(NS * 16);
      c.thinInstanceSetBuffer("matrix", buf, 16, false);
      return { c, buf, diam };
    };
    // nucleo fino e brilhante + uma bainha larga e fraca: da a leitura de linha
    // luminosa sem GlowLayer (que custa ~28% do frame e lava linha fina)
    const linhaNucleo = mkTrecho("linha", 0.026);
    const linhaBainha = mkTrecho("linhaBainha", 0.1);
    const matLinha = matLuz("linhaMat");
    const matBainha = matLuz("bainhaMat");
    linhaNucleo.c.material = matLinha;
    linhaBainha.c.material = matBainha;

    // barras: caixa unitaria com o pe na origem e degrade POR VERTICE (pe preto,
    // topo aceso). No aditivo, preto e transparente: a barra nasce do nada.
    // Barra pode escalar em Y — ela e barra, nao caminho.
    const barra = MeshBuilder.CreateBox("barra", { size: 1 }, scene);
    barra.bakeTransformIntoVertices(Matrix.Translation(0, 0.5, 0));
    {
      const pos = barra.getVerticesData(VertexBuffer.PositionKind)!;
      const cores = new Float32Array((pos.length / 3) * 4);
      for (let v = 0; v < pos.length / 3; v++) {
        const y = pos[v * 3 + 1];
        const b = y > 0.5 ? 1 : 0.0;
        cores[v * 4] = b;
        cores[v * 4 + 1] = b;
        cores[v * 4 + 2] = b;
        cores[v * 4 + 3] = 1;
      }
      barra.setVerticesData(VertexBuffer.ColorKind, cores);
    }
    barra.parent = root;
    barra.alwaysSelectAsActiveMesh = true;
    const bufBarra = new Float32Array(NP * 16);
    barra.thinInstanceSetBuffer("matrix", bufBarra, 16, false);
    const matBarra = matLuz("barraMat");
    barra.material = matBarra;

    // linha de base: caixa com o pe na esquerda, cresce pra direita
    const base = MeshBuilder.CreateBox("base", { width: 1, height: 1, depth: 1 }, scene);
    base.bakeTransformIntoVertices(Matrix.Translation(0.5, 0, 0));
    base.parent = root;
    const matBase = matLuz("baseMat");
    base.material = matBase;

    // ---- estado reusado por frame (nada de new no update) ----
    const vOrb = new Vector3();
    const vLocal = new Vector3();
    const tmpM = new Matrix();
    const tmpQ = new Quaternion();
    const tmpS = new Vector3();
    const tmpP = new Vector3();
    const eixoZ = new Vector3(0, 0, 1);
    const qId = Quaternion.Identity();
    const vTopo = new Vector3();
    const umV = new Vector3(1, 1, 1);
    const alvos = Array.from({ length: NP }, () => new Vector3());
    const ancoraSol: Ancora = { id: SOL.id, nome: SOL.nome, pos: new Vector3(), visivel: 1, centro: new Vector3() };
    const ancoras: Ancora[] = [...planetas.map((pl) => pl.ancora), ancoraSol];

    let eAtual = 0;

    const raio = () => {
      const a = aspect();
      // sistema: disco de 3.3 + planeta + meia largura de rotulo nas pontas.
      // hy: a projecao do disco (3.3·sen θ) com folga pra perspectiva e pro
      // rotulo do planeta de tras. o plano ja sobe pra compensar a borda de perto.
      // a folga lateral cresce em retrato: la o rotulo e grande em relacao ao
      // disco e o da ponta ("Veiculos de midia") cortava na borda do celular
      const folga = lerp(0.95, 0.6, rampa(a, 0.62, 1.35));
      const rS = raioPraCaixa(3.3 + folga, ANEIS[2] * Math.sin(-inclinacaoPara(a)) * 1.08 + 0.45, a);
      const { w, h } = caixaGrafico(a);
      // folga a direita e em cima: o rotulo do sol mora no pico
      const rG = raioPraCaixa(w / 2 + 0.8, h / 2 + 0.6, a);
      return lerp(rS, rG, rampa(eAtual, 0.12, 0.7));
    };

    return {
      root,
      raio,
      ancoras: () => {
        // a ancora e o TOPO do corpo (centro + raio atual pra cima), nao o
        // centro: e onde o rotulo encosta. no centro o texto cobria o planeta, e
        // o host nao tem como saber o raio na tela. posicao de mundo do frame
        // atual: o root gira com o mouse.
        const wm = root.computeWorldMatrix(true);
        for (const pl of planetas) {
          Vector3.TransformCoordinatesToRef(pl.m.position, wm, pl.ancora.centro!);
          vTopo.copyFrom(pl.m.position);
          vTopo.y += pl.m.scaling.y;
          Vector3.TransformCoordinatesToRef(vTopo, wm, pl.ancora.pos);
        }
        Vector3.TransformCoordinatesToRef(sol.position, wm, ancoraSol.centro!);
        vTopo.copyFrom(sol.position);
        vTopo.y += sol.scaling.y;
        Vector3.TransformCoordinatesToRef(vTopo, wm, ancoraSol.pos);
        return ancoras;
      },
      update(f) {
        const e = clamp01(f.explosao);
        const t = f.t;
        eAtual = e;
        const asp = aspect();
        const { w: W, h: H } = caixaGrafico(asp);
        const incl = inclinacaoPara(asp);
        const yB = -H / 2;
        const passoX = W / (NP - 1);
        for (let j = 0; j < NP; j++) alvos[j].set(-W / 2 + j * passoX, yB + H * CURVA[j], 0);

        // ---- mouse: inclina o conjunto. menos no grafico: grafico que balanca
        // nao se le. (a camera do runtime ja desliza com o mouse por cima disto)
        const calma = 1 - 0.65 * rampa(e, 0.2, 0.7);
        root.rotation.x = f.my * 0.1 * calma;
        root.rotation.y = f.mx * 0.14 * calma;

        // ---- ato 1: o plano deita de quina ----
        const kPlano = rampa(e, 0, 0.42);
        const respiro = Math.sin(t * 0.12) * 0.03 * (1 - kPlano);
        Quaternion.RotationYawPitchRollToRef(
          0,
          lerp(incl, 0, kPlano) + respiro,
          lerp(ROLAGEM, 0, kPlano),
          qPlano
        );
        // a borda de perto do disco cresce na perspectiva e a de longe encolhe:
        // centrado na origem, o sistema PARECE baixo no quadro. Sobe o plano o
        // quanto a perspectiva desce, e zera no grafico (que e chato, sem fundo).
        const subida = ANEIS[2] * Math.sin(-incl) * 0.14 * (1 - kPlano);
        plano.position.y = subida;
        Matrix.ComposeToRef(umV, qPlano, plano.position, mPlano);

        // ---- ato 2: cada orbita vira uma linha da grade ----
        // achata em Z (senao a perspectiva desenha uma elipse fina em vez de
        // linha), alarga em X ate a largura do grafico, e sobe/desce pra altura
        // dela. Em 0 de inclinacao o local do plano e o espaco do root.
        orbitas.forEach((o, i) => {
          const k = rampa(e, 0.05 + i * 0.04, 0.5 + i * 0.04);
          o.m.position.y = lerp(0, yB + H * GRADE[i], k);
          o.m.scaling.x = lerp(1, W / 2 / o.raio, k);
          o.m.scaling.z = lerp(1, 0.012, k);
          // orbita 0.32 -> grade 0.12 (as duas metades do anel achatado somam)
          o.mat.emissiveColor.copyFrom(corLinha).scaleInPlace(lerp(0.28, 0.12, k));
        });

        // poeira: gira junto (um node so) e apaga cedo
        poeiraNode.rotation.y = t * 0.035;
        const kPo = 1 - rampa(e, 0, 0.3);
        matPoeira.emissiveColor.copyFrom(p.acento2).scaleInPlace(0.55 * kPo);
        poeira.setEnabled(kPo > 0.001);

        // ---- ato 3: planetas voam pro ponto ----
        const kRotulo = 1 - rampa(e, 0.02, 0.16);
        for (const pl of planetas) {
          const ang = pl.fase + pl.omega * t;
          vLocal.set(Math.cos(ang) * pl.raio, 0, Math.sin(ang) * pl.raio);
          Vector3.TransformCoordinatesToRef(vLocal, mPlano, vOrb);

          const s0 = vooDe(pl.slot);
          const k = rampa(e, s0, s0 + 0.28);
          const alvo = alvos[pl.slot];
          const arco = Math.sin(Math.PI * k);
          // o voo passa PERTO da camera no meio (z negativo): le como gesto, nao
          // como planeta escorregando no vidro
          pl.m.position.set(
            lerp(vOrb.x, alvo.x, k),
            lerp(vOrb.y, alvo.y, k) + arco * 0.25,
            lerp(vOrb.z, alvo.z, k) - arco * 0.9
          );
          const tam = lerp(pl.pl.tam, R_PONTO, k);
          pl.m.scaling.setAll(tam);

          // no grafico todo ponto e igual: cor da linha, aceso
          Color3.LerpToRef(pl.cor, corPonto, k, pl.mat.albedoColor);
          Color3.LerpToRef(pl.emis0, emisPonto, k, pl.mat.emissiveColor);

          if (pl.aro) {
            const ka = 1 - rampa(e, s0, s0 + 0.14);
            pl.aro.mat.emissiveColor.copyFrom(pl.cor).scaleInPlace(0.42 * ka);
            pl.aro.m.setEnabled(ka > 0.001);
          }

          // rotulo: os da frente mais fortes, os de tras mais fracos (o disco
          // tem profundidade e o texto chapado em cima dela achata a cena)
          const frente = 0.5 - 0.5 * Math.sin(ang);
          pl.ancora.visivel = kRotulo * (0.55 + 0.45 * frente);
          pl.ancora.frente = frente;
        }

        // ---- ato 4: o sol vai pro pico ----
        const kSol = rampa(e, 0.38, 0.8);
        const pico = alvos[NP - 1];
        const arcoSol = Math.sin(Math.PI * kSol);
        sol.position.set(lerp(0, pico.x, kSol), lerp(0, pico.y, kSol) + arcoSol * 0.3, -arcoSol * 0.7);
        // encolhe ANTES de andar: sol grande atravessando o quadro no meio do
        // gesto cobria os planetas em voo e roubava a cena
        const rSol = lerp(R_SOL, R_PICO, rampa(e, 0.3, 0.68));
        sol.scaling.setAll(rSol);
        halo.position.copyFrom(sol.position);
        halo.scaling.setAll(rSol * lerp(3.2, 4.6, kSol) * (1 + Math.sin(t * 1.1) * 0.035));
        // a subida do plano vale pro sol tambem: ele e o centro do disco
        sol.position.y += subida;
        halo.position.y = sol.position.y;
        texHalo.level = lerp(0.85, 1.0, kSol);
        ancoraSol.visivel = clamp01(1 - rampa(e, 0.02, 0.16) + rampa(e, 0.84, 0.95));

        // ---- ato 5: base, linha, barras ----
        const kBase = rampa(e, 0.28, 0.5);
        base.position.set(-W / 2, yB, 0);
        base.scaling.set(Math.max(1e-4, W * kBase), 0.016, 0.016);
        base.setEnabled(kBase > 0.001);
        matBase.emissiveColor.copyFrom(corLinha).scaleInPlace(0.42);

        // cabeca da linha em "pontos": linear de proposito. a linha e a unica
        // coisa que anda em velocidade constante, e e por isso que ela le como
        // o tempo passando no eixo x.
        const cab = clamp01((e - cabecaEm(0)) / (cabecaEm(NS) - cabecaEm(0))) * NS;
        for (const L of [linhaNucleo, linhaBainha]) {
          for (let j = 0; j < NS; j++) {
            const a = alvos[j];
            const b = alvos[j + 1];
            const frac = clamp01(cab - j);
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) * frac;
            Quaternion.RotationAxisToRef(eixoZ, Math.atan2(dy, dx) - Math.PI / 2, tmpQ);
            tmpS.set(frac > 0 ? L.diam : 0, len, frac > 0 ? L.diam : 0);
            Matrix.ComposeToRef(tmpS, tmpQ, a, tmpM);
            tmpM.copyToArray(L.buf, j * 16);
          }
          L.c.thinInstanceBufferUpdated("matrix");
        }
        const kLinha = cab > 0 ? 1 : 0;
        matLinha.emissiveColor.copyFrom(corNucleo).scaleInPlace(0.95 * kLinha);
        matBainha.emissiveColor.copyFrom(corLinha).scaleInPlace(0.2 * kLinha);

        const LARG_BARRA = Math.min(0.09, passoX * 0.16);
        for (let j = 0; j < NP; j++) {
          const kb = rampa(e, cabecaEm(j) - 0.02, cabecaEm(j) + 0.08);
          const topo = alvos[j].y - (j === NP - 1 ? R_PICO : R_PONTO) - 0.06;
          const alt = Math.max(0, topo - yB) * kb;
          tmpP.set(alvos[j].x, yB, 0.02);
          tmpS.set(kb > 0 ? LARG_BARRA : 0, alt, kb > 0 ? 0.02 : 0);
          Matrix.ComposeToRef(tmpS, qId, tmpP, tmpM);
          tmpM.copyToArray(bufBarra, j * 16);
        }
        barra.thinInstanceBufferUpdated("matrix");
        matBarra.emissiveColor.copyFrom(corBarra).scaleInPlace(0.5);
      },
    };
  },
};

/** "#rrggbb" + alpha -> rgba(). o degrade do halo precisa de alpha por parada. */
function hexAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
