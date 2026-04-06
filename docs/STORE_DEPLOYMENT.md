# Publicar Napzinho (Google Play e App Store)

Este repositório é um **PWA** (site que pode ser instalado): `index.html`, `manifest.webmanifest`, `sw.js`, pasta `icons/`.

## O que já está pronto no código

- **Instalar no celular** (Chrome/Safari): “Adicionar à tela inicial”.
- **Modo offline** após o primeiro carregamento (service worker + cache; fontes do Google podem precisar de rede na primeira vez).
- **HTTPS obrigatório** em produção (lojas e PWA exigem).

## Google Play (Android)

A loja **não aceita só um arquivo HTML**. O caminho usual é:

1. Hospedar o site em **HTTPS** (GitHub Pages, Netlify, Cloudflare Pages, etc.).
2. Empacotar o mesmo URL num **Trusted Web Activity (TWA)** com **Bubblewrap** ou **PWA Builder**, gerando um **Android App Bundle (.aab)**.
3. Criar conta de desenvolvedor Google Play, ficha do app, ícones, política de privacidade (dados só no aparelho = texto simples).
4. Enviar o `.aab` para revisão.

Documentação: [Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity) e [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap).

## App Store (iPhone — Apple)

A Apple **não instala PWAs na loja** como app nativo; o usuário usa **Safari → Compartilhar → Adicionar à Tela de Início**.

Para **App Store** com o mesmo código web, é preciso um **invólucro nativo** (por exemplo **Capacitor** ou **Cordova**), empacotar com **Xcode**, assinatura Apple, e atender às [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

## O que não dá para “implementar” só no `index.html`

- **Cobrança in-app** (assinatura): exige backend + SDKs das lojas ou plataforma (RevenueCat, etc.).
- **Sincronização na nuvem**: backend e contas.
- **Apple Health / Google Fit**: APIs nativas ou bridge (Capacitor).
- **Widget na tela inicial**: nativo (Android/iOS) ou atalhos limitados.

## Checklist rápido antes de publicar

- [ ] Site em **HTTPS** com mesmo domínio do `start_url` do manifest.
- [ ] Testar instalação e uso **offline** no dispositivo real.
- [ ] Política de privacidade (mesmo que curta: dados locais, sem servidor).
- [ ] Ícones 192/512 e **maskable** (pasta `icons/`, regenerar com `python3 scripts/generate_icons.py` se mudar a arte).
