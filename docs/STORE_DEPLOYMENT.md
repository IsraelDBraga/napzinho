# Publicar Napzinho (Google Play e App Store)

Este repositório é um **PWA estático** (`index.html`, `manifest.webmanifest`, `sw.js`, `icons/*`).

## TL;DR (ELI5)

- Hoje você tem um **site instalável** (PWA), não um app nativo de loja.
- Para a **Play Store**, você “embrulha” seu site em um app Android com **TWA** e envia um `.aab`.
- Para a **App Store**, você cria um “casco” iOS com **Capacitor** (ou similar), abre no Xcode e envia para revisão.
- Compras dentro da loja (assinatura) exigem SDK nativo + backend de validação (detalhes em `docs/IN_APP_PURCHASES.md`).

---

## O que já está pronto no código

- Manifest configurado (nome, ícones, `display: standalone`, idioma pt-BR).
- Service worker com cache de shell/offline após primeiro acesso.
- Ícones essenciais em `icons/`.
- Já existem docs de referência no repo (`docs/STORE_DEPLOYMENT.md` e `docs/IN_APP_PURCHASES.md`) com o caminho de publicação e monetização.

---

## Diagnóstico de prontidão (hoje)

### ✅ Pronto / bom sinal

- Base PWA funcional (`index.html`, `manifest.webmanifest`, `sw.js`).
- Offline básico após primeiro carregamento.
- App já roda sem build step e sem backend obrigatório para uso local.

### ⚠️ Falta para publicar de verdade

1. **Hospedagem HTTPS de produção** (domínio estável).
2. **Páginas legais públicas**:
   - Política de privacidade
   - Termos de uso
   - Página de suporte/contato
3. **Empacotamento nativo por loja**:
   - Android: TWA (Bubblewrap/PWA Builder)
   - iOS: wrapper nativo (Capacitor/Cordova)
4. **Metadados de loja**:
   - screenshots reais de celular
   - descrição curta/longa
   - faixa etária/classificação de conteúdo
5. **Plano de versão e suporte**:
   - versionamento (`1.0.0`, `1.0.1`...)
   - canal de feedback/bugs
6. **Se houver pagamento**: validação server-side de compras (não só cliente).
   - Endpoint já previsto no backend: `POST /api/purchase/validate`.

### Veredito

**Ainda não está “pronto para subir agora” nas lojas sem ajustes.**
Está em um estágio muito bom de produto PWA e com caminho claro para lançamento.

---

## Passo a passo (ELI5) — Google Play

### Fase A — Preparar a casa

1. **Suba o site em HTTPS** (ex.: Cloudflare Pages, Netlify, Vercel).
2. Confirme que `https://seu-dominio/index.html` abre no celular.
3. Teste offline: abre uma vez com internet, fecha, ativa modo avião, abre de novo.
4. Congele uma versão estável (ex.: `v1.0.0`).

### Fase B — Transformar em app Android

5. Instale Bubblewrap (ou use PWA Builder).
6. Gere o projeto Android apontando para sua URL HTTPS.
7. Configure ícone, nome e splash.
8. Gere arquivo **`.aab`** assinado.

### Fase C — Publicar na Play Console

9. Crie conta Google Play Developer.
10. Crie o app (idioma, nome, categoria).
11. Envie:
    - `.aab`
    - screenshots
    - ícone 512x512
    - política de privacidade URL
12. Preencha “Data safety” (o app usa localStorage; detalhe isso com transparência).
13. Envie para revisão e acompanhe feedback.

### Fase D — Pós-lançamento

14. Corrija recusas se houver.
15. Libere em produção.
16. Mantenha rotina de updates pequenos e frequentes.

---

## Passo a passo (ELI5) — App Store (iOS)

### Fase A — Preparar base web

1. Mesmo domínio HTTPS estável da versão Android.
2. Páginas legais prontas (privacidade/termos/suporte).

### Fase B — Criar wrapper iOS

3. Crie projeto com **Capacitor**.
4. Aponte WebView para seu conteúdo web (build local ou URL).
5. Abra no Xcode, configure bundle identifier, assinatura e capabilities.
6. Gere ícones/splash iOS exigidos.

### Fase C — App Store Connect

7. Crie o app no App Store Connect.
8. Cadastre metadados, classificação etária, screenshots.
9. Faça archive no Xcode e envie build para TestFlight.
10. Teste em iPhone real.
11. Submeta para revisão.

### Fase D — Aprovação

12. Responda perguntas da Apple com objetividade (o que coleta, para que serve, como suporta usuário).
13. Após aprovação, publique.

---

## Checklist final antes do “submit”

- [ ] URL HTTPS estável funcionando em Android e iOS.
- [ ] Manifest + service worker válidos e offline testado em dispositivo real.
- [ ] Política de privacidade e termos publicados (URLs públicas).
- [ ] E-mail/site de suporte publicado.
- [ ] Screenshots reais (não mock quebrado).
- [ ] Ícones corretos para lojas.
- [ ] Release notes da versão 1.0.0 prontas.
- [ ] Se monetizar: fluxo de compra + validação server-side pronto.

---

## Como atualizar o app depois de publicado

### Web/PWA (site)

1. Você altera o código no repositório e faz deploy em HTTPS.
2. No próximo acesso online, o service worker baixa a nova versão e troca o cache.
3. Usuários recebem a atualização sem instalar APK manualmente.

### Play Store (wrapper Android)

1. Atualize versão no projeto Android (`versionCode`/`versionName`).
2. Gere novo `.aab`.
3. Envie nova release no Play Console (staged rollout recomendado).

### App Store (wrapper iOS)

1. Atualize versão/build no Xcode.
2. Gere archive e envie para App Store Connect/TestFlight.
3. Submeta atualização para revisão da Apple.

> Regra prática: mudou só conteúdo web? deploy web já ajuda. Mudou integração nativa (billing, permissões, SDK)? exige nova versão na loja.


## Referências oficiais

- TWA (Google): https://developer.chrome.com/docs/android/trusted-web-activity
- Bubblewrap: https://github.com/GoogleChromeLabs/bubblewrap
- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- In-app purchases neste projeto: `docs/IN_APP_PURCHASES.md`
