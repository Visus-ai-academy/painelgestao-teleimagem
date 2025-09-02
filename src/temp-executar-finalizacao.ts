import { supabase } from "@/integrations/supabase/client";

console.log('🔄 Executando finalização de uploads travados...');

// Primeiro, verificar uploads que estão processando
supabase
  .from('processamento_uploads')
  .select('*')
  .eq('status', 'processando')
  .then(({ data, error }) => {
    if (error) {
      console.error('❌ Erro ao buscar uploads:', error);
      return;
    }
    
    console.log('📋 Uploads encontrados:', data);
    
    // Para cada upload, verificar se há dados na volumetria
    data?.forEach(async (upload) => {
      console.log(`🔍 Verificando upload: ${upload.arquivo_nome} (${upload.tipo_arquivo})`);
      
      const { count } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', upload.tipo_arquivo);
      
      console.log(`📊 Registros encontrados para ${upload.tipo_arquivo}: ${count}`);
      
      if (count && count > 0) {
        // Finalizar o upload
        const { error: updateError } = await supabase
          .from('processamento_uploads')
          .update({
            status: 'concluido',
            registros_inseridos: count,
            completed_at: new Date().toISOString()
          })
          .eq('id', upload.id);
        
        if (updateError) {
          console.error(`❌ Erro ao finalizar ${upload.arquivo_nome}:`, updateError);
        } else {
          console.log(`✅ Upload ${upload.arquivo_nome} finalizado com ${count} registros`);
        }
      }
    });
  });

export {};