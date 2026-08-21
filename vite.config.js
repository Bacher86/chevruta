import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Rutas relativas para que funcione en GitHub Pages, sin importar el
  // nombre del repositorio (usuario.github.io/nombre-del-repo/).
  base: "./",
  build: {
    rollupOptions: {
      output: {
        // Todo en un único archivo JS, incluso los imports dinámicos
        // (como el de los minijuegos). Así el build sigue siendo
        // compatible con el flujo de "un solo HTML" para GitHub Pages.
        inlineDynamicImports: true,
      },
    },
  },
});
