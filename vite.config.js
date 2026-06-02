import { defineConfig } from 'vite';

// Configuración de Vite (herramienta que levanta y compila el frontend).
export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',      // carpeta que se genera al compilar (npm run build)
    emptyOutDir: true,
  },
  server: {
    port: 5173,          // dirección local: http://localhost:5173
    open: true,
  },
});
