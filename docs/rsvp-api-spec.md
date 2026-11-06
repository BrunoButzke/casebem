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

{
  "guestName": "Maria Silva",
  "attending": true,
  "adultsCount": 2,
  "childrenCount": 1,
  "observations": "Alergia a frutos do mar",
  "consentGiven": true
}
```

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

// 409 Conflict - Duplicate (se implementar unique por nome+wedding)
{ "error": "Já existe uma resposta para este nome" }

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
// 401 Unauthorized - Token ausente ou inválido
{ "error": "Token de autorização inválido" }

// 404 Not Found - RSVP não encontrado para este token
{ "error": "RSVP não encontrado" }
```

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

// 401 Unauthorized
{ "error": "Token de autorização inválido" }

// 404 Not Found
{ "error": "RSVP não encontrado" }
```

### Métodos Não Suportados

```http
DELETE /api/rsvp
→ 405 Method Not Allowed
{ "error": "Método não suportado" }
```

## Segurança

### CORS
- Aceitar apenas Origin: `https://casebem.pages.dev` e domínios do Cloudflare Pages
- Também permitir `http://localhost:*` para desenvolvimento
- Headers CORS apropriados em todas as respostas

### CSRF
- Validar Content-Type: `application/json`
- Rejeitar Origins não permitidos
- Não aceitar `text/plain` ou outros tipos

### Rate Limiting (D1)
- Estratégia: contador por `(weddingKey, IP, window)` em tabela separada
- Limite: 10 requisições POST/PUT por IP por hora
- GET não limitado (autenticado por token)
- Cleanup automático de janelas antigas (TTL ou cron)

### Tokens
- Geração: `crypto.randomBytes(32).toString('base64url')`
- Hash: bcrypt rounds=10
- Bearer format: `Authorization: Bearer <token>`
- Não logar tokens completos (apenas primeiros 8 chars)

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

## Dependências

- **Cloudflare D1**: storage SQL
- **Web Crypto API**: geração de tokens
- Sem dependências npm adicionais para API
