# Google OS Desktop (Electron)

Empacota o Google OS como um app de mesa. A janela principal é o próprio
Google OS (a mesma interface web). Para **Docs, Sheets, Slides, Meet e Chat**
— os únicos apps que dependem 100% da versão oficial do Google e não podem
ser recriados — o app abre uma **janela Chrome de verdade** apontando direto
para `docs.google.com`, `meet.google.com` etc., em vez de tentar simular
esses editores.

Isso só é possível no desktop: na web, o próprio Google bloqueia esses sites
dentro de `<iframe>` (`X-Frame-Options`), então lá a alternativa é abrir em
nova aba do navegador. No Electron não existe essa restrição porque cada
"app" abre em sua própria janela de nível superior — exatamente como o Chrome
faria.

## Por que isso importa

- Todas as janelas (a principal e as dos apps do Google) compartilham a
  **mesma sessão** (`persist:google-os`). Ou seja: você faz login no Google
  uma vez e ele vale para todas as janelas, como abas do mesmo navegador.
- Nenhuma credencial passa pelo processo principal do Electron: as janelas de
  apps do Google (`desktop/main.js` → `openGoogleAppWindow`) rodam com
  `contextIsolation: true`, `nodeIntegration: false` e `sandbox: true` — são
  só uma janela de navegador isolada carregando o site real do Google.

## Rodando localmente

```bash
# Terminal 1: sobe o frontend em modo dev
npm run dev

# Terminal 2: abre o shell desktop apontando para o dev server
npm run electron:dev
```

## Gerando o instalador

```bash
npm run electron:build
```

Gera o pacote em `release/` (AppImage no Linux, `.exe`/NSIS no Windows,
`.app`/`.dmg` no macOS via `electron-builder`, configurado em `package.json`).

## Limitações conhecidas

- Sem ícone customizado configurado ainda (`electron-builder` usa o ícone
  padrão). Adicione `build.mac.icon` / `build.win.icon` / `build.linux.icon`
  em `package.json` apontando para seus próprios arquivos `.icns`/`.ico`/`.png`
  se quiser personalizar.
- O download do binário do Electron (~200 MB) acontece durante `npm install`
  e requer acesso direto ao GitHub Releases — em redes corporativas com
  proxy restrito, configure a variável `ELECTRON_MIRROR` conforme a
  [documentação oficial](https://www.electronjs.org/docs/latest/tutorial/installation#custom-mirrors-and-caches).
