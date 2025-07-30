import { supabase } from '@/integrations/supabase/client';

async function limparDadosEStatus() {
  try {
    console.log('Limpando dados e status...');
    
    const arquivosParaLimpar = [
      'volumetria_padrao',
      'volumetria_fora_padrao', 
      'volumetria_padrao_retroativo',
      'volumetria_fora_padrao_retroativo',
      'volumetria_onco_padrao'
    ];

    const { data, error } = await supabase.functions.invoke('limpar-dados-volumetria', {
      body: { arquivos_fonte: arquivosParaLimpar }
    });

    if (error) {
      console.error('Erro ao limpar:', error);
      return;
    }

    console.log('Limpeza completa concluída:', data);
    console.log('Dados e status removidos com sucesso!');
    
  } catch (error) {
    console.error('Erro na limpeza:', error);
  }
}

// Executar limpeza completa
limparDadosEStatus();