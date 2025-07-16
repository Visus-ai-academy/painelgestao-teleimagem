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
    // Fazer upload do arquivo
    const fileName = `exames_${Date.now()}_${file.name}`
    await uploadFile(file, 'uploads', fileName)

    // Chamar Edge Function para processar
    const { data, error } = await supabase.functions.invoke('processar-exames', {
      body: { fileName }
    })

    if (error) {
      throw new Error(`Erro ao processar arquivo: ${error.message}`)
    }

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