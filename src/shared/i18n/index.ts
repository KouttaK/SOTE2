export const translations = {
  en: {
    'sidebar.flows': 'Flows',
    'sidebar.analytics': 'Analytics',
    'sidebar.variables': 'Variables',
    'sidebar.templates': 'Templates',
    'sidebar.settings': 'Settings',
    
    'settings.title': 'Settings',
    'settings.subtitle': 'Configure your SOTE extension preferences.',
    'settings.triggerMode': 'Trigger Mode',
    'settings.triggerMode.desc': 'How should your text blocks be inserted?',
    'settings.triggerMode.trigger': 'Trigger Keys',
    'settings.triggerMode.exact': 'Exact Match',
    'settings.triggerKeys': 'Trigger Keys',
    'settings.triggerKeys.desc': 'Select which keys will trigger the text expansion.',
    'settings.exactMatchChar': 'Exact Match Character',
    'settings.language': 'Language',
    'settings.save': 'Save Settings',
    'settings.sync.lastSync': 'Synced {mins} min ago',
  },
  'pt-BR': {
    'sidebar.flows': 'Atalhos',
    'sidebar.analytics': 'Métricas',
    'sidebar.variables': 'Variáveis',
    'sidebar.templates': 'Modelos',
    'sidebar.settings': 'Configurações',
    
    'settings.title': 'Configurações',
    'settings.subtitle': 'Configure as preferências da sua extensão SOTE.',
    'settings.triggerMode': 'Modo de Disparo',
    'settings.triggerMode.desc': 'Como os blocos de texto devem ser inseridos?',
    'settings.triggerMode.trigger': 'Teclas de Disparo',
    'settings.triggerMode.exact': 'Combinação Exata',
    'settings.triggerKeys': 'Teclas de Disparo',
    'settings.triggerKeys.desc': 'Selecione quais teclas disparam a expansão de texto.',
    'settings.exactMatchChar': 'Caractere de Combinação Exata',
    'settings.language': 'Idioma',
    'settings.save': 'Salvar Configurações',
    'settings.sync.lastSync': 'Sincronizado há {mins} min',
  }
};

let currentLanguage = 'en';

export function setLanguage(lang: string) {
  currentLanguage = lang;
}

export function t(key: string, variables?: Record<string, string | number>): string {
  const lang = (translations as any)[currentLanguage] ? currentLanguage : 'en';
  let str = (translations as any)[lang][key] || key;
  if (variables) {
    for (const [k, v] of Object.entries(variables)) {
      str = str.replace(`{${k}}`, v.toString());
    }
  }
  return str;
}
