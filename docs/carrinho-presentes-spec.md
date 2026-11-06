# Especificação: Carrinho de Presentes Multi-Itens

## Objetivo

Permitir que convidados selecionem **múltiplos presentes**, ajustem quantidades, visualizem total, e escolham forma de pagamento (Pix/Cartão/Boleto) antes de finalizar, com identificação nominal do presenteador.

## Escopo DESTA PR

### ✅ Entrega

- **Carrinho interativo**: adicionar/remover itens, ajustar quantidade, ver subtotal/total em centavos
- **Persistência session**: sessionStorage resiliente (storage denied/malformed não quebra)
- **Identificação nominal**: nome do presenteador visível no fluxo
- **Escolha de pagamento**: UI para Pix/Cartão/Boleto com textos relevantes
- **Mural independente**: envio de recados continua sem barreira de pagamento
- **Acessibilidade**: labels, focus, aria-live, teclado
- **Mobile usável**
- **Catálogo imutável**: fonte única server-side, preços em centavos

### ❌ NÃO Entrega (fora do escopo)

- **Gateway de pagamento real** para cartão/boleto
- **Confirmação automática** de pagamento Pix
- **Persistência de pedidos** no banco D1
- **Histórico de compras**
- **E-mail/CPF** do comprador
- **Checkout real** com cobrança de cartão

## Contrato de Dados

### Catálogo de Presentes

```javascript
// data/gifts-catalog.mjs
export const GIFTS_CATALOG = [
  {
    id: 'mensagem',
    name: 'Uma mensagem de carinho',
    description: 'Mande um carinho no valor que quiser',
    priceInCents: 99,  // R$ 0,99 mínimo
    imageUrl: '/images/gifts/mensagem.jpg',
    mode: 'custom',  // valor livre
  },
  {
    id: 'danca',
    name: 'Aula de dança',
    description: 'Uma noite só nossa',
    priceInCents: 15000,  // R$ 150,00
    imageUrl: '/images/gifts/danca.jpg',
    mode: 'fixed',  // preço fixo
  },
  // ... outros 7 presentes
];
```

### Carrinho (sessionStorage)

```javascript
// Estrutura do carrinho
{
  items: [
    {
      giftId: 'danca',
      quantity: 2,  // inteiro positivo, 1-99
    },
    {
      giftId: 'spa',
      quantity: 1,
    }
  ],
  // Total calculado no cliente E validado no servidor
}
```

### Checkout Request

```javascript
// POST /api/gifts/checkout
{
  paymentMethod: 'pix' | 'card' | 'boleto',
  gifterName: 'João Silva',  // nome do presenteador
  intentKey: '550e8400-e29b-41d4-a716-446655440000',  // UUID v4 gerado pelo cliente
  items: [
    { giftId: 'danca', quantity: 2 }
  ]
}
```

**Idempotência**: O `intentKey` é gerado uma vez pelo cliente (crypto.randomUUID) e persistido em sessionStorage. Retries com o mesmo `intentKey` e mesmo payload retornam o pagamento existente sem criar cobrança duplicada. Se o `intentKey` já foi usado com payload diferente, o servidor retorna 409 CONFLICT.

### Checkout Response

#### Pix (disponível)
```javascript
{
  ok: true,
  method: 'pix',
  status: 'pending',
  payment: {
    id: '...',
    qrCode: '...',
    qrCodeBase64: '...',
  }
}
```

#### Cartão/Boleto (Checkout Pro — redirect Mercado Pago)
```javascript
{
  ok: true,
  method: 'card' | 'boleto',
  status: 'pending',
  redirectUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=...',
  payment: { id: 'pref_...' }
}
```

O frontend redireciona para `redirectUrl`. Confirmação de pagamento via webhook MP
(`external_reference = casebem:gift:{intentKey}`).

## Comportamento Esperado

### Fluxo Usuário

1. **Navegar presentes**: clicar em "Abrir lista de presentes"
2. **Adicionar ao carrinho**: clicar no presente → modal abre → "Adicionar ao carrinho" (sem pagamento ainda)
3. **Ver carrinho**: ícone/badge mostra quantidade de itens
4. **Ajustar quantidade**: +/- ou remover item
5. **Ver total**: atualizado dinamicamente
6. **Identificar-se**: nome do presenteador (obrigatório)
7. **Escolher pagamento**: Pix/Cartão/Boleto
8. **Finalizar**: 
   - Pix: gera QR code
   - Cartão/Boleto: redirect Checkout Pro (Mercado Pago)

### Validações

#### Cliente
- Quantidade: inteiro 1-99
- Total: soma em centavos
- Nome: mínimo 2 caracteres, máximo 100
- GiftId: existe no catálogo

#### Servidor
- Quantidade: inteiro positivo, máximo 99 por item
- GiftId: existe no catálogo server-side
- Total: recalcula do zero (não confia no cliente)
- Método de pagamento: `pix` | `card` | `boleto`
- Cartão/Boleto: cria Preference MP e retorna `redirectUrl`

### Idempotência

- Modal abrir/fechar: não duplica itens/listeners
- Clique repetido em "Adicionar": aumenta quantidade (não duplica)
- Checkout: botão desabilitado durante processamento
- Storage parse: try/catch, fallback para carrinho vazio

### Segurança

- Conteúdo injetado: `textContent`, não `innerHTML`
- Storage: parse robusto, invalid = carrinho vazio
- Image URLs: apenas catálogo local
- Total: sempre recalculado no servidor
- Sem `new Function`

## Testes (TDD)

### Domínio (data/gifts-catalog.test.mjs)
```javascript
✓ Catálogo tem 9 presentes com IDs únicos
✓ Todos preços são inteiros positivos em centavos
✓ Todos IDs são strings não-vazias
✓ Todos têm imageUrl válida
✓ Mode é 'fixed' ou 'custom'
```

### Carrinho (tests/cart-domain.test.mjs)
```javascript
✓ Adicionar presente diferente
✓ Adicionar mesmo presente aumenta quantidade
✓ Remover item
✓ Calcular total em centavos
✓ Quantidade máxima 99
✓ Quantidade inválida (0, negativo, infinito) = erro
✓ GiftId desconhecido = erro
✓ Carrinho vazio = total 0
✓ Storage denied/invalid fallback
```

### Checkout (tests/gifts-checkout.test.mjs)
```javascript
✓ Pix: gera pagamento válido
✓ Cartão: retorna redirectUrl Checkout Pro
✓ Boleto: retorna redirectUrl Checkout Pro
✓ Método desconhecido: erro 400
✓ Items vazios: erro 400
✓ GiftId inexistente: erro 400
✓ Quantidade inválida: erro 400
✓ Nome presenteador obrigatório
✓ Total recalculado no servidor (ignora cliente)
```

### Frontend (tests/cart-frontend.test.mjs - happy-dom)
```javascript
✓ Abrir modal presente
✓ Adicionar ao carrinho
✓ Badge atualiza com quantidade
✓ Abrir modal carrinho
✓ Incrementar quantidade
✓ Decrementar quantidade
✓ Remover item
✓ Total atualizado dinamicamente
✓ Formulário checkout com nome
✓ Escolha de método de pagamento
✓ Submit desabilitado durante processamento
✓ Cartão/Boleto: redirect Checkout Pro
✓ Pix: exibe QR code
```

### Regressão
```javascript
✓ Mural de recados: POST /api/messages sem giftId funciona
✓ RSVP: funcionalidade intacta
✓ Presente único (modal antigo): compatibilidade mantida se existir
✓ Catálogo planos: não afetado
```

## Arquitetura

### Estrutura de Arquivos

```
data/
  gifts-catalog.mjs         # Catálogo imutável (fonte única)
  gifts-catalog.test.mjs    # Testes do catálogo

src/dani-carine/
  cart.mjs                  # Lógica do carrinho (UI)
  
functions/
  _lib/
    gifts-service.mjs       # Lógica de negócio
    gifts-validators.mjs    # Validações
  api/
    gifts/
      checkout.js          # Handler checkout

tests/
  cart-domain.test.mjs      # Testes domínio carrinho
  gifts-checkout.test.mjs   # Testes API checkout
  cart-frontend.test.mjs    # Testes UI (happy-dom)

public/
  images/gifts/            # Imagens (já existem)
```

### Pagamento (Mercado Pago)

- **Pix**: payment API + QR; webhook marca `paid` via `provider_reference`
- **Cartão/Boleto**: Checkout Pro Preference + redirect; `external_reference = casebem:gift:{intentKey}`;
  webhook marca `paid` via `markIntentPaidByExternalRef` quando preference id ≠ payment id

## Configuração

### Variáveis de Ambiente

```bash
# .env.example
MP_ACCESS_TOKEN=APP_USR-xxxxxxxx  # Mercado Pago (já existe)
# Webhook URL: /api/webhooks/mercadopago (já existente)
```

## Limitações Conhecidas

1. Confirmação depende do webhook MP (ou consulta manual no painel)
2. URL de redirect Checkout Pro é cacheada na coluna `qr_code` (reuso Free-tier)
3. Sem tabela D1 dedicada `gift_orders` (usa `checkout_intents`)
4. Sem e-mail ao presenteador (só notificação opcional Resend aos noivos)

## Próximos Passos (fora desta PR)

1. Criar tabela D1 `gift_orders` para histórico rico (hoje: `checkout_intents` + CSV)
2. ~~UX pós-redirect (`?pago=ok|erro|pendente`)~~ — banner em `/dani-carine/` + limpa carrinho em `pago=ok`
3. ~~Relatórios / export CSV de presentes pagos~~ — `GET /api/admin/gifts.csv`

---

**Data**: 2026-11-06  
**Autor**: Cloud Agent (Cursor)  
**Versão**: 1.0
