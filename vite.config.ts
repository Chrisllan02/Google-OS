import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { handleGeminiRequest } from './api/_lib/gemini';

const MAX_BODY_BYTES = 64 * 1024;
const BODY_READ_TIMEOUT_MS = 10_000;

function geminiDevApi(envKey: string | undefined): Plugin {
  return {
    name: 'gemini-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/gemini', async (req, res) => {
        const send = (status: number, body: object) => {
          if (res.writableEnded) return;
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        const chunks: Buffer[] = [];
        let size = 0;
        let timedOut = false;
        const readTimer = setTimeout(() => {
          timedOut = true;
          send(408, { error: 'Tempo limite de leitura da requisição excedido.' });
          req.destroy();
        }, BODY_READ_TIMEOUT_MS);

        try {
          for await (const chunk of req) {
            if (timedOut) return;
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
              send(413, { error: 'Requisição muito grande.' });
              return;
            }
            chunks.push(chunk);
          }
        } catch {
          send(400, { error: 'Conexão interrompida ao ler a requisição.' });
          return;
        } finally {
          clearTimeout(readTimer);
        }

        if (timedOut) return;
        let body: unknown;
        if (chunks.length) {
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            send(400, { error: 'Requisição inválida.' });
            return;
          }
        }
        try {
          const { status, body: result } = await handleGeminiRequest(
            { method: req.method ?? '', body, ip: req.socket.remoteAddress ?? 'unknown' },
            process.env.GEMINI_API_KEY ?? envKey,
          );
          send(status, result);
        } catch {
          send(500, { error: 'Erro interno ao processar requisição.' });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      preview: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true,
      },
      plugins: [
        tailwindcss(),
        react(),
        geminiDevApi(env.GEMINI_API_KEY),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
          manifest: {
            id: '/',
            name: 'Google OS',
            short_name: 'Google OS',
            description: 'Ambiente de produtividade local-first conectado diretamente à sua conta Google Workspace.',
            theme_color: '#ffffff',
            background_color: '#f0f4f9',
            display: 'standalone',
            start_url: '/',
            scope: '/',
            icons: [
              {
                src: '/pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: '/pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: '/pwa-maskable-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
            ],
          },
          devOptions: {
            enabled: true,
            type: 'module',
          },
        }),
      ],
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) return undefined;
              if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
                return 'vendor-react';
              }
              if (id.includes('/firebase/') || id.includes('/@firebase/')) {
                return 'vendor-firebase';
              }
              if (id.includes('/peerjs/')) return 'vendor-peerjs';
              if (id.includes('/lucide-react/')) return 'vendor-icons';
              if (id.includes('/ogl/')) return 'vendor-webgl';
              return undefined;
            },
          },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
