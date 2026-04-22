# Cobrança in-app (Google Play Billing e Apple StoreKit)

O `index.html` deste repositório é uma **PWA** (JavaScript no navegador). **Não existe** API de faturamento das lojas dentro desse ambiente: **Google Play Billing** e **StoreKit** só funcionam em **apps nativos** ou em runtimes que expõem os SDKs oficiais.

## O que fazer na prática

### Android (Google Play Billing)

1. Publique o app como **TWA** (Bubblewrap / PWA Builder) ou **WebView** em **Capacitor**.
2. Adicione o módulo **Play Billing Library** no projeto Android gerado.
3. Implemente o fluxo: `BillingClient` → compra / assinatura → token de compra enviado ao **seu backend** para validação (obrigatório em produção).
4. O backend devolve **entitlement** (Premium ativo); o app web pode continuar usando `cfg.licenseTier` / `syncEntitlementFromBackend()` como hoje.

### iOS (StoreKit 2)

1. Empacote com **Capacitor** ou **Cordova** e abra no **Xcode**.
2. Configure produtos no **App Store Connect** (assinatura ou compra).
3. Use **StoreKit 2** (Swift) ou um plugin mantido (ex.: Capacitor Community) para obter transações e enviar o **receipt** ou **JWS** ao backend para validação.
4. Mesmo padrão: backend confirma → app marca Premium.

### Atalho: RevenueCat, Adapty, etc.

Plataformas como **RevenueCat** unificam Play Billing + StoreKit, gerenciam recibos e expõem uma **REST API** ou SDK — o seu backend (ou o serviço) decide se o usuário está Premium. Encaixa bem com o fluxo de chave/API já previsto no app.

## Papel do código web atual

- **Teste / pré-lançamento:** checkbox “Premium local”, trial de 7 dias, chave + API (`backend/server.py`).
- **Produção nas lojas:** substituir ou complementar por **validação server-side** das compras reais; nunca confiar só no cliente.

## Checklist mínimo antes de cobrar

- Política de privacidade e termos (mesmo com dados locais).
- Conta de desenvolvedor Google Play e Apple Developer.
- Produtos de assinatura criados e aprovados nas lojas.
- Backend HTTPS com endpoint que valida compras e devolve entitlement.


## Status atual do projeto (17/04/2026)

- ✅ Existe backend MVP de chave/licença (`/api/activate`, `/api/entitlement`).
- ✅ Existe trial de 7 dias e bloqueio por paywall no cliente web.
- ✅ Existe endpoint server-side para validar compra (`POST /api/purchase/validate`) com modos `live|mock`.
- ⚠️ Ainda falta o app nativo enviar `purchaseToken` (Google) e `receipt/JWS` (Apple) no fluxo de produção.

Em outras palavras: o backend de validação já está preparado; o que falta é concluir a integração nativa de compra no wrapper Android/iOS e credenciais de produção.

## Ponte com app web (já integrado)

O frontend expõe `window.NestBilling.submitPurchase(payload)` para wrappers nativos chamarem após uma compra:

- Google: `{ platform: "google_play", purchase_token, subscription_id|product_id, package_name }`
- Apple: `{ platform: "apple_app_store", receipt_data }` ou `{ signed_transaction_info }`

Esse método envia para `POST /api/purchase/validate` e atualiza entitlement local ao receber sucesso.
