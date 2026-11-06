# Configuração D1 para RSVP - CaseBem

Este guia explica como configurar o Cloudflare D1 para o sistema de RSVP do site de casamento.

## ⚠️ IMPORTANTE

**O sistema RSVP e Mural de Recados NÃO funcionarão em produção sem:**
1. Database D1 criado e vinculado (binding `DB`)
2. Secret `RSVP_SECRET` configurado (32 bytes base64, HKDF derivation para HMAC)
3. Migrations aplicadas (0001, 0002, 0003)

**Nunca exponha o secret em código, logs ou documentação pública.**

## Funcionalidades

- **RSVP**: Confirmação de presença com rate limit de 10 requisições/hora por IP
- **Mural de Recados**: Mensagens públicas dos convidados com rate limit de 5 requisições/hora por IP
- **Rate Limiting**: Namespaces separados (`rsvp:` e `messages:`) compartilham a tabela `rate_limits` mas contadores independentes
- **Idempotência**: Suporte via `Idempotency-Key` header com fingerprint SHA-256 do payload

## Pré-requisitos

- Conta Cloudflare com Pages configurado
- Wrangler CLI instalado (opcional, mas recomendado)
- Acesso ao dashboard do Cloudflare
- Node.js (para gerar secrets aleatórios)

## Opção 1: Configuração via Dashboard (Recomendado para Produção)

### Passo 1: Criar Database D1

1. Acesse o [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navegue para **Workers & Pages** → **D1**
3. Clique em **Create database**
4. Nome: `casebem-rsvps-production`
5. Clique em **Create**
6. **Anote o Database ID** que aparecerá (formato UUID)

### Passo 2: Executar Migrations SQL

1. No dashboard D1, selecione o database recém-criado
2. Vá para a aba **Console**
3. Execute as migrations em ordem:
   - Copie e cole o conteúdo completo do arquivo `migrations/0001_rsvps.sql`
   - Clique em **Execute**
   - Repita para `migrations/0002_idempotency_and_encryption.sql`
   - Repita para `migrations/0003_messages.sql`
4. Verifique se as tabelas foram criadas:
   ```sql
   SELECT name FROM sqlite_master WHERE type='table';
   ```
   Deve retornar: `rsvps`, `rate_limits`, `wedding_messages`, `schema_migrations`

### Passo 3: Configurar Binding no Cloudflare Pages

1. No dashboard, vá para **Workers & Pages**
2. Selecione seu projeto: **casebem**
3. Vá para **Settings** → **Functions**
4. Role até **D1 database bindings**
5. Clique em **Add binding**
6. Configure:
   - **Variable name:** `DB` (exatamente este nome)
   - **D1 database:** `casebem-rsvps-production`
7. Clique em **Save**

### Passo 4: Configurar Secret RSVP_SECRET

O sistema RSVP requer um único secret para segurança (32 bytes base64):

```bash
# Gerar secret aleatório (32 bytes, base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Exemplo de output:** `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=`

**Adicionar no Cloudflare Pages:**
1. Settings → Environment Variables
2. Nome: `RSVP_SECRET`
3. Valor: (copie o output do comando acima)
4. Tipo: **Encrypted** (secret)
5. Adicionar para Production + Preview
6. **Nunca** commitar este valor no repositório

**Como funciona:**
- HKDF deriva HMAC key para rate limiting (IP hashing)
- Runtime valida: base64 format + >= 32 bytes
- Erro 503 claro se misconfig

### Passo 5: Aplicar Migrations

**Importante**: Execute cada migration explicitamente na ordem, uma por vez.

```bash
# Backup recomendado antes de aplicar em produção
wrangler d1 backup create casebem-rsvps-production --remote

# Migration 0001: Tabela rsvps inicial
wrangler d1 execute casebem-rsvps-production --remote --file=migrations/0001_rsvps.sql

# Migration 0002: Idempotência e criptografia
wrangler d1 execute casebem-rsvps-production --remote --file=migrations/0002_idempotency_and_encryption.sql

# Migration 0003: Mural de recados
wrangler d1 execute casebem-rsvps-production --remote --file=migrations/0003_messages.sql

# Migration 0004: Checkout intents (idempotência de pagamentos)
wrangler d1 execute casebem-rsvps-production --remote --file=migrations/0004_checkout_intents.sql

# Migration 0005: painel admin (paid_at + hidden em recados)
wrangler d1 execute casebem-rsvps-production --remote --file=migrations/0005_admin_and_paid.sql

# Migration 0006: RSVP fechado (lista de convidados)
wrangler d1 execute casebem-rsvps-production --remote --file=migrations/0006_rsvp_closed.sql
```

**Nota**: Todas as migrations usam `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN` e `INSERT ... ON CONFLICT(version) DO NOTHING` para serem idempotentes e seguras para reaplicação. Não é necessário configurar `migrations_dir` no `wrangler.toml`.

### Free-tier Cloudflare (obrigatório para este projeto)

- Use **Pages Free** + **D1 Free** apenas — **não** ative Workers Paid.
- Painel: `ADMIN_PANEL_SECRET` (Bearer) — sem Cloudflare Access pago.
- E-mail opcional via **Resend** (fora da CF). Sem key = sem e-mail, sem custo.
- Webhook MP: `POST /api/webhooks/mercadopago` (conta no limite diário de Functions).

### Migration 0004: Checkout Intents

A migration 0004 adiciona a tabela `checkout_intents` para prevenir cobranças duplicadas via:
- **intent_key**: UUID gerado pelo cliente (36 chars, único)
- **fingerprint**: SHA-256 do payload canonicalizado (64 chars hex)
- **provider_reference**: ID do pagamento no Mercado Pago
- **status**: `creating`, `pending`, ou `failed`
- **Idempotência**: Mesmo intent_key + mesmo fingerprint = retorna mesmo pagamento
- **Conflito**: Mesmo intent_key + fingerprint diferente = erro 409

A tabela compartilha a mesma database com `rsvps`, `wedding_messages` e `rate_limits`.

### Passo 6: Verificar Configuração

1. Force redeploy para carregar novas env vars
2. Acesse a página do casamento
3. Teste o formulário RSVP
4. No dashboard D1, verifique os dados:
   ```sql
   SELECT COUNT(*) as total FROM rsvps;
   ```

## Opção 2: Configuração via Wrangler CLI

### Instalar Wrangler

```bash
npm install -g wrangler
# ou
npm install --save-dev wrangler
```

### Autenticar

```bash
wrangler login
```

### Criar Database

```bash
wrangler d1 create casebem-rsvps-production
```

Saída exemplo:
```
✅ Successfully created DB 'casebem-rsvps-production'

[[d1_databases]]
binding = "DB"
database_name = "casebem-rsvps-production" 
database_id = "12345678-abcd-1234-abcd-123456789abc"
```

**Anote o `database_id`** para usar no próximo passo.

### Aplicar Migration

```bash
wrangler d1 execute casebem-rsvps-production \
  --file=migrations/0001_rsvps.sql \
  --remote
```

### Verificar Tabelas

```bash
wrangler d1 execute casebem-rsvps-production \
  --command="SELECT name FROM sqlite_master WHERE type='table';" \
  --remote
```

### Configurar Binding

Como o projeto usa Cloudflare Pages (não Workers standalone), você ainda precisa configurar o binding via Dashboard conforme Opção 1, Passo 3.

## Desenvolvimento Local

### Criar Database Local

```bash
# Criar database local SQLite
wrangler d1 execute DB \
  --file=migrations/0001_rsvps.sql \
  --local
```

### Rodar Localmente com Wrangler

```bash
# Desenvolvimento local com D1 binding
wrangler pages dev --d1=DB --port=5173
```

Ou usar o Vite normalmente e mockar a API durante desenvolvimento (ver testes).

## Consultas Úteis

### Ver todos os RSVPs

```sql
SELECT 
  id,
  guest_name,
  CASE WHEN attending = 1 THEN 'SIM' ELSE 'NÃO' END as presenca,
  adults_count,
  children_count,
  created_at
FROM rsvps
ORDER BY created_at DESC;
```

### Contar Presenças

```sql
SELECT 
  CASE WHEN attending = 1 THEN 'Confirmados' ELSE 'Não irão' END as status,
  COUNT(*) as total,
  SUM(adults_count) as adultos,
  SUM(children_count) as criancas
FROM rsvps
WHERE wedding_key = 'dani-carine'
GROUP BY attending;
```

### Ver Rate Limits Ativos

```sql
SELECT 
  ip_hash,
  request_count,
  window_start,
  updated_at
FROM rate_limits
WHERE window_start > datetime('now', '-2 hours')
ORDER BY request_count DESC;
```

### Limpar Rate Limits Antigos (Manutenção)

```sql
DELETE FROM rate_limits
WHERE window_start < datetime('now', '-24 hours');
```

## Segurança

### Dados Sensíveis

- **Tokens**: Apenas hashes SHA-256 são armazenados, tokens encriptados com AES-256-GCM
- **IPs**: Apenas hashes SHA-256 são armazenados
- **Observações**: Nunca expostas em listagens públicas

### Backups

O Cloudflare D1 faz backups automáticos. Para backup manual:

```bash
# Exportar dados
wrangler d1 execute casebem-rsvps-production \
  --command="SELECT * FROM rsvps;" \
  --remote \
  --json > backup-rsvps-$(date +%Y%m%d).json
```

### Acesso

- Apenas functions autenticadas no Cloudflare Pages têm acesso ao binding `DB`
- Não há acesso público direto ao database
- Rate limiting impede abuse

## Troubleshooting

### "Binding DB not found"

**Causa:** Binding não configurado no Cloudflare Pages.

**Solução:** Siga Opção 1, Passo 3 para configurar o binding.

### "Table rsvps doesn't exist"

**Causa:** Migration não foi executada.

**Solução:** Execute a migration SQL via Dashboard ou Wrangler.

### "FOREIGN KEY constraint failed"

**Causa:** D1 não suporta FOREIGN KEY constraints.

**Solução:** O schema atual já está otimizado para D1 (sem FKs).

### Rate limit não funciona

**Causa:** Cleanup de janelas antigas não implementado.

**Solução:** Executar periodicamente (manualmente ou via cron):
```sql
DELETE FROM rate_limits WHERE window_start < datetime('now', '-24 hours');
```

## Arquivos Relacionados

- `migrations/0001_rsvps.sql` - Schema inicial
- `docs/rsvp-api-spec.md` - Especificação completa da API
- `functions/api/rsvp.js` - Handler da API
- `functions/_lib/rsvp-service.mjs` - Lógica de negócio

## Suporte

Para questões sobre D1, consulte:
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Wrangler D1 Commands](https://developers.cloudflare.com/workers/wrangler/commands/#d1)

---

**Nota Importante:** Este database é específico para o evento `dani-carine`. Para usar em outros casamentos, será necessário criar databases separados ou implementar multi-tenancy.
