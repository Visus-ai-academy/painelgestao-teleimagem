import { supabase } from '@/integrations/supabase/client';

/**
 * CORREÇÃO EMERGENCIAL: Aplicar regras v002/v003 em uploads existentes
 * 
 * Esta função corrige o problema de período de referência e aplica as regras
 * v002/v003 nos uploads que já foram processados mas não tiveram as regras aplicadas.
 */
export async function corrigirRegrasV002V003Existentes(): Promise<{ success: boolean; message: string; detalhes: any }> {
  console.log('🚨 CORREÇÃO EMERGENCIAL: Aplicando regras v002/v003 em uploads existentes');
  
  try {
    // Buscar uploads recentes que precisam das regras v002/v003
    const { data: uploadsProblematicos, error: errorUploads } = await supabase
      .from('processamento_uploads')
      .select('*')
      .in('tipo_arquivo', ['volumetria_padrao_retroativo', 'volumetria_fora_padrao_retroativo'])
      .eq('status', 'concluido')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Últimas 24h
      .order('created_at', { ascending: false });
      
    if (errorUploads) {
      console.error('❌ Erro ao buscar uploads:', errorUploads);
      throw new Error(`Erro ao buscar uploads: ${errorUploads.message}`);
    }
    
    console.log(`📋 Encontrados ${uploadsProblematicos?.length || 0} uploads retroativos para correção`);
    
    const resultados = [];
    
    for (const upload of uploadsProblematicos || []) {
      console.log(`\n🔧 Processando upload: ${upload.arquivo_nome} (${upload.tipo_arquivo})`);
      
      // Log do período - usar formato YYYY-MM do banco diretamente
      console.log(`📅 Período do banco (YYYY-MM): ${upload.periodo_referencia}`);
      
      // Verificar se há registros para este arquivo
      const { count: registrosExistentes } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
        .eq('arquivo_fonte', upload.tipo_arquivo);
        
      console.log(`📊 Registros existentes para ${upload.tipo_arquivo}: ${registrosExistentes || 0}`);
      
      if (!registrosExistentes || registrosExistentes === 0) {
        console.log(`⏸️ Pulando ${upload.tipo_arquivo} - nenhum registro encontrado`);
        resultados.push({
          arquivo: upload.arquivo_nome,
          tipo: upload.tipo_arquivo,
          periodo_original: upload.periodo_referencia,
          periodo_utilizado: upload.periodo_referencia,
          status: 'SEM_REGISTROS',
          registros_antes: 0,
          registros_depois: 0,
          excluidos: 0
        });
        continue;
      }
      
      // Aplicar regras v002/v003
      try {
        console.log(`🚀 Aplicando regras v002/v003 para ${upload.tipo_arquivo}...`);
        console.log(`📅 Período DB: ${upload.periodo_referencia} (será enviado diretamente)`);
        
        // CORREÇÃO CRÍTICA: Enviar período no formato YYYY-MM (formato do banco)
        // Não usar periodoEdgeFormat que converte para mes/ano e causa erros de parsing
        const { data: resultadoRegras, error: errorRegras } = await supabase.functions.invoke(
          'aplicar-exclusoes-periodo',
          {
            body: {
              arquivo_fonte: upload.tipo_arquivo,
              periodo_referencia: upload.periodo_referencia // Formato YYYY-MM direto do banco
            }
          }
        );
        
        if (errorRegras) {
          console.error(`❌ Erro ao aplicar regras para ${upload.tipo_arquivo}:`, errorRegras);
          resultados.push({
            arquivo: upload.arquivo_nome,
            tipo: upload.tipo_arquivo,
            periodo_original: upload.periodo_referencia,
            periodo_utilizado: upload.periodo_referencia,
            status: 'ERRO',
            erro: errorRegras.message,
            registros_antes: registrosExistentes,
            registros_depois: registrosExistentes,
            excluidos: 0
          });
        } else {
          // Verificar registros após aplicação
          const { count: registrosDepois } = await supabase
            .from('volumetria_mobilemed')
            .select('*', { count: 'exact', head: true })
            .eq('arquivo_fonte', upload.tipo_arquivo);
            
          const excluidos = (registrosExistentes || 0) - (registrosDepois || 0);
          
          console.log(`✅ Regras aplicadas para ${upload.tipo_arquivo}:`);
          console.log(`   📊 Antes: ${registrosExistentes} registros`);
          console.log(`   📊 Depois: ${registrosDepois} registros`);
          console.log(`   📊 Excluídos: ${excluidos} registros`);
          
          resultados.push({
            arquivo: upload.arquivo_nome,
            tipo: upload.tipo_arquivo,
            periodo_original: upload.periodo_referencia,
            periodo_utilizado: upload.periodo_referencia,
            status: 'SUCESSO',
            registros_antes: registrosExistentes,
            registros_depois: registrosDepois,
            excluidos: excluidos,
            detalhes_regras: resultadoRegras
          });
        }
        
      } catch (errorAplic) {
        console.error(`❌ Erro crítico ao aplicar regras para ${upload.tipo_arquivo}:`, errorAplic);
        resultados.push({
          arquivo: upload.arquivo_nome,
          tipo: upload.tipo_arquivo,
          periodo_original: upload.periodo_referencia,
          periodo_utilizado: upload.periodo_referencia,
          status: 'ERRO_CRITICO',
          erro: errorAplic instanceof Error ? errorAplic.message : 'Erro desconhecido',
          registros_antes: registrosExistentes,
          registros_depois: registrosExistentes,
          excluidos: 0
        });
      }
    }
    
    const totalCorrigidos = resultados.filter(r => r.status === 'SUCESSO').length;
    const totalExcluidos = resultados.reduce((acc, r) => acc + (r.excluidos || 0), 0);
    
    console.log(`\n🏁 CORREÇÃO CONCLUÍDA:`);
    console.log(`   ✅ Uploads corrigidos: ${totalCorrigidos}`);
    console.log(`   📊 Total de registros excluídos: ${totalExcluidos}`);
    
    return {
      success: true,
      message: `Correção aplicada em ${totalCorrigidos} uploads. Total de ${totalExcluidos} registros excluídos pelas regras v002/v003.`,
      detalhes: resultados
    };
    
  } catch (error) {
    console.error('💥 Erro crítico na correção:', error);
    return {
      success: false,
      message: `Erro na correção: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      detalhes: null
    };
  }
}