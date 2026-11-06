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

#### Cartão/Boleto (indisponível - MVP)
```javascript
{
  ok: false,
  status: 503,
  error: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
  message: 'Pagamento com cartão/boleto ainda não disponível. Use Pix.',
  availableMethods: ['pix']
}
```

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
   - Cartão/Boleto: mensagem de indisponível

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
- Método de pagamento: apenas 'pix' retorna sucesso
- Cartão/Boleto: retorna 503 PAYMENT_PROVIDER_NOT_CONFIGURED

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
✓ Cartão: retorna 503 PAYMENT_PROVIDER_NOT_CONFIGURED
✓ Boleto: retorna 503 PAYMENT_PROVIDER_NOT_CONFIGURED
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
✓ Mensagem erro cartão/boleto indisponível
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

### Adaptadores de Pagamento

```javascript
// functions/_lib/payment-adapter.mjs
export async function createPayment({ method, amount, items, gifterName, env }) {
  if (method === 'pix') {
    // Usa Mercado Pago existente
    return createPixPayment({ ... });
  }
  
  if (method === 'card' || method === 'boleto') {
    // Provedor não configurado (MVP)
    return {
      ok: false,
      status: 503,
      error: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
      message: 'Pagamento com cartão/boleto ainda não disponível. Use Pix.',
      availableMethods: ['pix']
    };
  }
  
  return {
    ok: false,
    status: 400,
    error: 'INVALID_PAYMENT_METHOD',
    message: 'Método de pagamento inválido.'
  };
}
```

## Configuração

### Variáveis de Ambiente

```bash
# .env.example
MP_ACCESS_TOKEN=APP_USR-xxxxxxxx  # Mercado Pago (já existe)

# Futuro (quando contratar gateway):
# PAYMENT_PROVIDER=stripe|pagarme|...
# PAYMENT_PROVIDER_KEY=...
```

## Limitações Conhecidas

1. **Pix não é confirmado automaticamente**: requer consulta manual ou webhook
2. **Cartão/Boleto**: não implementado (gateway ausente)
3. **Sem persistência de pedidos**: não há tabela D1 para orders
4. **Sem e-mail/SMS**: não há notificação automática
5. **Sem histórico**: não rastreia quem deu o quê

## Próximos Passos (fora desta PR)

1. Contratar gateway de pagamento (Stripe, PagarMe, etc.)
2. Implementar adapter real para cartão/boleto
3. Criar tabela D1 `gift_orders` para histórico
4. Webhook Mercado Pago para confirmação Pix
5. Painel administrativo para noivos verem presentes

---

**Data**: 2026-11-06  
**Autor**: Cloud Agent (Cursor)  
**Versão**: 1.0
