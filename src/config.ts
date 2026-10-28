// Dados que mudam sem mexer em layout. O que está [A PREENCHER] depende do Matheus.

/** WhatsApp da MestMidia, só dígitos com DDI (ex.: 5534999999999). [A PREENCHER] */
export const WHATSAPP = "";
export const WA_TEXT = "Oi! Vim pelo site da MestMidia e quero conversar sobre anúncios para o meu negócio.";

/** Instagram da MestMidia (URL completa). Vazio = o link some do rodapé. [A PREENCHER] */
export const INSTAGRAM = "";

export const waLink = () =>
  WHATSAPP
    ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(WA_TEXT)}`
    : `https://wa.me/?text=${encodeURIComponent(WA_TEXT)}`;

/** Sites e páginas: prints em /assets/sites/{slug}-sm.webp. Autorizados pelo Leonardo. 10 por faixa. */
export const SITES: { slug: string; name: string; segment: string }[] = [
  // faixa de cima
  { slug: "wigga", name: "Wigga", segment: "Esquadrias de PVC" },
  { slug: "constru-facil", name: "Constru Fácil", segment: "Pedras e churrasqueiras" },
  { slug: "toque-e-retoque", name: "Toque & Retoque", segment: "Acabamentos" },
  { slug: "pedras-decorativas", name: "Pedras Decorativas", segment: "Pedras decorativas" },
  { slug: "gervasio-marmores", name: "Gervásio Mármores", segment: "Marmoraria" },
  { slug: "al-revestimentos", name: "AL Revestimentos", segment: "Revestimentos" },
  { slug: "elisangela-selau", name: "Elisângela Selau", segment: "Arquitetura" },
  { slug: "iiot", name: "IIOT", segment: "Indústria" },
  { slug: "agata-aesthetics", name: "Agata Aesthetics", segment: "Estética médica" },
  { slug: "vessar", name: "Vessar", segment: "Mercado financeiro" },
  // faixa de baixo
  { slug: "vougue-festas", name: "Vougue Festas", segment: "Casa de festas" },
  { slug: "aeroprev", name: "AeroPrev", segment: "Direito previdenciário" },
  { slug: "race-valley", name: "Race Valley", segment: "Evento esportivo" },
  { slug: "bip-vale", name: "BIP Vale", segment: "Loteamento empresarial" },
  { slug: "lizzy-prime", name: "Lizzy Prime", segment: "Consórcio" },
  { slug: "pedras-do-brasil", name: "Pedras do Brasil", segment: "Pedra natural" },
  { slug: "fino-acabamento", name: "Fino Acabamento", segment: "Porcelanato" },
  { slug: "tadex", name: "Tadex", segment: "Transportadora" },
  { slug: "invista-capital", name: "Invista Capital", segment: "Consórcio" },
  { slug: "neuro-summit", name: "Neuro Summit", segment: "Evento científico" },
];

/** Criativos que rodaram. src vazio = moldura de espera. [A PREENCHER com o Matheus] */
export const ADS: { src: string; segment: string; meta: string; result: string }[] = [
  { src: "", segment: "Loja de roupas", meta: "Meta Ads · Conversas no WhatsApp", result: "[A PREENCHER]" },
  { src: "", segment: "Clínica", meta: "Google Ads · Agendamentos", result: "[A PREENCHER]" },
  { src: "", segment: "E-commerce", meta: "Meta Ads · Vendas no site", result: "[A PREENCHER]" },
  { src: "", segment: "Serviço local", meta: "TikTok Ads · Alcance na região", result: "[A PREENCHER]" },
  { src: "", segment: "Restaurante", meta: "Meta Ads · Pedidos no WhatsApp", result: "[A PREENCHER]" },
];

/** Painel ILUSTRATIVO (o selo "Valores ilustrativos" fica na tela). */
export const DASH = {
  meta: {
    invest: 4800,
    conv: 412,
    cpc: 11.65,
    ret: 38600,
    serie: [12, 18, 16, 24, 29, 27, 36, 41, 39, 52, 58, 66],
  },
  google: {
    invest: 3200,
    conv: 238,
    cpc: 13.45,
    ret: 27400,
    serie: [10, 13, 15, 14, 19, 23, 26, 25, 31, 35, 41, 47],
  },
};
