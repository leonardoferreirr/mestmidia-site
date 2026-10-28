// CONTRATO DO OBJETO 3D
//
// Regra de ouro deste lab: um objeto NAO sabe que a galeria existe.
// Ele recebe uma cena e uma paleta, devolve um root + um update opcional.
// Por isso instalar num site de cliente = copiar 2 arquivos (runtime.ts +
// o objeto) e chamar montarObjeto(). Se um objeto comecar a importar
// qualquer coisa de app.ts / gallery / thumbs, o reuso quebra.

import type { Scene, Color3, TransformNode, Vector3 } from "@babylonjs/core";

export type Paleta = {
  id: string;
  nome: string;
  /** cor do corpo do objeto */
  base: Color3;
  /** acento principal: luzes e reflexos dominantes */
  acento1: Color3;
  /** acento secundario: contraluz, define a "segunda cor" do brilho */
  acento2: Color3;
  /** brilho proprio. quase sempre baixo — emissive alto mata o material */
  emissivo: Color3;
  /** true = paleta clara (inverte o fundo do estudio) */
  clara?: boolean;
};

/** Estado do frame entregue ao update() do objeto. */
export type Frame = {
  /** segundos desde o mount */
  t: number;
  /** delta em segundos */
  dt: number;
  /** 0..1 — scroll da pagina, ja suavizado. no lab, o slider. */
  scroll: number;
  /** -1..1 — mouse suavizado */
  mx: number;
  my: number;
  /** 0..1 — vista explodida: 0 montado, 1 peças separadas. já suavizado.
   *  o runtime só entrega o valor; QUEM sabe se desmontar é o objeto, porque só
   *  ele sabe o que é peça e pra onde ela vai. */
  explosao: number;
};

export type ObjetoMontado = {
  root: TransformNode;
  /** roda todo frame. opcional: objeto parado tambem e objeto. */
  update?: (f: Frame) => void;
  /**
   * Raio da esfera que envolve o objeto, em unidade de cena. Se vier, o runtime
   * CALCULA a distancia da camera pra caber, em vez de usar camera.distancia.
   *
   * Existe porque enquadramento fixo no codigo e chute: errei em 4 objetos na
   * mao antes de desistir de adivinhar. Objeto que sabe seu tamanho informa aqui.
   *
   * Pode ser funcao: objeto que muda de tamanho (vista explodida) devolve o raio
   * do frame atual e a camera acompanha. Com raio fixo, as pecas saem do quadro
   * ao desmontar.
   */
  raio?: number | (() => number);
  /**
   * Pontos do objeto que o HOST rotula em HTML por cima do canvas. Opcional:
   * so quem tem partes com nome (o Sistema Orbital: cada planeta e um canal)
   * declara.
   *
   * Existe porque texto desenhado no WebGL sai borrado, nao e selecionavel e o
   * leitor de tela nao ve. O objeto continua sem saber que HTML existe: ele so
   * diz ONDE estao as partes e se elas devem aparecer; quem desenha o rotulo e
   * o site. A projecao pro ecra e do runtime (`Handle.projetar`), porque so
   * ele conhece a camera.
   *
   * Lido UMA vez por frame, depois do render (scene.onAfterRenderObservable):
   * antes disso `pos` ainda e do frame anterior e o rotulo descola da peca.
   */
  ancoras?: () => Ancora[];
};

/** Ponto rotulavel do objeto. Ver `ObjetoMontado.ancoras`. */
export type Ancora = {
  /** estavel: o host mapeia por id pro proprio texto (traducao, troca de copy) */
  id: string;
  /** nome default, pra quem nao quiser mapear */
  nome: string;
  /** posicao em coordenada de MUNDO, do frame atual. o objeto pode reusar o
   *  mesmo Vector3 entre frames: copie se precisar guardar. */
  pos: Vector3;
  /** 0..1: o host usa como opacidade. 0 = rotulo nao deve aparecer. */
  visivel: number;
};

export type CustoGPU = "leve" | "medio" | "pesado";

export type Objeto3D = {
  /** slug. vira o nome do arquivo e a url. */
  id: string;
  /** nome que aparece no card */
  nome: string;
  tags: string[];

  // ---- notas internas: nao aparecem na tela, existem pro Leonardo do mes 6 ----
  /** pra que tipo de cliente esse objeto serve */
  serve: string;
  /** quanto custa de GPU. "pesado" = nao poe em site com celular fraco no publico. */
  custo: CustoGPU;
  /** o que ja se sabe que da errado nele */
  nota?: string;
  /** objeto ja emissivo nao quer glow: o blur satura e lava a tela inteira.
   *  default: liga, exceto em objeto "pesado". */
  glow?: boolean;

  /** false = o runtime NAO gira o objeto em Y nos modos auto/scroll; o update()
   *  do objeto assume o controle. Necessario pra quem tem eixo proprio (o tunel
   *  girado em Y vira um corredor visto de lado). default: true. */
  autoRotacao?: boolean;

  /** true = o objeto usa f.explosao no update() e sabe se desmontar. o viewer
   *  so mostra o controle de explosao pra quem declara. */
  explode?: boolean;

  /** arquivos extras que o snippet precisa listar alem do proprio objeto.
   *  a regra continua: objeto nao importa da GALERIA. importar um motor vizinho
   *  de objects/ e permitido desde que declarado aqui — senao o snippet manda
   *  copiar 1 arquivo e o cliente quebra com "module not found". */
  arquivos?: string[];

  /** enquadramento default */
  camera: { distancia: number; fov: number; alturaAlvo?: number };

  build: (scene: Scene, paleta: Paleta) => ObjetoMontado;
};
