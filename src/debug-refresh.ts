// Arquivo temporário para forçar refresh dos dados
console.log('🔄 Forçando refresh dos dados para debug...');

// Forçar reload da página para ativar os logs de debug
setTimeout(() => {
  if ((window as any).volumetriaContext) {
    console.log('🔥 Executando refresh via contexto...');
    (window as any).volumetriaContext.refreshData();
  } else {
    console.log('🔄 Contexto não disponível, recarregando página...');
    window.location.reload();
  }
}, 1000);

export {};