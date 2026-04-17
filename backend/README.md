# Backend de licenças (MVP)

API simples em Python (stdlib) para ativar chaves e retornar entitlement por dispositivo.

## Subir servidor

```bash
cd backend
python3 server.py
```

Servidor padrão: `http://localhost:8787`

## Chaves pré-programadas

Edite `preprogrammed_keys.json` com os códigos que você quer distribuir manualmente.

Exemplo já incluso:
- `NAPZ-PREMIUM-30DIAS` (premium com expiração)

**Importante:** essas chaves só existem **depois** de subir `python3 server.py`. O servidor cria `napzinho.db` e insere as chaves do JSON na primeira execução. Se o app abrir em outro dispositivo ou em `file://`, ele não alcança `localhost:8787` do seu PC — configure no app a URL pública do backend (HTTPS) ou use túnel (ngrok, etc.).

**Por que “não funcionou” no celular:** o app costuma apontar para `http://localhost:8787`. No telefone, `localhost` é o próprio celular, não o computador onde o Python roda. Solução: expor o backend com URL acessível e colar essa URL em Config. → “URL do servidor de licenças”.

## Endpoints

- `POST /api/activate`
  - body: `{ "code": "...", "device_id": "..." }`
- `GET /api/entitlement?device_id=...`
- `POST /api/purchase/validate`
  - body (Google Play): `{ "platform":"google_play", "device_id":"...", "purchase_token":"...", "subscription_id":"..." }`
  - body (Apple): `{ "platform":"apple_app_store", "device_id":"...", "receipt_data":"..." }` ou `{ "signed_transaction_info":"..." }`
- `POST /api/admin/seed`
  - header: `X-Admin-Token: <NAPZ_ADMIN_TOKEN>`
  - body: `{ "code": "...", "tier": "premium|lifetime", "max_activations": 1, "expires_at": null }`
- `GET /api/admin/licenses`
  - header: `X-Admin-Token: <NAPZ_ADMIN_TOKEN>`
- `POST /api/admin/deactivate`
  - header: `X-Admin-Token: <NAPZ_ADMIN_TOKEN>`
  - body: `{ "code": "..." }`

## Interface web (admin completo)

Há uma interface pronta em `admin.html` (raiz do projeto) para:
- conectar no backend,
- criar/editar chaves,
- listar chaves,
- desativar chave.

## Segurança

Este backend é MVP para operação inicial. Para produção:
- colocar autenticação forte no admin,
- limitar CORS,
- usar HTTPS,
- auditar logs/abuso,
- separar banco/segredos.

## Validação de compras (Google/Apple)

Variáveis de ambiente:

- `NAPZ_PURCHASE_VALIDATION_MODE=disabled|mock|live` (padrão: `disabled`)
- `GOOGLE_PLAY_PACKAGE_NAME` (ex.: `com.seu.app`)
- `GOOGLE_PLAY_ACCESS_TOKEN` (Bearer token do Android Publisher API)
- `APPLE_SHARED_SECRET` (quando usar `verifyReceipt`)
- `APPLE_JWS_VERIFY_URL` (endpoint externo para validar `signed_transaction_info` StoreKit 2)
- `NAPZ_WIFE_LIFETIME_KEY` (opcional: insere automaticamente uma chave vitalícia dedicada)

Notas:

- `mock` aceita tokens/receipts começando com `mock_premium_` ou `mock_lifetime_`.
- `live` valida Google via Android Publisher API e Apple via `verifyReceipt`/`APPLE_JWS_VERIFY_URL`.
