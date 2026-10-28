// PALETAS
// Mesmo objeto, cliente diferente. Trocar paleta nao remodela nada:
// muda albedo, cor das luzes e as cores do estudio de reflexo.
// Regra que descobri na marra: acento1 e acento2 precisam ser DIFERENTES
// em matiz, senao o objeto le como uma mancha unica sem volume.

import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Paleta } from "./types";

const c = (hex: string) => Color3.FromHexString(hex);

export const PALETAS: Paleta[] = [
  {
    id: "violeta",
    nome: "Violeta",
    base: c("#291f4d"),
    acento1: c("#8b7bff"),
    acento2: c("#37e6c8"),
    emissivo: c("#0d0820"),
  },
  {
    id: "vidro-preto",
    nome: "Vidro preto",
    base: c("#04050c"),
    acento1: c("#5a8dff"),
    acento2: c("#8ea3c9"),
    emissivo: c("#000000"),
  },
  {
    id: "dourado",
    nome: "Dourado",
    base: c("#3d2c10"),
    acento1: c("#ffc563"),
    acento2: c("#fff1cf"),
    emissivo: c("#150d02"),
  },
  {
    id: "navy",
    nome: "Navy",
    base: c("#0d2141"),
    acento1: c("#4aa3ff"),
    acento2: c("#c9e4ff"),
    emissivo: c("#03080f"),
  },
  {
    id: "turquesa",
    nome: "Turquesa",
    base: c("#0a3b39"),
    acento1: c("#2fe0c0"),
    acento2: c("#7ee8ff"),
    emissivo: c("#02100f"),
  },
  {
    id: "carmim",
    nome: "Carmim",
    base: c("#3d0f18"),
    acento1: c("#ff5a6e"),
    acento2: c("#ffb08a"),
    emissivo: c("#120306"),
  },
  {
    id: "esmeralda",
    nome: "Esmeralda",
    base: c("#0b2e1c"),
    acento1: c("#3ddc84"),
    acento2: c("#d6ffb5"),
    emissivo: c("#020e07"),
  },
  {
    id: "cromo",
    nome: "Cromo",
    base: c("#2a2d33"),
    acento1: c("#ffffff"),
    acento2: c("#9fb2cc"),
    emissivo: c("#000000"),
  },
  {
    id: "magenta",
    nome: "Magenta",
    base: c("#3a0f33"),
    acento1: c("#ff5ad6"),
    acento2: c("#7b6bff"),
    emissivo: c("#12030f"),
  },
  {
    id: "cobre",
    nome: "Cobre",
    base: c("#3b1d10"),
    acento1: c("#ff8f52"),
    acento2: c("#ffd9a8"),
    emissivo: c("#130701"),
  },
  {
    id: "porcelana",
    nome: "Porcelana",
    base: c("#d9dee8"),
    acento1: c("#ffffff"),
    acento2: c("#9ab0d4"),
    emissivo: c("#000000"),
    clara: true,
  },
  {
    id: "gelo",
    nome: "Gelo",
    base: c("#c3dcf0"),
    acento1: c("#ffffff"),
    acento2: c("#69b7ff"),
    emissivo: c("#000000"),
    clara: true,
  },
];

export const paletaPorId = (id: string) =>
  PALETAS.find((p) => p.id === id) ?? PALETAS[0];

/**
 * Paleta inteira derivada de um hex (o "escolher a cor na mão").
 *
 * Um hex sozinho nao da uma paleta: o objeto precisa de um corpo escuro pra ter
 * silhueta e de um SEGUNDO acento de matiz diferente pra ter volume. Com os dois
 * acentos no mesmo matiz o objeto vira mancha chapada — foi a primeira coisa que
 * ficou clara montando as 12 paletas curadas.
 *
 * Por isso: acento1 = o hex escolhido. acento2 = matiz girado 150 graus, a menos
 * que venha explicito. base = o mesmo matiz rebaixado a corpo escuro (ou claro,
 * se o hex for claro demais pra ler no preto).
 */
export function paletaDeHex(hex1: string, hex2?: string): Paleta {
  const a1 = c(hex1);
  const hsv = a1.toHSV(); // r = matiz 0..360, g = saturacao, b = valor

  // Paleta clara = cor PALIDA (porcelana, gelo), nao cor luminosa. Um verde-limao
  // tem luminancia alta e saturacao alta: ele quer brilhar contra o preto, nao
  // virar fundo branco. So luminancia como criterio mandava limao pro tema claro.
  const lum = a1.r * 0.299 + a1.g * 0.587 + a1.b * 0.114;
  const clara = lum > 0.74 && hsv.g < 0.4;

  let a2: Color3;
  if (hex2) {
    a2 = c(hex2);
  } else {
    a2 = new Color3();
    Color3.HSVtoRGBToRef(
      (hsv.r + 150) % 360,
      Math.max(0.12, hsv.g * 0.7),
      Math.min(1, hsv.b * 1.05 + 0.18),
      a2
    );
  }

  const base = new Color3();
  Color3.HSVtoRGBToRef(
    hsv.r,
    Math.min(1, hsv.g * 1.05),
    clara ? Math.max(0.62, hsv.b * 0.9) : Math.max(0.035, hsv.b * 0.22),
    base
  );

  return {
    id: "hex:" + hex1 + (hex2 ?? ""),
    nome: hex1.toUpperCase(),
    base,
    acento1: a1,
    acento2: a2,
    emissivo: clara ? new Color3(0, 0, 0) : base.scale(0.26),
    clara,
  };
}

/** o acento2 que paletaDeHex() geraria sozinho — pra mostrar no seletor */
export const acento2Derivado = (hex1: string) => paletaDeHex(hex1).acento2.toHexString();
