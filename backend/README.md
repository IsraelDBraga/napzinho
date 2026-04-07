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
- `NAPZ-VITALICIO-AMIGOS` (lifetime)
- `NAPZ-PREMIUM-30DIAS` (premium com expiração)

**Importante:** essas chaves só existem **depois** de subir `python3 server.py`. O servidor cria `napzinho.db` e insere as chaves do JSON na primeira execução. Se o app abrir em outro dispositivo ou em `file://`, ele não alcança `localhost:8787` do seu PC — configure no app a URL pública do backend (HTTPS) ou use túnel (ngrok, etc.).

**Por que “não funcionou” no celular:** o app costuma apontar para `http://localhost:8787`. No telefone, `localhost` é o próprio celular, não o computador onde o Python roda. Solução: expor o backend com URL acessível e colar essa URL em Config. → “URL do servidor de licenças”.

## Endpoints

- `POST /api/activate`
  - body: `{ "code": "...", "device_id": "..." }`
- `GET /api/entitlement?device_id=...`
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
