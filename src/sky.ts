// Céu da página inteira: estrelas em 3 profundidades + duas nebulosas da marca.
// Fixo atrás de tudo. Paralaxe pelo scroll (a mais perto anda mais), cintilar
// leve, 30 fps, para quando a aba some. É o "navegar no universo" entre seções.

type Estrela = { x: number; y: number; r: number; z: number; f: number; a: number };

export function ceu(cv: HTMLCanvasElement, reduz: boolean) {
  const ctx = cv.getContext("2d", { alpha: false });
  if (!ctx) return;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  let W = 0;
  let H = 0;
  let estrelas: Estrela[] = [];
  let nebulosa: HTMLCanvasElement | null = null;

  const montar = () => {
    W = innerWidth;
    H = innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(260, (W * H) / 5200));
    // semente fixa: o céu não muda a cada resize
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    estrelas = Array.from({ length: n }, () => {
      const z = rnd();
      return { x: rnd() * W, y: rnd() * H * 3, r: 0.35 + z * 1.1, z, f: rnd() * Math.PI * 2, a: 0.25 + z * 0.6 };
    });
    // nebulosas pintadas uma vez num canvas fora da tela
    nebulosa = document.createElement("canvas");
    nebulosa.width = Math.round(W / 2);
    nebulosa.height = Math.round(H / 2);
    const n2 = nebulosa.getContext("2d")!;
    const blob = (x: number, y: number, r: number, cor: string) => {
      const g = n2.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, cor);
      g.addColorStop(1, "rgba(4,6,10,0)");
      n2.fillStyle = g;
      n2.fillRect(0, 0, nebulosa!.width, nebulosa!.height);
    };
    const w = nebulosa.width;
    const h = nebulosa.height;
    blob(w * 0.78, h * 0.28, w * 0.55, "rgba(0,89,252,0.16)");
    blob(w * 0.12, h * 0.9, w * 0.5, "rgba(0,242,222,0.07)");
  };

  let ultimo = 0;
  let rodando = true;
  const desenhar = (now: number) => {
    if (!rodando) return;
    requestAnimationFrame(desenhar);
    if (now - ultimo < 33) return; // ~30 fps basta pra estrela
    ultimo = now;
    const y = scrollY;
    ctx.fillStyle = "#04060a";
    ctx.fillRect(0, 0, W, H);
    if (nebulosa) {
      const desloc = (y * 0.04) % H;
      ctx.globalAlpha = 1;
      ctx.drawImage(nebulosa, 0, -desloc * 0.5, W, H);
    }
    const t = now / 1000;
    for (const e of estrelas) {
      const py = (((e.y - y * (0.05 + e.z * 0.22)) % (H * 3)) + H * 3) % (H * 3);
      if (py > H) continue;
      const tw = reduz ? 1 : 0.65 + 0.35 * Math.sin(t * (0.6 + e.z) + e.f);
      ctx.globalAlpha = e.a * tw;
      ctx.fillStyle = e.z > 0.8 ? "#bfe9ff" : "#ffffff";
      ctx.beginPath();
      ctx.arc(e.x, py, e.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  montar();
  requestAnimationFrame(desenhar);
  addEventListener("resize", montar);
  document.addEventListener("visibilitychange", () => {
    rodando = !document.hidden;
    if (rodando) requestAnimationFrame(desenhar);
  });
}
