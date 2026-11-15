export function hubTiles(plan) {
  return [
    { id: 'minha-pagina', title: 'Minha página', to: '/admin/minha-pagina', needsUpgrade: false },
    { id: 'convidados', title: 'Lista de convidados', to: '/admin/convidados', needsUpgrade: false },
    { id: 'presentes', title: 'Presentes', to: '/admin/presentes', needsUpgrade: false },
    { id: 'papelaria', title: 'Papelaria', to: '/admin/papelaria', needsUpgrade: false },
    { id: 'mural', title: 'Mural de recados', to: '/admin/mural', needsUpgrade: false },
    { id: 'entretenimento', title: 'Entretenimento', to: '/admin/entretenimento', needsUpgrade: plan === 'basic' },
    { id: 'album', title: 'Álbum compartilhado', to: '/admin/album', needsUpgrade: plan === 'basic' },
  ];
}
