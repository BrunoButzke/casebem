# Configuração D1 para RSVP - CaseBem

Este guia explica como configurar o Cloudflare D1 para o sistema de RSVP do site de casamento.

## ⚠️ IMPORTANTE

**O sistema RSVP NÃO funcionará em produção sem:**
1. Database D1 criado e vinculado (binding `DB`)
2. Secret `RSVP_TOKEN_KEY` configurado (AES-GCM encryption)
3. Secret `RSVP_HASH_KEY` configurado (HMAC para IPs)
4. Migrations aplicadas (0001 + 0002)

**Nunca exponha os secrets em código, logs ou documentação pública.**

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

### Passo 2: Executar Migration SQL

1. No dashboard D1, selecione o database recém-criado
2. Vá para a aba **Console**
3. Copie e cole o conteúdo completo do arquivo `migrations/0001_rsvps.sql`
4. Clique em **Execute**
5. Verifique se as tabelas foram criadas:
   ```sql
   SELECT name FROM sqlite_master WHERE type='table';
   ```
   Deve retornar: `rsvps`, `rate_limits`, `schema_migrations`

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

### Passo 4: Configurar Secrets de Criptografia

O sistema RSVP requer dois secrets para segurança:

1. **RSVP_TOKEN_KEY** (32 bytes para AES-GCM)
   ```bash
   # Gerar chave aleatória
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. **RSVP_HASH_KEY** (string secreta para HMAC)
   ```bash
   # Gerar secret aleatório
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

**Adicionar no Cloudflare Pages:**
- Settings → Environment Variables
- Adicionar ambas variáveis (Production + Preview)
- **Nunca** commitar esses valores no repositório

### Passo 5: Aplicar Migrations

```bash
# Migration inicial (0001)
wrangler d1 migrations apply casebem-rsvps-production --remote

# Migration de idempotência (0002)
wrangler d1 migrations apply casebem-rsvps-production --remote
```

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
