import { defineConfig, type Plugin } from "vite";

// CSS dentro do HTML: o <link> separado bloqueava a primeira pintura por ~0,7 s
// no 4G do celular (uma ida e volta a mais antes de desenhar qualquer coisa).
function cssNoHtml(): Plugin {
  return {
    name: "css-no-html",
    apply: "build",
    enforce: "post",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        return html.replace(/<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/g, (tag, arquivo) => {
          const css = bundle[arquivo];
          if (!css || css.type !== "asset") return tag;
          delete bundle[arquivo];
          return `<style>${String(css.source)}</style>`;
        });
      },
    },
  };
}

export default defineConfig({
  server: { port: 5340 },
  plugins: [cssNoHtml()],
  build: { target: "es2022", cssCodeSplit: false, assetsInlineLimit: 0 },
});
