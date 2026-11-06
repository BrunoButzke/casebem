# API de Mural de Recados - CaseBem

## Visão Geral

API pública para mural de recados do casamento Dani & Carine. **Independente de pagamento/presente**: qualquer pessoa pode deixar mensagem de felicitação sem comprar presente.

## Requisitos

### Funcionalidades
- ✅ POST mensagem pública (sem autenticação pessoal)
- ✅ GET lista pública de mensagens (readonly)
- ✅ Paginação com cursor opaco
- ✅ Rate limiting por IP (5 requisições/hora)
- ✅ Idempotência com Idempotency-Key
- ❌ Edição/exclusão de mensagens (fora do MVP)
- ❌ Moderação/admin tools (fora do MVP)

### Segurança
- HMAC de IP para rate limiting (sem armazenar IP raw)
- Validação rigorosa de entrada
- XSS protection no frontend
- CORS same-origin + domínios permitidos
- Content-Length validation (max 8KB)

## Endpoints

### POST /api/messages

Cria nova mensagem no mural.

**Request:**
```json
{
  "guestName": "João Silva",
  "message": "Felicidades ao casal! Muita alegria nessa nova jornada.",
  "consentGiven": true
}
```

**Headers obrigatórios:**
- `Content-Type: application/json`
- `Idempotency-Key: <uuid-ou-chave-unica>` (alfanumérico + `-_`, max 128 chars)

**Validação:**

| Campo | Tipo | Regras |
|-------|------|--------|
| `guestName` | string | 2-100 chars, trim + collapse spaces |
| `message` | string | 3-500 chars, whitespace/newline permitido, CRLF→LF |
| `consentGiven` | boolean | Deve ser `true` (literal) |

**Campos não permitidos:**
- `giftId`, `amount`, `payment`, `email` (não há vínculo com compra)
- Campos desconhecidos retornam 400

**Responses:**

✅ **201 Created** - Sucesso
```json
{
  "id": "a1b2c3d4-...",
  "guestName": "João Silva",
  "message": "Felicidades ao casal! Muita alegria nessa nova jornada.",
  "createdAt": "2026-11-06T10:30:00.000Z"
}
```

⚠️ **400 Bad Request** - Validação falhou
```json
{
  "error": "Dados inválidos",
  "details": {
    "guestName": "Nome deve ter entre 2-100 caracteres",
    "message": "Mensagem deve ter entre 3-500 caracteres"
  }
}
```

⚠️ **409 Conflict** - Idempotency key conflito
```json
{
  "error": "Conflito: mesma chave de idempotência com dados diferentes"
}
```

⚠️ **413 Payload Too Large** - Body > 8KB
```json
{
  "error": "Request body muito grande"
}
```

⚠️ **429 Too Many Requests** - Rate limit excedido (5/hora)
```json
{
  "error": "Muitas requisições. Tente novamente em alguns minutos."
}
```

⚠️ **503 Service Unavailable** - Configuração incompleta
```json
{
  "error": "Serviço temporariamente indisponível"
}
```

**Idempotência:**
- Mesma `Idempotency-Key` + mesmo payload normalizado → retorna mensagem já criada (201)
- Mesma `Idempotency-Key` + payload diferente → 409 Conflict
- Key diferente → sempre cria nova mensagem
- Fingerprint: SHA-256 de payload canônico (sorted JSON)

---

### GET /api/messages

Lista mensagens públicas do mural (readonly).

**Query Parameters:**

| Parâmetro | Tipo | Padrão | Regras |
|-----------|------|--------|--------|
| `limit` | integer | 12 | 3-50 mensagens por página |
| `cursor` | string | null | Cursor opaco para paginação (base64) |

**Exemplo:**
```
GET /api/messages?limit=20
GET /api/messages?limit=20&cursor=eyJjcmVhdGVkQXQiOiIyMDI2LTExLTA2VDEwOjMw...
```

**Response:**

✅ **200 OK** - Sucesso
```json
{
  "messages": [
    {
      "id": "a1b2c3d4-...",
      "guestName": "João Silva",
      "message": "Felicidades ao casal!",
      "createdAt": "2026-11-06T10:30:00.000Z"
    },
    {
      "id": "b2c3d4e5-...",
      "guestName": "Maria Santos",
      "message": "Muitas felicidades! 🎉",
      "createdAt": "2026-11-06T09:15:00.000Z"
    }
  ],
  "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTExLTA2VDA5OjE1..." | null
}
```

**Campos retornados:**
- ✅ `id`, `guestName`, `message`, `createdAt`
- ❌ `ip_hash`, `consent_given`, `idempotency_key`, `idempotency_fingerprint` (privados)

**Ordenação:**
- `created_at DESC, id DESC` (mais recentes primeiro)

**Paginação:**
- `nextCursor: null` = última página
- `nextCursor: <string>` = há mais mensagens (usar no próximo GET)

⚠️ **400 Bad Request** - Cursor ou limit inválido
```json
{
  "error": "Cursor inválido ou limit fora do intervalo 3-50"
}
```

⚠️ **503 Service Unavailable** - DB não configurado
```json
{
  "error": "Serviço temporariamente indisponível"
}
```

---

### OPTIONS /api/messages

Preflight CORS.

**Response:**
```
204 No Content
Access-Control-Allow-Origin: <origin>
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Idempotency-Key
Access-Control-Max-Age: 86400
```

---

## Database Schema

### Tabela: `wedding_messages`

```sql
CREATE TABLE wedding_messages (
  id TEXT PRIMARY KEY,                    -- UUID v4 (crypto.randomUUID)
  wedding_key TEXT NOT NULL,              -- Fixo 'dani-carine'
  guest_name TEXT NOT NULL,               -- 2-100 chars
  message TEXT NOT NULL,                  -- 3-500 chars
  consent_given INTEGER NOT NULL,         -- Sempre 1
  created_at TEXT NOT NULL,               -- ISO 8601
  idempotency_key TEXT,                   -- Unique per wedding
  idempotency_fingerprint TEXT NOT NULL,  -- SHA-256 do payload
  
  CHECK (consent_given = 1),
  CHECK (length(guest_name) >= 2 AND length(guest_name) <= 100),
  CHECK (length(message) >= 3 AND length(message) <= 500)
);

CREATE UNIQUE INDEX idx_messages_idempotency
  ON wedding_messages(wedding_key, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_messages_wedding_time
  ON wedding_messages(wedding_key, created_at DESC, id DESC);
```

**Notas:**
- Sem campo `ip_hash` na tabela (rate limit usa tabela compartilhada `rate_limits`)
- Sem `updated_at` (mensagens são imutáveis no MVP)
- Sem campos de pagamento/presente (mural independente)

---

## Rate Limiting

- **Limite:** 5 requisições POST por hora por IP
- **Implementação:** Reutiliza tabela `rate_limits` do sistema RSVP
- **Secret:** Usa `RSVP_SECRET` para HMAC de IP (infra compartilhada, renomear futuramente)
- **Window:** Janela de 1 hora (rolling)

**Identificador:** `dani-carine:<hmac-ip>:<window-start>`

---

## Variáveis de Ambiente

| Nome | Descrição | Obrigatório |
|------|-----------|-------------|
| `DB` | Binding Cloudflare D1 | Sim |
| `RSVP_SECRET` | Secret base64 (>=32 bytes) para HMAC | Sim |

**⚠️ Nota:** Atualmente usa `RSVP_SECRET` para HMAC de IP (infra compartilhada). Em futuras refatorações, considerar renomear para `CASEBEM_SECRET`, mas não alterar agora para não quebrar RSVP.

---

## Frontend

### UI no `dani-carine/index.html`

**Seção do Mural:**
- Integrada semanticamente (não UI gigante separada)
- Form: campos `guestName`, `message`, checkbox `consent`
- Lista de mensagens carregadas do servidor
- Paginação com botão "Carregar mais" (se `nextCursor`)

**Estados:**
- Loading inicial
- Erro (503 → "Mural temporariamente indisponível")
- Empty (sem mensagens → "Seja o primeiro a deixar um recado!")
- Populated (lista real do servidor)

**Submissão:**
- POST com `Idempotency-Key` (crypto.randomUUID)
- Sucesso (201) → adiciona mensagem no topo da lista
- Erro → preserva valores do form, mostra mensagem amigável
- Limpa form após sucesso

**Segurança XSS:**
- `textContent` para exibir mensagens (nunca `innerHTML`)
- CSS `white-space: pre-wrap` para preservar quebras de linha
- Sem expor campos privados (ip_hash, fingerprint, etc.)

**No-JS fallback:**
- Mensagem: "O mural de recados requer JavaScript ativado"

---

## Limitações do MVP

1. **Sem edição/exclusão:** Mensagens são imutáveis após criação
2. **Sem moderação:** Não há ferramentas de admin para remover conteúdo
3. **Sem autenticação pessoal:** Qualquer um pode enviar (rate limit por IP)
4. **Sem notificações:** Noivas não recebem alert de nova mensagem
5. **Sem busca/filtro:** Lista apenas paginação cronológica reversa

---

## Testes

### Cobertura obrigatória:

- [x] `tests/messages-validators.test.mjs` - Validação de entrada
- [x] `tests/messages-service.test.mjs` - Lógica de negócio + idempotência
- [x] `tests/messages-api.test.mjs` - Handlers HTTP + rate limit
- [x] `tests/messages-schema.test.mjs` - Schema SQL + constraints (Python SQLite)
- [x] `tests/messages-frontend-real.test.mjs` - DOM + form + lista (HappyDOM)

**Requisitos de teste:**
- Entradas/outputs reais (não `assert.ok(true)` fake)
- Mocks apenas para DB remoto (SQLite real para schema)
- Nenhum teste `skip()` ou `todo()`
- Todos devem passar: `node --test tests/*.test.mjs`

---

## Deployment

### Pré-requisitos:

1. **Migration aplicada:** `migrations/0003_messages.sql`
2. **D1 binding:** `DB` configurado no Cloudflare Pages
3. **Secret:** `RSVP_SECRET` configurado
4. **Build:** `npm run build` sem erros

### Steps:

```bash
# 1. Aplicar migration
wrangler d1 migrations apply casebem-rsvps-production --remote

# 2. Deploy (push to main após merge do PR)
git push origin main

# 3. Verificar no dashboard D1
SELECT COUNT(*) FROM wedding_messages;
```

---

## Migração Futura (Fora do Escopo Atual)

**Não implementar agora:**
- Renomear `RSVP_SECRET` → `CASEBEM_SECRET`
- Separar secrets RSVP vs Messages
- Admin dashboard de moderação
- Edição/exclusão de mensagens

**Manter compatibilidade backward:**
- Migrations são aditivas (`IF NOT EXISTS`)
- Não reescrever migrations anteriores (0001, 0002)
- Shared `rate_limits` table OK (funciona para ambos sistemas)
