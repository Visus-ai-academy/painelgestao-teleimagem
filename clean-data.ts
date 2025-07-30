import { supabase } from '@/integrations/supabase/client';

async function limparDadosVolumetria() {
  try {
    console.log('Iniciando limpeza de dados duplicados...');
    
    const arquivosParaLimpar = [
      'volumetria_padrao',
      'volumetria_fora_padrao', 
      'volumetria_padrao_retroativo',
      'volumetria_fora_padrao_retroativo'
    ];

    const { data, error } = await supabase.functions.invoke('limpar-dados-volumetria', {
      body: { arquivos_fonte: arquivosParaLimpar }
    });

    if (error) {
      console.error('Erro ao limpar dados:', error);
      return;
    }

    console.log('Limpeza concluída com sucesso:', data);
    console.log(`${data.registros_removidos} registros removidos`);
    
  } catch (error) {
    console.error('Erro na limpeza:', error);
  }
}

// Executar limpeza
limparDadosVolumetria();