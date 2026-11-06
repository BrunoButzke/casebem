# Especificação da API RSVP - Casamento Dani & Carine

**Versão:** 1.0.0  
**Casamento:** `dani-carine` (chave fixa do evento)  
**Data:** 21 de novembro de 2026

## Visão Geral

Sistema de confirmação de presença (RSVP) para o casamento, permitindo que convidados confirmem presença, informem acompanhantes e deixem observações. O sistema opera em modo aberto (sem convites pré-cadastrados) e cada resposta recebe um token de gerenciamento para edições futuras.

## Modelo de Dados

### RSVP Entity

```typescript
interface RSVP {
  id: string;                    // UUID gerado pelo servidor
  weddingKey: string;            // Sempre 'dani-carine'
  guestName: string;             // Nome normalizado (2-100 chars, trimmed)
  attending: boolean;            // true = SIM, false = NÃO
  adultsCount: number;           // 0-10 acompanhantes adultos
  childrenCount: number;         // 0-10 crianças
  observations: string | null;   // Opcional, até 500 chars
  consentGiven: boolean;         // Consentimento LGPD explícito
  manageTokenHash: string;       // Hash bcrypt do token (servidor)
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
}
```

### Regras de Negócio

1. **Presença (attending)**
   - Obrigatório: SIM ou NÃO
   - Se NÃO, recomenda-se zerar acompanhantes (não obrigatório)

2. **Nome (guestName)**
   - Obrigatório
   - Normalizado: trim, collapsar espaços múltiplos
   - Comprimento: 2-100 caracteres Unicode
   - Permite caracteres internacionais (acentos, ñ, etc.)

3. **Acompanhantes**
   - `adultsCount`: inteiro 0-10 (inclusivo)
   - `childrenCount`: inteiro 0-10 (inclusivo)
   - Não podem ser negativos ou float
   - Total máximo combinado: 20 pessoas

4. **Observações (observations)**
   - Opcional (pode ser string vazia ou null)
   - Máximo 500 caracteres
   - Nunca exposta publicamente

5. **Consentimento (consentGiven)**
   - Obrigatório ser `true`
   - Checkbox no formulário
   - Texto: "Concordo que meu nome e resposta sejam armazenados para organização do evento"

6. **Token de Gerenciamento**
   - Gerado no POST (criação): 32 bytes random → base64url
   - Retornado UMA VEZ na resposta do POST
   - Armazenado hasheado (bcrypt) no banco
   - Usado via Authorization Bearer para GET/PUT
   - Não expira (MVP simples)

## Endpoints

### POST /api/rsvp
**Criar nova resposta RSVP**

#### Request

```http
POST /api/rsvp
Content-Type: application/json
Origin: https://casebem.pages.dev
Idempotency-Key: 8a7b9c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d

{
  "guestName": "Maria Silva",
  "attending": true,
  "adultsCount": 2,
  "childrenCount": 1,
  "observations": "Alergia a frutos do mar",
  "consentGiven": true
}
```

**Headers obrigatórios:**
- `Content-Type: application/json`
- `Idempotency-Key`: UUID ou string aleatória (até 128 chars, `[a-zA-Z0-9_-]+`)

#### Response Success (201 Created)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "weddingKey": "dani-carine",
  "guestName": "Maria Silva",
  "attending": true,
  "adultsCount": 2,
  "childrenCount": 1,
  "observations": "Alergia a frutos do mar",
  "createdAt": "2026-11-01T10:30:00.000Z",
  "updatedAt": "2026-11-01T10:30:00.000Z",
  "manageToken": "8xK9mP3qR7sT2vW6yZ4aC5bN1dF0hJ8"
}
```

**Nota:** `manageToken` é retornado APENAS nesta resposta. Cliente deve armazená-lo.

#### Response Errors

```json
// 400 Bad Request - JSON inválido
{ "error": "JSON inválido" }

// 400 Bad Request - Validação
{
  "error": "Dados inválidos",
  "details": {
    "guestName": "Nome é obrigatório e deve ter entre 2-100 caracteres",
    "adultsCount": "Deve ser inteiro entre 0-10",
    "consentGiven": "Consentimento é obrigatório"
  }
}

// 409 Conflict - Idempotency key conflict (mesma chave, dados diferentes)
{ "error": "Conflito: mesma chave de idempotência com dados diferentes" }

// 413 Payload Too Large - Body > 8KB
{ "error": "Request body muito grande" }

// 429 Too Many Requests
{ "error": "Muitas requisições. Tente novamente em alguns minutos." }
```

### GET /api/rsvp
**Consultar própria resposta**

#### Request

```http
GET /api/rsvp
Authorization: Bearer 8xK9mP3qR7sT2vW6yZ4aC5bN1dF0hJ8
```

#### Response Success (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "weddingKey": "dani-carine",
  "guestName": "Maria Silva",
  "attending": true,
  "adultsCount": 2,
  "childrenCount": 1,
  "observations": "Alergia a frutos do mar",
  "createdAt": "2026-11-01T10:30:00.000Z",
  "updatedAt": "2026-11-01T10:30:00.000Z"
}
```

**Nota:** `manageToken` NÃO é retornado no GET (apenas POST).

#### Response Errors

```json
// 401 Unauthorized - Token ausente, inválido ou RSVP não encontrado
{ "error": "Token de autorização inválido" }
```

**Nota:** 401 é retornado tanto para token malformado quanto para token válido mas sem RSVP correspondente (segurança por obscuridade).

### PUT /api/rsvp
**Atualizar própria resposta**

#### Request

```http
PUT /api/rsvp
Authorization: Bearer 8xK9mP3qR7sT2vW6yZ4aC5bN1dF0hJ8
Content-Type: application/json

{
  "attending": false,
  "adultsCount": 0,
  "childrenCount": 0,
  "observations": "Infelizmente não poderei comparecer"
}
```

**Campos atualizáveis:**
- `attending`
- `adultsCount`
- `childrenCount`
- `observations`

**Campos NÃO atualizáveis:**
- `guestName` (mantém original)
- `weddingKey` (sempre dani-carine)
- `consentGiven` (mantém original)

#### Response Success (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "weddingKey": "dani-carine",
  "guestName": "Maria Silva",
  "attending": false,
  "adultsCount": 0,
  "childrenCount": 0,
  "observations": "Infelizmente não poderei comparecer",
  "createdAt": "2026-11-01T10:30:00.000Z",
  "updatedAt": "2026-11-05T14:20:00.000Z"
}
```

#### Response Errors

```json
// 400 Bad Request - Validação
{
  "error": "Dados inválidos",
  "details": {
    "adultsCount": "Deve ser inteiro entre 0-10"
  }
}

// 401 Unauthorized - Token inválido ou RSVP não encontrado
{ "error": "Token de autorização inválido" }

// 429 Too Many Requests - Rate limit
{ "error": "Muitas requisições. Tente novamente em alguns minutos." }
```

### Métodos Não Suportados

```http
DELETE /api/rsvp
→ 405 Method Not Allowed
{ "error": "Método não suportado" }
```

## Segurança

### CORS (Same-Origin)
- Validar Origin exato da requisição
- Produção: `https://casebem.pages.dev`, `https://www.casebem.pages.dev`, `https://casebem.com`
- Desenvolvimento: `http://localhost:*`
- **Nunca usar wildcard `*`**
- Rejeitar Origins não permitidos com 403
- OPTIONS preflight valida Origin ANTES de checar DB

### CSRF
- Validar Content-Type: `application/json`
- Validar Origin header
- Rejeitar Origins não permitidos (403)

### Rate Limiting (D1 UPSERT)
- Estratégia: HMAC-SHA256 de IP com secret `env.RSVP_HASH_KEY`
- Limite: 10 requisições POST/PUT por IP por hora
- Atomic UPSERT: `INSERT ... ON CONFLICT DO UPDATE WHERE count < limit`
- Cleanup automático de janelas antigas (>26 horas) em cada request
- IP source: `CF-Connecting-IP` (production, não pode ser spoofed)
- Fallback `X-Forwarded-For` apenas para dev local (best effort)

### Tokens
- Geração: 32 bytes crypto-random, base64url encoded
- Storage: SHA-256 hash (para lookup rápido) + AES-GCM encrypted (para recuperação idempotente)
- Bearer format: `Authorization: Bearer <token>`
- Não logar tokens completos

### Idempotência
- Header obrigatório: `Idempotency-Key` (até 128 chars, alphanumeric + `-_`)
- Único por wedding + key
- Mesma key + body retorna mesmo `manageToken` (decrypted from DB)
- Mesma key + body diferente retorna 409 Conflict
- Token encrypted com AES-GCM usando `env.RSVP_TOKEN_KEY`

### Environment Secrets
**Obrigatórios para produção:**
- `RSVP_TOKEN_KEY`: 32 bytes random, base64 encoded (AES-GCM encryption)
- `RSVP_HASH_KEY`: Secret string (HMAC pepper for IP hashing)

**Nota:** Use derivação separada (HKDF) para diferentes domínios criptográficos, ou secrets independentes. Nunca commitar secrets no repositório.

## Privacidade (LGPD)

### Dados Armazenados
- Nome do convidado (necessário para organização)
- Resposta de presença
- Número de acompanhantes
- Observações (nunca públicas)
- Timestamps

### Dados NÃO Armazenados
- E-mail (não necessário para RSVP)
- Telefone (não necessário para RSVP)
- IP em plain text (apenas hash para rate limit)

### Aviso ao Usuário
"Seu nome e resposta serão armazenados para a organização do evento. Suas observações são privadas e visíveis apenas aos noivos."

### Exclusão (futuro)
- DELETE /api/rsvp (com Bearer token)
- Remove registro completamente
- Mantém apenas contador rate limit

## Estado e Fluxo

### Máquina de Estados

```
[Início] 
   ↓
   POST /api/rsvp → [Confirmado] (recebe token)
   ↓                     ↓
   └─────────────── PUT /api/rsvp (com token) → [Atualizado]
                         ↓
                    GET /api/rsvp (verifica estado)
```

### Casos de Uso

1. **Convidado Novo**
   - Acessa página do casamento
   - Preenche formulário RSVP
   - Submete → POST /api/rsvp
   - Recebe token → salva no localStorage
   - Vê mensagem de confirmação

2. **Convidado Retornando (mesmo navegador)**
   - Acessa página
   - Sistema detecta token no localStorage
   - GET /api/rsvp → carrega resposta existente
   - Pode editar → PUT /api/rsvp

3. **Convidado Retornando (outro dispositivo)**
   - Não tem token
   - Pode tentar submeter novamente
   - Se nome duplicado: erro 409 (opcional)
   - Alternativa: link com token na URL (não implementado MVP)

## Schema D1

Ver `migrations/0001_rsvps.sql` para schema completo.

## Testes de Aceitação

### Cenário 1: Criar RSVP com Presença Confirmada
```
DADO que sou um convidado novo
QUANDO envio POST /api/rsvp com attending=true
ENTÃO recebo status 201
E recebo um manageToken válido
E meu RSVP é salvo no banco
```

### Cenário 2: Consultar Próprio RSVP
```
DADO que tenho um manageToken válido
QUANDO envio GET /api/rsvp com Bearer token
ENTÃO recebo status 200
E vejo meus dados de RSVP
E NÃO vejo o manageToken na resposta
```

### Cenário 3: Atualizar para Não Presença
```
DADO que tenho RSVP confirmado
E tenho manageToken válido
QUANDO envio PUT /api/rsvp com attending=false
ENTÃO recebo status 200
E meu RSVP é atualizado
E updatedAt é atualizado
```

### Cenário 4: Validação - Nome Inválido
```
DADO que envio POST com guestName=""
ENTÃO recebo status 400
E erro "Nome é obrigatório"
```

### Cenário 5: Validação - Acompanhantes Inválidos
```
DADO que envio POST com adultsCount=-1
ENTÃO recebo status 400
E erro "Deve ser inteiro entre 0-10"
```

### Cenário 6: Validação - Sem Consentimento
```
DADO que envio POST com consentGiven=false
ENTÃO recebo status 400
E erro "Consentimento é obrigatório"
```

### Cenário 7: Token Inválido
```
DADO que envio GET com token incorreto
ENTÃO recebo status 401
E erro "Token de autorização inválido"
```

### Cenário 8: Rate Limiting
```
DADO que fiz 10 POSTs na última hora
QUANDO tento fazer 11º POST
ENTÃO recebo status 429
E erro "Muitas requisições"
```

## Configuração D1

### Passo a Passo (Production)

1. **Criar Database D1**
   ```bash
   # No dashboard Cloudflare ou via wrangler
   wrangler d1 create casebem-rsvps-production
   ```

2. **Anotar Database ID**
   ```
   [[d1_databases]]
   binding = "DB"
   database_name = "casebem-rsvps-production"
   database_id = "<UUID_AQUI>"
   ```

3. **Configurar Binding no Cloudflare Pages**
   - Ir em Settings → Functions → D1 database bindings
   - Adicionar binding: `DB` → `casebem-rsvps-production`

4. **Aplicar Migrations**
   ```bash
   wrangler d1 migrations apply casebem-rsvps-production --remote
   ```

5. **Verificar**
   ```bash
   wrangler d1 execute casebem-rsvps-production --command="SELECT * FROM rsvps LIMIT 1" --remote
   ```

### Desenvolvimento Local

```bash
# Criar database local
wrangler d1 execute DB --file=migrations/0001_rsvps.sql --local

# Testar
wrangler pages dev --d1=DB
```

## Segurança

### RSVP_SECRET

A API usa uma única variável de ambiente `RSVP_SECRET` (32 bytes, base64) com derivação HKDF para:
- **Token Encryption**: AES-256-GCM (info: `token-encryption-v1`)
- **IP Rate Limiting**: HMAC-SHA256 (info: `rate-limit-ip-hmac-v1`)

**Setup**:
```bash
# Gerar secret (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Configurar no Cloudflare Pages
wrangler pages secret put RSVP_SECRET
```

### Idempotency Security

Replay de requisições idempotentes requer:
1. `Idempotency-Key` header (mesmo valor)
2. `Authorization: Bearer <manageToken>` (token ownership)
3. Request fingerprint SHA-256 match (canonical payload)

Sem bearer token, replay retorna `409 Conflict` (previne extração de tokens).

### CORS

Allowed origins:
- `https://casebem.pages.dev`
- `https://*.casebem.pages.dev`
- `https://casebem.com`
- `https://www.casebem.com`
- `http://localhost:*` (dev)

## Dependências

- **Cloudflare D1**: storage SQL
- **Web Crypto API**: geração de tokens, HKDF, AES-GCM, HMAC-SHA256
- Sem dependências npm adicionais para API
