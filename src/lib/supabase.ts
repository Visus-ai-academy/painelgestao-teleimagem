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
  try {
    console.log('Iniciando processamento de clientes para arquivo:', file.name)
    
    const fileName = `clientes_${Date.now()}_${file.name}`
    console.log('Fazendo upload do arquivo:', fileName)
    
    await uploadFile(file, 'uploads', fileName)
    console.log('Upload concluído, chamando edge function...')

    const { data, error } = await supabase.functions.invoke('processar-importacao-inteligente', {
      body: { fileName }
    })

    console.log('Resposta da edge function processar-importacao-inteligente:', { data, error })

    if (error) {
      console.error('Erro da edge function processar-importacao-inteligente:', error)
      throw new Error(`Erro ao processar clientes: ${error.message}`)
    }

    console.log('Processamento de clientes concluído com sucesso')
    return data
  } catch (error) {
    console.error('Erro no processamento de clientes:', error)
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

export async function limparDadosVolumetria(arquivosFonte: string[]) {
  try {
    console.log('Limpando dados de volumetria para arquivos:', arquivosFonte)
    
    const { data, error } = await supabase.functions.invoke('limpar-dados-volumetria', {
      body: { arquivos_fonte: arquivosFonte }
    })
    
    if (error) {
      console.error('Erro ao chamar edge function:', error)
      throw new Error(`Erro ao limpar dados: ${error.message}`)
    }
    
    if (data?.error) {
      console.error('Erro retornado pela edge function:', data.error)
      throw new Error(`Erro ao limpar dados: ${data.error}`)
    }
    
    console.log('Limpeza de volumetria concluída:', data)
    return data
  } catch (error) {
    console.error('Erro na limpeza de volumetria:', error)
    throw error
  }
}