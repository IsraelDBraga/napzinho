# Nest — notas para desenvolvimento

## Estrutura

| Caminho | Conteúdo |
|---------|-----------|
| `index.html` | Markup; scripts em `assets/js/*.js` (ordem fixa, ver `<script defer>`) |
| `assets/css/styles.css` | Estilos |
| `assets/js/config.js` | `APP_SCHEMA_VERSION`, `defaultCfg` |
| `assets/js/state.js` | `entries`, `cfg`, timers |
| `assets/js/time-engine.js` | `$`, data/hora, `normClockMin` |
| `assets/js/sleep-engine.js` | Datas de sono, segmentos da noite |
| `assets/js/predict-engine.js` | Previsões e maturidade dos dados |
| `assets/js/stale-guard.js` | Reservado |
| `assets/js/storage.js` | Perfis, `normalizeEntry`, `setSleepKind`, migração |
| `assets/js/render-*.js` | UI por secção |
| `assets/js/entries.js` | Ações e modal |
| `assets/js/backup.js` | Export/import |
| `assets/js/debug.js` | `safeRender`, diagnóstico |
| `assets/js/tests.js` | `runNestSelfTests`, expostos em `window` |
| `assets/js/app.js` | `init`, navegação base |
| `sw.js` | Precache da casca PWA |
| `tools/nest-selftest-page.html` | Smoke headless/console |

## Rodar localmente

```bash
python3 -m http.server 8080
```

Abrir `http://localhost:8080/index.html`.

## Testes rápidos

No console do navegador (app carregada): `runNestSelfTests()`.

Página mínima: abrir `tools/nest-selftest-page.html` via servidor HTTP (paths relativos).

## Schema e migração

- `APP_SCHEMA_VERSION` em `assets/js/config.js`.
- `migrateDataModel()` em `assets/js/storage.js` reaplica regras quando a versão no perfil é inferior.
- **Não** usar `localStorage.clear()` em produção — apaga todos os perfis e chaves auxiliares.

## Classificação sono noite vs soneca

Regras em `storage.js`: início na janela noturna (`nightStart` ↔ `dayBoundary`) **ou** sono que **atravessa** essa janela (`sleepTouchesPhysiologicalNight`), para incluir ex. sono manual 17:50 → manhã seguinte.

## Checklist antes de publicar

1. `runNestSelfTests()` ok  
2. Offline: primeiro load online, depois avião — UI carrega (SW precache em `sw.js`)  
3. Entrada manual de sono que cruza a noite aparece no painel “Noite — referência principal”  
4. Substituir placeholders de store:
   - `.well-known/assetlinks.json` (`PLACEHOLDER_PACKAGE_NAME` e `PLACEHOLDER_SHA256`)
   - `assets/screenshots/mobile-home.png` e `assets/screenshots/mobile-dados.png` por capturas reais da app.
