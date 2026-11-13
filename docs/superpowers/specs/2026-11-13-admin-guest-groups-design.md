# Admin lista + grupos (design A)

## Escopo
- UI sem jargão "RSVP"; modo Aberto/Só da lista com auto-save
- Lista única: status (Pendente/Confirmado/Ausente) + grupo; sem seção de confirmações detalhadas
- Grupos CRUD; ao adicionar, groupId opcional (padrão: sem grupo)
- Nomes: vírgula, `;` ou Enter
- Remover Hospedagem/dicas do painel

## Dados
- `guest_groups(id, wedding_key, name, created_at)`
- `rsvp_guest_list.group_id` nullable
- Status: `attending` null|0|1 (já existe)

## API
- GET/POST/PATCH `/api/admin/guest-list` estendido (groups + guest updates)
