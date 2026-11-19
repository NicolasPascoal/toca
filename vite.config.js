import { defineConfig, loadEnv } from 'vite';
import { tocaApi } from './brain/api.js';

export default defineConfig(({ mode }) => {
  // Coloca as variáveis do .env (ANTHROPIC_API_KEY etc.) no process.env do servidor.
  // Elas nunca vão para o navegador: só variáveis com prefixo VITE_ seriam expostas.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  return {
    server: { host: '127.0.0.1', port: 5520 },
    plugins: [{
      name: 'toca-api',
      configureServer(server) { server.middlewares.use(tocaApi()); },
    }],
  };
});
