import { supabase } from '@/integrations/supabase/client'

// Tipos para as tabelas do banco
export interface ExameRealizado {
  id: string
  paciente: string
  cliente_id: string
  medico: string
  data_exame: string
  modalidade: string
  especialidade: string
  categoria?: string
  prioridade?: string
  status: string
  valor_bruto?: number
  created_at?: string
  updated_at?: string
}

export interface ContratoCliente {
  id: string
  cliente_id: string
  modalidade: string
  especialidade: string
  categoria?: string
  prioridade?: string
  valor: number
  desconto?: number
  acrescimo?: number
  data_vigencia_inicio: string
  data_vigencia_fim: string
  ativo: boolean
  created_at?: string
  updated_at?: string
}

export interface Cliente {
  id: string
  nome: string
  email: string
  telefone?: string
  endereco?: string
  cnpj?: string
  ativo: boolean
  created_at?: string
  updated_at?: string
}

export interface FaturaGerada {
  id: string
  numero: string
  cliente_id: string
  periodo: string
  data_emissao: string
  data_vencimento: string
  status: string
  subtotal: number
  desconto: number
  acrescimo: number
  valor_total: number
  observacoes?: string
  arquivo_pdf?: string
  email_enviado: boolean
  data_email?: string
  created_at?: string
  updated_at?: string
}

// Funções utilitárias para upload
export async function uploadFile(file: File, bucket: string, path: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) {
    throw new Error(`Erro no upload: ${error.message}`)
  }

  return data
}

// Funções para processar arquivos CSV/Excel
export async function processExamesFile(file: File) {
  try {
    console.log('Iniciando processamento de exames para arquivo:', file.name)
    
    // Fazer upload do arquivo
    const fileName = `exames_${Date.now()}_${file.name}`
    console.log('Fazendo upload do arquivo:', fileName)
    
    await uploadFile(file, 'uploads', fileName)
    console.log('Upload concluído, chamando edge function...')

    // Chamar Edge Function para processar
    const { data, error } = await supabase.functions.invoke('processar-exames', {
      body: { fileName }
    })

    console.log('Resposta da edge function:', { data, error })

    if (error) {
      console.error('Erro da edge function:', error)
      throw new Error(`Erro ao processar arquivo: ${error.message}`)
    }

    console.log('Processamento concluído com sucesso')
    return data
  } catch (error) {
    console.error('Erro no processamento:', error)
    throw error
  }
}

export async function processContratosFile(file: File) {
  try {
    const fileName = `contratos_${Date.now()}_${file.name}`
    await uploadFile(file, 'uploads', fileName)

    const { data, error } = await supabase.functions.invoke('processar-contratos', {
      body: { fileName }
    })

    if (error) {
      throw new Error(`Erro ao processar contratos: ${error.message}`)
    }

    return data
  } catch (error) {
    console.error('Erro no processamento:', error)
    throw error
  }
}

export async function processClientesFile(file: File) {
  console.log('📁 Processando arquivo de clientes (versão simples):', file.name);
  
  try {
    const fileName = `clientes_${Date.now()}_${file.name}`
    console.log('📤 Fazendo upload do arquivo:', fileName)
    
    await uploadFile(file, 'uploads', fileName)
    console.log('✅ Upload concluído, chamando edge function simples...')

    const { data, error } = await supabase.functions.invoke('processar-clientes-simples', {
      body: { fileName }
    })

    console.log('📊 Resposta da edge function processar-clientes-simples:', { data, error })

    if (error) {
      console.error('❌ Erro da edge function processar-clientes-simples:', error)
      throw new Error(`Erro ao processar clientes: ${error.message}`)
    }

    console.log('✅ Processamento de clientes concluído com sucesso')
    return data
  } catch (error) {
    console.error('❌ Erro no processamento de clientes:', error)
    throw error
  }
}

export async function processEscalasFile(file: File) {
  try {
    const fileName = `escalas_${Date.now()}_${file.name}`
    await uploadFile(file, 'uploads', fileName)

    const { data, error } = await supabase.functions.invoke('processar-escalas', {
      body: { fileName }
    })

    if (error) {
      throw new Error(`Erro ao processar escalas: ${error.message}`)
    }

    return data
  } catch (error) {
    console.error('Erro no processamento:', error)
    throw error
  }
}

export async function processFinanceiroFile(file: File) {
  try {
    const fileName = `financeiro_${Date.now()}_${file.name}`
    await uploadFile(file, 'uploads', fileName)

    const { data, error } = await supabase.functions.invoke('processar-financeiro', {
      body: { fileName }
    })

    if (error) {
      throw new Error(`Erro ao processar dados financeiros: ${error.message}`)
    }

    return data
  } catch (error) {
    console.error('Erro no processamento:', error)
    throw error
  }
}

export async function processFaturamentoFile(file: File) {
  try {
    // Critical fix: file name must start with faturamento_ prefix
    // The issue was incorrect files being processed with exames_ prefix
    const fileName = `faturamento_${Date.now()}_${file.name}`
    
    console.log(`Iniciando upload de arquivo de faturamento: ${fileName}`);
    
    // Make sure file is uploaded with correct prefix
    await uploadFile(file, 'uploads', fileName)

    console.log(`Upload concluído. Chamando edge function processar-faturamento com filename: ${fileName}`);

    // Now make sure we're calling the correct edge function
    const { data, error } = await supabase.functions.invoke('processar-faturamento', {
      body: { fileName }
    })

    console.log('Resposta da edge function processar-faturamento:', { data, error });

    if (error) {
      console.error('Erro detalhado:', JSON.stringify(error, null, 2));
      throw new Error(`Erro ao processar faturamento: ${error.message}`)
    }

    return data
  } catch (error) {
    console.error('Erro no processamento completo de faturamento:', error)
    throw error
  }
}

export async function limparUploadsAntigos() {
  try {
    const { data, error } = await supabase.functions.invoke('limpar-uploads')
    
    if (error) {
      console.error('Erro ao limpar uploads:', error)
      return { success: false, error: error.message }
    }
    
    return data
  } catch (error) {
    console.error('Erro na limpeza:', error)
    return { success: false, error: 'Erro interno' }
  }
}

export async function limparDadosVolumetria() {
  try {
    console.log('📡 [supabase.ts] Iniciando limpeza COMPLETA de todos os dados de volumetria e de-para')
    
    // SOLUÇÃO ROBUSTA: Tentar edge function primeiro, se falhar usar limpeza direta
    let tentativaEdgeFunction = true
    
    try {
      console.log('📡 [supabase.ts] Tentativa 1: Chamando edge function com timeout')
      
      // Criar promise com timeout de 30 segundos
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout na edge function')), 30000)
      })
      
      const edgeFunctionPromise = supabase.functions.invoke('limpar-dados-volumetria', {
        body: {}
      })
      
      const { data, error } = await Promise.race([edgeFunctionPromise, timeoutPromise]) as any
      
      if (error) {
        console.warn('⚠️ [supabase.ts] Edge function retornou erro:', error)
        tentativaEdgeFunction = false
      } else if (data?.error) {
        console.warn('⚠️ [supabase.ts] Edge function retornou erro nos dados:', data.error)
        tentativaEdgeFunction = false
      } else {
        console.log('✅ [supabase.ts] Edge function executada com sucesso:', data)
        return data
      }
      
    } catch (edgeError) {
      console.warn('⚠️ [supabase.ts] Erro na edge function, tentando limpeza direta:', edgeError)
      tentativaEdgeFunction = false
    }
    
    // FALLBACK: Limpeza direta se edge function falhar
    if (!tentativaEdgeFunction) {
      console.log('🔄 [supabase.ts] Executando limpeza direta como fallback...')
      
      let totalRemovido = 0
      const resultados = []
      
      // 1. Limpar volumetria_mobilemed em lotes
      console.log('🧹 Limpando volumetria_mobilemed...')
      let removidosVolumetria = 0
      
      // Contar registros primeiro
      const { count: totalVolumetria } = await supabase
        .from('volumetria_mobilemed')
        .select('*', { count: 'exact', head: true })
      
      console.log(`📊 Total de registros em volumetria_mobilemed: ${totalVolumetria}`)
      
      if (totalVolumetria && totalVolumetria > 0) {
        // Deletar em lotes menores para evitar timeout
        const batchSize = 500
        
        while (true) {
          const { error, count } = await supabase
            .from('volumetria_mobilemed')
            .delete({ count: 'exact' })
            .limit(100000) // Aumentado para volumes altos
          
          if (error) {
            console.error('Erro ao deletar lote volumetria:', error)
            break
          }
          
          removidosVolumetria += count || 0
          console.log(`🗑️ Removido lote de ${count} registros (total: ${removidosVolumetria})`)
          
          if ((count || 0) < batchSize) {
            break
          }
          
          // Pausa entre lotes
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
      totalRemovido += removidosVolumetria
      resultados.push({ tabela: 'volumetria_mobilemed', removidos: removidosVolumetria })
      
      // 2. Limpar processamento_uploads
      console.log('🧹 Limpando processamento_uploads...')
      const tiposArquivo = [
        'volumetria_padrao',
        'volumetria_fora_padrao', 
        'volumetria_padrao_retroativo',
        'volumetria_fora_padrao_retroativo',
        'volumetria_onco_padrao'
      ]
      
      const { error: uploadError, count: uploadCount } = await supabase
        .from('processamento_uploads')
        .delete({ count: 'exact' })
        .in('tipo_arquivo', tiposArquivo)
      
      if (!uploadError) {
        totalRemovido += uploadCount || 0
        resultados.push({ tabela: 'processamento_uploads', removidos: uploadCount || 0 })
        console.log(`🗑️ Removidos ${uploadCount} registros de processamento_uploads`)
      }
      
      // 3. Tentar limpar valores_referencia_de_para
      try {
        console.log('🧹 Limpando valores_referencia_de_para...')
        const { error: deParaError, count: deParaCount } = await supabase
          .from('valores_referencia_de_para')
          .delete({ count: 'exact' })
        
        if (!deParaError) {
          totalRemovido += deParaCount || 0
          resultados.push({ tabela: 'valores_referencia_de_para', removidos: deParaCount || 0 })
          console.log(`🗑️ Removidos ${deParaCount} registros de valores_referencia_de_para`)
        }
      } catch (deParaErr) {
        console.warn('Tabela valores_referencia_de_para não existe:', deParaErr)
      }
      
      console.log(`✅ [supabase.ts] Limpeza direta concluída: ${totalRemovido} registros removidos`)
      
      return {
        success: true,
        message: `✅ Limpeza completa realizada (fallback)! ${totalRemovido} registros removidos`,
        registros_removidos: totalRemovido,
        detalhes_por_tabela: resultados,
        metodo: 'limpeza_direta_fallback',
        timestamp: new Date().toISOString()
      }
    }
    
  } catch (error) {
    console.error('❌ [supabase.ts] Erro crítico na limpeza de volumetria:', error)
    console.error('❌ [supabase.ts] Stack trace:', error instanceof Error ? error.stack : 'N/A')
    throw new Error(`Erro ao limpar dados: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
  }
}