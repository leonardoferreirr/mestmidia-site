// RUNTIME
// Engine + cena + estudio de luz + loop. Isto e o que viaja junto com o objeto
// quando eu instalo num site de cliente. Nao tem nada de galeria aqui.
//
// Uso minimo num cliente:
//   import { montarObjeto } from "./runtime";
//   import { prismaRadial } from "./objects/prisma-radial";
//   const h = montarObjeto(canvas, prismaRadial, { paleta: "navy", modo: ["auto","mouse"] });
//   // h.dispose() quando desmontar

// Imports profundos de propósito: "@babylonjs/core" na raiz arrasta o Babylon
// inteiro (4,4 MB no bundle). Só o que a peça usa.
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";
import { Effect } from "@babylonjs/core/Materials/effect";
import "@babylonjs/core/Shaders/postprocess.vertex";
import type { Objeto3D, ObjetoMontado, Paleta, Frame, Ancora } from "./types";
import { paletaPorId } from "./palettes";

export type Modo = "auto" | "mouse" | "scroll";

export type OpcoesMontagem = {
  /** id da paleta ou a paleta inteira */
  paleta?: string | Paleta;
  /** comportamentos ligados. default: auto + mouse */
  modo?: Modo[];
  /** multiplicador de distancia da camera. 1 = o default do objeto */
  zoom?: number;
  /** liga o glow. custa GPU; desligado em objeto "pesado". */
  glow?: boolean;
  /** fonte de scroll 0..1. default: scroll real da pagina */
  scrollSource?: () => number;
  /** fundo transparente (pra sobrepor em HTML). default: false */
  transparente?: boolean;
  /** 0..1 fixo, ou "scroll" pra vista explodida dirigida pela fonte de scroll.
   *  "scroll" le o `scrollSource` direto, QUALQUER que seja o modo: da pra ter
   *  o objeto andando sozinho (modo auto) e a explosao presa ao progresso de uma
   *  secao (`scrollSource: () => progressoDaSecao`). Ver README, "Vista explodida". */
  explosao?: number | "scroll";
  /**
   * Engine ja existente pra reaproveitar, em vez de criar um novo.
   *
   * Existe porque o browser tem um limite duro de contextos WebGL (~16 no
   * Chrome) e engine.dispose() NAO devolve o contexto na hora. Criando um engine
   * por objeto em fila, por volta do 24o o browser simplesmente PARA de entregar
   * contexto — sem erro, sem excecao, so trava pra sempre. O sintoma engana: o
   * objeto que travou funciona perfeitamente sozinho, entao parece bug dele.
   *
   * Quem monta muitos objetos em sequencia (o gerador de miniaturas) passa UM
   * engine aqui e o reusa. Quem passa o engine continua dono dele: o dispose()
   * do handle nao o destroi.
   */
  engine?: Engine;
};

export type Handle = {
  scene: Scene;
  engine: Engine;
  /** resolve quando o estudio E os materiais estao carregados.
   *  a textura de ambiente nasce de um toDataURL = carrega async. capturar antes
   *  disso devolve frame PRETO, porque metal sem ambiente nao tem o que refletir.
   *  quem for tirar snapshot TEM que esperar isto. */
  pronto: Promise<void>;
  setPaleta: (p: Paleta) => void;
  /** 0 montado, 1 explodido (só faz efeito em objeto com explode: true) */
  setExplosao: (v: number | "scroll") => void;
  setModo: (m: Modo[]) => void;
  setZoom: (z: number) => void;
  /** roda `segundos` de simulação na mão e captura como dataURL (usado pelos
   *  thumbs). não depende do rAF: funciona com a aba em segundo plano. */
  snapshot: (segundos?: number) => string;
  /** as ancoras do objeto montado AGORA (vazio se ele nao declara). Passa pelo
   *  handle, e nao pelo objeto, porque trocar a paleta remonta o objeto: quem
   *  guardasse a funcao do primeiro build leria pecas ja descartadas. */
  ancoras: () => Ancora[];
  /** ponto de mundo -> pixel CSS, com origem no canto superior esquerdo do
   *  canvas. E o que o host usa pra posicionar rotulo HTML em cima de uma
   *  ancora. Chamar dentro de scene.onAfterRenderObservable: e la que a matriz
   *  da camera e a do frame que acabou de ir pra tela. */
  projetar: (pos: Vector3) => { x: number; y: number };
  /** para/retoma SÓ o loop deste objeto. O host pausa quando a peça sai da
   *  tela: dois canvas WebGL rodando ao mesmo tempo numa página longa é GPU
   *  queimando pra ninguém ver. */
  pausar: (sim: boolean) => void;
  dispose: () => void;
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** hermite: entra e sai sem quina. usado em toda transicao daqui e da trilha. */
export const suave = (t: number) => t * t * (3 - 2 * t);
/** rampa nomeada: 0 antes de `de`, 1 depois de `ate`, suave no meio.
 *  existe porque a trilha e feita de umas 8 rampas e escrever
 *  suave(clamp01((k-a)/(b-a))) oito vezes esconde qual e qual. */
export const rampa = (v: number, de: number, ate: number) =>
  suave(clamp01((v - de) / Math.max(1e-6, ate - de)));

/**
 * Quantos segundos de animacao uma rolagem INTEIRA da pagina percorre, no modo
 * scroll. E o unico numero que amarra "altura da pagina" a "duracao da peca".
 *
 * 14s foi escolhido pra caber o ciclo mais longo da biblioteca (a Ampulheta,
 * 12.6s) numa rolagem so. Baixar isso corta o fim das pecas de ciclo longo;
 * subir demais faz as de ciclo curto (Moeda, 7.5s) repetirem no meio da pagina.
 */
export const DURACAO_SCROLL = 14;

// ---- ESTUDIO DE REFLEXO ----------------------------------------------------
// Ambiente equirretangular DESENHADO num canvas: softboxes brancos + acentos da
// paleta. Vira o IBL do PBR. Offline, sem HDR remoto, e as cores acompanham a
// paleta automaticamente. Sem isto, objeto glossy no preto vira silhueta morta.
function estudio(scene: Scene, p: Paleta): Texture {
  const cv = document.createElement("canvas");
  cv.width = 2048;
  cv.height = 1024;
  const g = cv.getContext("2d")!;

  const base = g.createLinearGradient(0, 0, 0, cv.height);
  if (p.clara) {
    base.addColorStop(0, "#f2f5fa");
    base.addColorStop(0.5, "#dbe3ee");
    base.addColorStop(1, "#c3cddc");
  } else {
    base.addColorStop(0, "#0a0e18");
    base.addColorStop(0.5, "#06080f");
    base.addColorStop(1, "#04050a");
  }
  g.fillStyle = base;
  g.fillRect(0, 0, cv.width, cv.height);

  const soft = (x: number, y: number, w: number, h: number, col: string, a: number) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, Math.max(w, h) / 2);
    grad.addColorStop(0, col);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = a;
    g.fillStyle = grad;
    g.fillRect(x - w / 2, y - h / 2, w, h);
    g.globalAlpha = 1;
  };

  // softboxes brancos: sao eles que fazem os riscos de luz nas bordas
  soft(1024, 150, 1700, 420, "#ffffff", 1.0);
  soft(300, 512, 260, 1150, "#ffffff", 1.0);
  soft(720, 560, 200, 1000, "#eaf6ff", 0.85);
  soft(1180, 600, 190, 1000, "#ffffff", 0.8);
  soft(1560, 540, 240, 1050, "#ffffff", 0.95);
  soft(1880, 620, 200, 900, "#f0eaff", 0.8);
  soft(1024, 930, 1500, 300, "#e4ecff", 0.7);

  // acentos da paleta: e daqui que sai a cor do reflexo
  const h1 = p.acento1.toHexString();
  const h2 = p.acento2.toHexString();
  soft(170, 340, 460, 460, h1, 1.0);
  soft(1830, 700, 420, 420, h2, 0.95);
  soft(1280, 250, 320, 320, h2, 0.75);
  soft(560, 820, 340, 340, h1, 0.7);

  const tex = new Texture(cv.toDataURL(), scene, false, false);
  tex.coordinatesMode = Texture.EQUIRECTANGULAR_MODE;
  tex.name = "estudio";
  return tex;
}

/**
 * Engine + cena + camera + estudio + luzes + glow. TUDO que nao e o objeto.
 *
 * Extraido de montarObjeto quando a trilha nasceu: os dois precisam da MESMA
 * cena, e cena duplicada e cena que diverge — mexer na luz num lugar e esquecer
 * do outro faz o combo nao parecer o mesmo lab do viewer. Aqui e o unico lugar
 * onde se decide como este lab ilumina.
 */
export type Cena = {
  engine: Engine;
  /** false = engine emprestado; quem emprestou continua dono e faz o dispose */
  engineProprio: boolean;
  scene: Scene;
  camera: FreeCamera;
  glow: GlowLayer | null;
  /** troca o ambiente + a cor das duas luzes de acento. nao remonta objeto. */
  aplicarAmbiente: (p: Paleta) => void;
};

export function criarCena(
  canvas: HTMLCanvasElement,
  paleta: Paleta,
  opts: { transparente?: boolean; glow?: boolean; engine?: Engine } = {}
): Cena {
  // engine emprestado nao e nosso: nao destruir no dispose
  const engineProprio = !opts.engine;
  const engine =
    opts.engine ?? new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true);
  const scene = new Scene(engine);
  const transparente = opts.transparente ?? false;
  scene.clearColor = transparente
    ? new Color4(0, 0, 0, 0)
    : paleta.clara
    ? new Color4(0.82, 0.86, 0.92, 1)
    : new Color4(0, 0, 0, 1);
  scene.ambientColor = new Color3(0.02, 0.02, 0.03);

  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = 1.05;
  ip.contrast = 1.15;

  const camera = new FreeCamera("cam", new Vector3(0, 0, -8), scene);
  camera.minZ = 0.05;
  camera.maxZ = 400;
  // sem controles: quem dirige e o modo (auto/mouse/scroll)

  scene.environmentTexture = estudio(scene, paleta);
  scene.environmentIntensity = 2.4;

  // ---- luzes: uma branca forte + duas coloridas da paleta ----
  const hemi = new HemisphericLight("hemi", new Vector3(0.1, 1, 0.05), scene);
  hemi.intensity = 0.18;
  hemi.diffuse = new Color3(0.55, 0.65, 0.85);
  hemi.groundColor = new Color3(0.02, 0.02, 0.05);
  hemi.specular = new Color3(0, 0, 0);

  const mkDir = (nome: string, d: Vector3, cor: Color3, i: number) => {
    const l = new DirectionalLight(nome, d.normalize(), scene);
    l.intensity = i;
    l.diffuse = cor;
    l.specular = cor;
    return l;
  };
  mkDir("keyW", new Vector3(-0.6, -0.7, 0.4), new Color3(1, 1, 1), 3.0);
  mkDir("fillW", new Vector3(0.5, -0.2, 0.6), new Color3(0.92, 0.96, 1), 1.5);
  const lAcc1 = mkDir("acc1", new Vector3(0.7, 0.3, -0.5), paleta.acento1, 1.4);
  const lAcc2 = mkDir("acc2", new Vector3(-0.4, 0.5, -0.7), paleta.acento2, 1.2);

  // FUNDO TRANSPARENTE + LUZ ADITIVA: o blend aditivo soma a cor mas deixa o
  // alpha em 0 (ALPHA_ADD nao escreve alpha). Pixel com cor e alpha 0 e invalido
  // num canvas premultiplicado: o Chrome headless soma (por isso os prints
  // mentiam), o Chrome de verdade no Mac descarta. Orbitas, linha do grafico e
  // particulas sumiam e so o que e opaco (sol, planetas) aparecia. Um passe no
  // fim poe alpha = brilho do pixel: em fundo escuro da a mesma leitura do
  // aditivo e o navegador para de jogar fora.
  if (transparente) {
    Effect.ShadersStore["alphaDaLuzFragmentShader"] = `
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D textureSampler;
      void main(void) {
        vec4 c = texture2D(textureSampler, vUV);
        gl_FragColor = vec4(c.rgb, max(c.a, max(c.r, max(c.g, c.b))));
      }`;
    const pp = new PostProcess("alphaDaLuz", "alphaDaLuz", null, null, 1, camera);
    // o passe tira o antialias do canvas; MSAA no alvo devolve (WebGL2)
    pp.samples = engine.webGLVersion > 1 ? 4 : 1;
  }

  const glow = opts.glow ? new GlowLayer("glow", scene, { blurKernelSize: 24 }) : null;
  if (glow) glow.intensity = 0.45;

  const aplicarAmbiente = (p: Paleta) => {
    scene.environmentTexture?.dispose();
    scene.environmentTexture = estudio(scene, p);
    lAcc1.diffuse = p.acento1;
    lAcc1.specular = p.acento1;
    lAcc2.diffuse = p.acento2;
    lAcc2.specular = p.acento2;
    if (!transparente) {
      scene.clearColor = p.clara ? new Color4(0.82, 0.86, 0.92, 1) : new Color4(0, 0, 0, 1);
    }
  };

  return { engine, engineProprio, scene, camera, glow, aplicarAmbiente };
}

/**
 * A que distancia a camera cabe o objeto. Vive aqui fora porque a trilha precisa
 * do mesmo calculo pra INTERPOLAR entre o enquadramento de duas pecas: sem isso,
 * a peca que entra chega no lugar errado e o corte aparece.
 */
export function distanciaPara(
  objeto: Objeto3D,
  montado: ObjetoMontado,
  aspect: number,
  zoom: number
): number {
  const raio = typeof montado.raio === "function" ? montado.raio() : montado.raio;
  if (raio && raio > 0) {
    const meioFov = Math.tan(objeto.camera.fov / 2);
    return ((raio * 1.12) / (meioFov * Math.min(1, aspect))) * zoom;
  }
  // sem raio declarado: distancia chutada no objeto + correcao de canvas retrato
  const fit = aspect < 1 ? 1 / aspect : 1;
  return objeto.camera.distancia * zoom * fit;
}

export function montarObjeto(
  canvas: HTMLCanvasElement,
  objeto: Objeto3D,
  opts: OpcoesMontagem = {}
): Handle {
  let paleta =
    typeof opts.paleta === "string"
      ? paletaPorId(opts.paleta)
      : opts.paleta ?? paletaPorId("violeta");
  let modo = new Set<Modo>(opts.modo ?? ["auto", "mouse"]);
  let zoom = opts.zoom ?? 1;
  const transparente = opts.transparente ?? false;

  const glowOn = opts.glow ?? objeto.glow ?? objeto.custo !== "pesado";
  const cena = criarCena(canvas, paleta, {
    transparente,
    glow: glowOn,
    engine: opts.engine,
  });
  const { engine, engineProprio, scene, camera, glow } = cena;
  camera.fov = objeto.camera.fov;

  // ---- monta o objeto ----
  let montado = objeto.build(scene, paleta);

  // ---- estado do loop ----
  let t = 0;
  let mx = 0,
    my = 0,
    mxE = 0,
    myE = 0;
  let scrollE = 0;
  let explosaoAlvo: number | "scroll" = opts.explosao ?? 0;
  let explosaoE = typeof explosaoAlvo === "number" ? explosaoAlvo : 0;

  const onPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    my = ((e.clientY - r.top) / r.height - 0.5) * 2;
  };
  window.addEventListener("pointermove", onPointer);

  const scrollSource =
    opts.scrollSource ??
    (() => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      return clamp01(window.scrollY / max);
    });

  const onResize = () => engine.resize();
  window.addEventListener("resize", onResize);

  // Um PASSO da simulação, separado do loop de propósito.
  //
  // Com dtForcado ele roda sem depender de requestAnimationFrame — que o browser
  // estrangula em aba de segundo plano. Sem isso, quem gera imagem fora da tela
  // captura o objeto ANTES do primeiro update(): thin instance com matriz zerada
  // é objeto que não existe, e a foto sai preta.
  const passo = (dtForcado?: number) => {
    // dtReal = relogio. So as suavizacoes do runtime usam ele: elas seguem o
    // tempo de parede mesmo quando a simulacao esta sendo dirigida pelo scroll.
    const dtReal = dtForcado ?? Math.min(0.05, engine.getDeltaTime() / 1000);

    const sT = modo.has("scroll") ? clamp01(scrollSource()) : 0;
    scrollE += (sT - scrollE) * Math.min(1, dtReal * 6);

    const wantMouse = modo.has("mouse");
    mxE += ((wantMouse ? mx : 0) - mxE) * Math.min(1, dtReal * 4);
    myE += ((wantMouse ? my : 0) - myE) * Math.min(1, dtReal * 4);

    // explosao suavizada: em degrau, a peca teleporta e some a leitura de
    // "desmontou". o lerp e o que faz a peca VIAJAR pra fora.
    //
    // "scroll" le a FONTE, nao o scrollE. O scrollE e zero fora do modo scroll
    // (a mesma armadilha do f.scroll, ver README), e o snippet do lab sai com
    // modo auto+mouse e explosao "scroll": nesse combo, o default, a peca nunca
    // desmontava no site. Ler a fonte direto tambem e o que deixa o host prender
    // a explosao ao progresso de UMA secao sem ligar o modo scroll — que trocaria
    // o relogio por t = scroll * 14 e frearia quem anima sozinho.
    const eAlvo = explosaoAlvo === "scroll" ? clamp01(scrollSource()) : explosaoAlvo;
    explosaoE += (eAlvo - explosaoE) * Math.min(1, dtReal * 5);

    // O SCROLL DIRIGE O TEMPO.
    //
    // Sem isto, "modo scroll" so somava um giro em Y por cima de uma animacao
    // que corria sozinha no relogio: rolar nao adiantava a peca, parar nao
    // parava ela, e subir a pagina nao desfazia nada. Objeto com autoRotacao
    // false ficava 100% inerte — 16 dos 55 nao reagiam a scroll nenhum.
    //
    // Aqui o scroll VIRA a linha do tempo (t = scroll * DURACAO_SCROLL), e o dt
    // vira a diferenca — inclusive NEGATIVA quando a pagina sobe. Com isso todo
    // objeto que anima em funcao de t faz scrub de graca, sem saber que scroll
    // existe. Foi o que permitiu nao tocar em 53 dos 55 arquivos.
    //
    // Custo: quem ACUMULA estado (nao e funcao pura de t) precisa aguentar dt
    // negativo. Ver README, "Objeto que nao volta".
    let dtSim: number;
    if (modo.has("scroll")) {
      const tAlvo = scrollE * DURACAO_SCROLL;
      dtSim = tAlvo - t;
      t = tAlvo;
    } else {
      dtSim = dtReal;
      t += dtReal;
    }

    const f: Frame = { t, dt: dtSim, scroll: scrollE, mx: mxE, my: myE, explosao: explosaoE };

    // rotacao base: o objeto pode sobrescrever no update(), ou recusar de vez
    // via autoRotacao:false quando tem eixo proprio (tunel, malha).
    if (objeto.autoRotacao !== false) {
      // no modo scroll o proprio t JA e o scroll, entao isto ja vira giro por
      // rolagem. Somar scrollE de novo aqui dobrava o efeito.
      if (modo.has("auto")) montado.root.rotation.y = t * 0.14;
      else if (modo.has("scroll")) montado.root.rotation.y = scrollE * Math.PI * 1.6;
    }

    montado.update?.(f);

    // ENQUADRAMENTO
    // O Babylon fixa o FOV na vertical, entao canvas retrato (todo celular, e o
    // viewer deste lab) corta pelos lados.
    //
    // Se o objeto informou seu raio, calcula a distancia exata pra caber nos dois
    // eixos. Senao, cai no modo antigo: distancia declarada + correcao do formato.
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const d = distanciaPara(objeto, montado, aspect, zoom);
    camera.position.set(mxE * d * 0.11, (objeto.camera.alturaAlvo ?? 0) + myE * d * -0.07, -d);
    camera.setTarget(new Vector3(0, objeto.camera.alturaAlvo ?? 0, 0));

    scene.render();
  };
  // o loop precisa de nome: num engine compartilhado, stopRenderLoop() sem
  // argumento mataria também os loops dos outros donos do engine.
  const loop = () => passo();
  let pausado = false;
  engine.runRenderLoop(loop);

  const aplicarPaleta = (p: Paleta) => {
    paleta = p;
    cena.aplicarAmbiente(p);
    remontar();
  };

  // rebuild: a cor do corpo e do objeto, nao do runtime. mais barato e mais
  // honesto do que o runtime tentar adivinhar quais materiais existem la dentro.
  const remontar = () => {
    montado.root.dispose(false, true);
    montado = objeto.build(scene, paleta);
  };

  const pronto = new Promise<void>((res) => scene.executeWhenReady(() => res()));

  // reusado em toda projecao: o host chama isto pra cada rotulo, todo frame
  const projTmp = new Vector3();

  return {
    scene,
    engine,
    pronto,
    setPaleta: aplicarPaleta,
    setExplosao: (v) => {
      explosaoAlvo = v;
    },
    setModo: (m) => {
      modo = new Set(m);
    },
    setZoom: (z) => {
      zoom = z;
    },
    snapshot: (segundos = 0.45) => {
      // roda a simulação na mão antes de capturar: não depende do rAF (que é
      // estrangulado em aba de fundo) e é determinístico — a mesma miniatura sai
      // igual toda vez, em vez de depender de quantos frames deu tempo de rodar.
      const passos = Math.max(1, Math.round(segundos / 0.016));
      for (let i = 0; i < passos; i++) passo(0.016);
      return canvas.toDataURL("image/webp", 0.72);
    },
    ancoras: () => montado.ancoras?.() ?? [],
    projetar: (pos) => {
      // pixel CSS, nao pixel de render: o canvas renderiza em devicePixelRatio,
      // mas o rotulo HTML vive no espaco do layout. A matriz e a do ultimo
      // render, entao o rotulo acompanha exatamente o frame que esta na tela.
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      Vector3.ProjectToRef(
        pos,
        Matrix.IdentityReadOnly,
        scene.getTransformMatrix(),
        camera.viewport.toGlobal(w, h),
        projTmp
      );
      return { x: projTmp.x, y: projTmp.y };
    },
    pausar: (sim) => {
      if (sim === pausado) return;
      pausado = sim;
      if (sim) engine.stopRenderLoop(loop);
      else engine.runRenderLoop(loop);
    },
    dispose: () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      engine.stopRenderLoop(loop); // só o nosso
      scene.dispose();
      if (engineProprio) engine.dispose(); // engine emprestado é de quem passou
    },
  };
}
