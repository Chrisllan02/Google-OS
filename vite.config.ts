import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { handleGeminiRequest } from './api/_lib/gemini';

const MAX_BODY_BYTES = 64 * 1024;

function geminiDevApi(envKey: string | undefined): Plugin {
  return {
    name: 'gemini-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/gemini', async (req, res) => {
        const send = (status: number, body: object) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) {
            send(413, { error: 'Requisição muito grande.' });
            return;
          }
          chunks.push(chunk);
        }
        let body: unknown;
        if (chunks.length) {
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            send(400, { error: 'Requisição inválida.' });
            return;
          }
        }
        const { status, body: result } = await handleGeminiRequest(
          { method: req.method ?? '', body, ip: req.socket.remoteAddress ?? 'unknown' },
          process.env.GEMINI_API_KEY ?? envKey,
        );
        send(status, result);
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
      },
      preview: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: true,
      },
      plugins: [react(), geminiDevApi(env.GEMINI_API_KEY)],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
