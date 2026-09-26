const fs = require('fs');
let c = fs.readFileSync('src/shared/i18n/index.ts', 'utf8');

const replacements = {
  // English
  "'sidebar.forms': 'Forms'": "'sidebar.forms': 'Site Macros'",
  "'nav.forms': 'Forms'": "'nav.forms': 'Site Macros'",
  "across Flows, Variables, Forms": "across Flows, Variables, Site Macros",
  "'forms.title': 'Forms'": "'forms.title': 'Site Macros'",
  "'forms.subtitle': 'Site-specific fill profiles: group a site\\'s fields together and fill them one at a time.'": "'forms.subtitle': 'Group shortcuts related to a specific site (e.g. support replies, emails) and access them quickly via the search menu, without needing to memorize individual abbreviations.'",
  "'forms.new': 'New Form'": "'forms.new': 'New Site Macro'",
  "'forms.empty': 'No forms created yet.'": "'forms.empty': 'No site macros created yet.'",
  "'forms.search_placeholder': 'Search forms...'": "'forms.search_placeholder': 'Search site macros...'",
  "'forms.count': '{count} forms'": "'forms.count': '{count} site macros'",
  "'forms.empty_state.title': 'No form found'": "'forms.empty_state.title': 'No site macro found'",
  "'forms.empty_state.desc': 'Select a form from the sidebar or create a new one.'": "'forms.empty_state.desc': 'Select a site macro from the sidebar or create a new one.'",
  "'forms.editor.title.new': 'Create Form'": "'forms.editor.title.new': 'Create Site Macro'",
  "'forms.editor.title.edit': 'Edit Form'": "'forms.editor.title.edit': 'Edit Site Macro'",
  "'forms.editor.name_label': 'Form Name'": "'forms.editor.name_label': 'Macro Name'",
  "'forms.editor.sites_hint': 'Wildcards supported (e.g. *.gmail.com), same syntax as Blocklist. Leave empty to make this form available on any site.'": "'forms.editor.sites_hint': 'Wildcards supported (e.g. *.gmail.com), same syntax as Blocklist. Leave empty to make this macro available on any site.'",
  "'forms.editor.save': 'Save Form'": "'forms.editor.save': 'Save Site Macro'",
  "'forms.delete_confirm': 'Delete this form? This action cannot be undone.'": "'forms.delete_confirm': 'Delete this site macro? This action cannot be undone.'",
  "'forms.error.name_required': 'Form name is required.'": "'forms.error.name_required': 'Macro name is required.'",
  "and forms'": "and site macros'",
  "for Forms and Flows": "for Site Macros and Flows",
  "shows Forms.": "shows Site Macros.",
  "Restricts Forms to": "Restricts Site Macros to",
  "every Form plus": "every Site Macro plus",
  "forms, and settings": "site macros, and settings",

  // Portuguese
  "'sidebar.forms': 'Formulários'": "'sidebar.forms': 'Macros de Sites'",
  "'nav.forms': 'Formulários'": "'nav.forms': 'Macros de Sites'",
  "Fluxos, Variáveis, Formulários": "Fluxos, Variáveis, Macros de Sites",
  "'forms.title': 'Formulários'": "'forms.title': 'Macros de Sites'",
  "'forms.subtitle': 'Perfis de preenchimento por site: agrupe os campos de um site e preencha um de cada vez.'": "'forms.subtitle': 'Agrupe atalhos relacionados a um site específico (ex: respostas de suporte, e-mails) e acesse-os rapidamente pelo menu de busca, sem precisar decorar cada abreviação individual.'",
  "'forms.new': 'Novo Formulário'": "'forms.new': 'Nova Macro de Site'",
  "'forms.empty': 'Nenhum formulário criado ainda.'": "'forms.empty': 'Nenhuma macro de site criada ainda.'",
  "'forms.search_placeholder': 'Buscar formulários...'": "'forms.search_placeholder': 'Buscar macros de sites...'",
  "'forms.count': '{count} formulários'": "'forms.count': '{count} macros de sites'",
  "'forms.empty_state.title': 'Nenhum formulário encontrado'": "'forms.empty_state.title': 'Nenhuma macro de site encontrada'",
  "'forms.empty_state.desc': 'Selecione um formulário na barra lateral ou crie um novo.'": "'forms.empty_state.desc': 'Selecione uma macro de site na barra lateral ou crie uma nova.'",
  "'forms.editor.title.new': 'Criar Formulário'": "'forms.editor.title.new': 'Criar Macro de Site'",
  "'forms.editor.title.edit': 'Editar Formulário'": "'forms.editor.title.edit': 'Editar Macro de Site'",
  "'forms.editor.name_label': 'Nome do Formulário'": "'forms.editor.name_label': 'Nome da Macro'",
  "'forms.editor.sites_hint': 'Wildcards suportados (ex.: *.gmail.com), mesma sintaxe do Blocklist. Deixe vazio para disponibilizar este formulário em qualquer site.'": "'forms.editor.sites_hint': 'Wildcards suportados (ex.: *.gmail.com), mesma sintaxe do Blocklist. Deixe vazio para disponibilizar esta macro em qualquer site.'",
  "'forms.editor.save': 'Salvar Formulário'": "'forms.editor.save': 'Salvar Macro de Site'",
  "'forms.delete_confirm': 'Deletar este formulário? Esta ação não pode ser desfeita.'": "'forms.delete_confirm': 'Deletar esta macro de site? Esta ação não pode ser desfeita.'",
  "'forms.error.name_required': 'O nome do formulário é obrigatório.'": "'forms.error.name_required': 'O nome da macro é obrigatório.'",
  "variáveis e formulários": "variáveis e macros de sites",
  "de Formulários e Flows": "de Macros de Sites e Flows",
  "só Formulários": "só Macros de Sites",
  "aos Formulários": "às Macros de Sites",
  "todo Formulário": "toda Macro de Site",
  "formulários e configurações": "macros de sites e configurações"
};

for (const [key, value] of Object.entries(replacements)) {
  c = c.replace(key, value);
}

fs.writeFileSync('src/shared/i18n/index.ts', c);
