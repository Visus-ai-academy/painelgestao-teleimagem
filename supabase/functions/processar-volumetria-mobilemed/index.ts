import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VolumetriaRecord {
  // Campos exatos do arquivo - sem mapeamento necessário
  EMPRESA: string;
  NOME_PACIENTE: string;
  CODIGO_PACIENTE?: string;
  ESTUDO_DESCRICAO?: string;
  ACCESSION_NUMBER?: string;
  MODALIDADE?: string;
  PRIORIDADE?: string;
  VALORES?: number;
  ESPECIALIDADE?: string;
  MEDICO?: string;
  DUPLICADO?: string;
  DATA_REALIZACAO?: Date;
  HORA_REALIZACAO?: string;
  DATA_TRANSFERENCIA?: Date;
  HORA_TRANSFERENCIA?: string;
  DATA_LAUDO?: Date;
  HORA_LAUDO?: string;
  DATA_PRAZO?: Date;
  HORA_PRAZO?: string;
  STATUS?: string;
  DATA_REASSINATURA?: Date;
  HORA_REASSINATURA?: string;
  MEDICO_REASSINATURA?: string;
  SEGUNDA_ASSINATURA?: string;
  POSSUI_IMAGENS_CHAVE?: string;
  IMAGENS_CHAVES?: number;
  IMAGENS_CAPTURADAS?: number;
  CODIGO_INTERNO?: number;
  DIGITADOR?: string;
  COMPLEMENTAR?: string;
  arquivo_fonte: 'data_laudo' | 'data_exame' | 'volumetria_fora_padrao';
}

// Função para converter data do formato brasileiro (dd/mm/aa ou dd/mm/aaaa)
function convertBrazilianDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    // Remove espaços e caracteres especiais
    const cleanDate = dateStr.trim();
    
    // Formatos aceitos: dd/mm/aa, dd/mm/aaaa, dd-mm-aa, dd-mm-aaaa
    const dateRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;
    const match = cleanDate.match(dateRegex);
    
    if (!match) {
      console.warn(`Formato de data inválido: ${dateStr}`);
      return null;
    }
    
    let [, day, month, year] = match;
    
    // Converte ano de 2 dígitos para 4 dígitos
    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const currentCentury = Math.floor(currentYear / 100) * 100;
      year = String(currentCentury + parseInt(year));
    }
    
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    // Valida se a data é válida
    if (isNaN(date.getTime())) {
      console.warn(`Data inválida: ${dateStr}`);
      return null;
    }
    
    return date;
  } catch (error) {
    console.warn(`Erro ao converter data: ${dateStr}`, error);
    return null;
  }
}

// Função para converter hora (hh:mm:ss ou hh:mm)
function convertTime(timeStr: string): string | null {
  if (!timeStr || timeStr.trim() === '') return null;
  
  try {
    const cleanTime = timeStr.trim();
    
    // Formatos aceitos: hh:mm:ss, hh:mm
    const timeRegex = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;
    const match = cleanTime.match(timeRegex);
    
    if (!match) {
      console.warn(`Formato de hora inválido: ${timeStr}`);
      return null;
    }
    
    const [, hours, minutes, seconds = '00'] = match;
    
    // Valida se os valores são válidos
    const h = parseInt(hours);
    const m = parseInt(minutes);
    const s = parseInt(seconds);
    
    if (h > 23 || m > 59 || s > 59) {
      console.warn(`Hora inválida: ${timeStr}`);
      return null;
    }
    
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
  } catch (error) {
    console.warn(`Erro ao converter hora: ${timeStr}`, error);
    return null;
  }
}

// Função para converter valores (parte inteira apenas)
function convertValues(valueStr: string | number): number | null {
  if (valueStr === null || valueStr === undefined || valueStr === '') return null;
  
  try {
    const numValue = typeof valueStr === 'string' ? parseFloat(valueStr) : valueStr;
    
    if (isNaN(numValue)) {
      console.warn(`Valor numérico inválido: ${valueStr}`);
      return null;
    }
    
    // Retorna apenas a parte inteira
    return Math.floor(numValue);
  } catch (error) {
    console.warn(`Erro ao converter valor: ${valueStr}`, error);
    return null;
  }
}

// Função para processar uma linha do Excel
function processRow(row: any, arquivoFonte: 'data_laudo' | 'data_exame' | 'volumetria_fora_padrao'): VolumetriaRecord | null {
  try {
    // Validação básica apenas para garantir que existe um objeto
    if (!row || typeof row !== 'object') {
      console.warn('Linha inválida: objeto row não definido ou inválido');
      return null;
    }

    // ACEITAR TODOS OS REGISTROS - não validar campos obrigatórios
    // Cada linha do arquivo é um registro válido que deve ser mantido
    const empresa = row['EMPRESA'] || '';
    const nomePaciente = row['NOME_PACIENTE'] || '';

    // Função helper para conversão segura de string
    const safeString = (value: any): string | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      return String(value).trim() || undefined;
    };

    const record: VolumetriaRecord = {
      // Campos obrigatórios - conversão segura
      EMPRESA: String(empresa).trim(),
      NOME_PACIENTE: String(nomePaciente).trim(),
      arquivo_fonte: arquivoFonte,
      
      // Campos opcionais de texto - conversão null-safe
      CODIGO_PACIENTE: safeString(row['CODIGO_PACIENTE']),
      ESTUDO_DESCRICAO: safeString(row['ESTUDO_DESCRICAO']),
      ACCESSION_NUMBER: safeString(row['ACCESSION_NUMBER']),
      MODALIDADE: safeString(row['MODALIDADE']),
      PRIORIDADE: safeString(row['PRIORIDADE']),
      ESPECIALIDADE: safeString(row['ESPECIALIDADE']),
      MEDICO: safeString(row['MEDICO']),
      DUPLICADO: safeString(row['DUPLICADO']),
      STATUS: safeString(row['STATUS']),
      MEDICO_REASSINATURA: safeString(row['MEDICO_REASSINATURA']),
      SEGUNDA_ASSINATURA: safeString(row['SEGUNDA_ASSINATURA']),
      POSSUI_IMAGENS_CHAVE: safeString(row['POSSUI_IMAGENS_CHAVE']),
      DIGITADOR: safeString(row['DIGITADOR']),
      COMPLEMENTAR: safeString(row['COMPLEMENTAR']),
      
      // Campos numéricos - conversão null-safe
      VALORES: row['VALORES'] ? convertValues(row['VALORES']) : undefined,
      IMAGENS_CHAVES: row['IMAGENS_CHAVES'] ? convertValues(row['IMAGENS_CHAVES']) : undefined,
      IMAGENS_CAPTURADAS: row['IMAGENS_CAPTURADAS'] ? convertValues(row['IMAGENS_CAPTURADAS']) : undefined,
      CODIGO_INTERNO: row['CODIGO_INTERNO'] ? convertValues(row['CODIGO_INTERNO']) : undefined,
      
      // Campos de data - conversão null-safe
      DATA_REALIZACAO: row['DATA_REALIZACAO'] ? convertBrazilianDate(String(row['DATA_REALIZACAO'])) : undefined,
      DATA_TRANSFERENCIA: row['DATA_TRANSFERENCIA'] ? convertBrazilianDate(String(row['DATA_TRANSFERENCIA'])) : undefined,
      DATA_LAUDO: row['DATA_LAUDO'] ? convertBrazilianDate(String(row['DATA_LAUDO'])) : undefined,
      DATA_PRAZO: row['DATA_PRAZO'] ? convertBrazilianDate(String(row['DATA_PRAZO'])) : undefined,
      DATA_REASSINATURA: row['DATA_REASSINATURA'] ? convertBrazilianDate(String(row['DATA_REASSINATURA'])) : undefined,
      
      // Campos de hora - conversão null-safe
      HORA_REALIZACAO: row['HORA_REALIZACAO'] ? convertTime(String(row['HORA_REALIZACAO'])) : undefined,
      HORA_TRANSFERENCIA: row['HORA_TRANSFERENCIA'] ? convertTime(String(row['HORA_TRANSFERENCIA'])) : undefined,
      HORA_LAUDO: row['HORA_LAUDO'] ? convertTime(String(row['HORA_LAUDO'])) : undefined,
      HORA_PRAZO: row['HORA_PRAZO'] ? convertTime(String(row['HORA_PRAZO'])) : undefined,
      HORA_REASSINATURA: row['HORA_REASSINATURA'] ? convertTime(String(row['HORA_REASSINATURA'])) : undefined,
    };

    return record;
  } catch (error) {
    console.error('❌ ERRO AO PROCESSAR LINHA - DADOS PERDIDOS:', error);
    console.error('❌ LINHA PROBLEMÁTICA:', JSON.stringify(row));
    console.error('❌ STACK TRACE:', error instanceof Error ? error.stack : 'N/A');
    
    // ⚠️ TEMPORÁRIO: Em vez de rejeitar, vamos tentar criar um registro básico
    try {
      const basicRecord: VolumetriaRecord = {
        EMPRESA: String(row['EMPRESA'] || '').trim(),
        NOME_PACIENTE: String(row['NOME_PACIENTE'] || '').trim(),
        arquivo_fonte: arquivoFonte,
        // Todos os outros campos ficam undefined - aceita registro mesmo com erro
      };
      console.warn('⚠️ REGISTRO SALVO COM DADOS BÁSICOS APENAS');
      return basicRecord;
    } catch (criticalError) {
      console.error('💥 ERRO CRÍTICO - REGISTRO REJEITADO:', criticalError);
      return null;
    }
  }
}


serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_path, arquivo_fonte } = await req.json();

    console.log('=== PROCESSAR VOLUMETRIA MOBILEMED ===');
    console.log('Arquivo:', file_path);
    console.log('Fonte:', arquivo_fonte);

    if (!file_path || !arquivo_fonte) {
      throw new Error('file_path e arquivo_fonte são obrigatórios');
    }

    if (!['data_laudo', 'data_exame', 'volumetria_fora_padrao'].includes(arquivo_fonte)) {
      throw new Error('arquivo_fonte deve ser "data_laudo", "data_exame" ou "volumetria_fora_padrao"');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Criar log de upload
    const { data: uploadLog, error: logError } = await supabaseClient
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file_path,
        tipo_arquivo: arquivo_fonte,
        tipo_dados: 'volumetria',
        status: 'processando',
        registros_processados: 0,
        registros_inseridos: 0,
        registros_atualizados: 0,
        registros_erro: 0
      })
      .select()
      .single();

    if (logError) {
      console.error('Erro ao criar log:', logError);
      throw new Error('Erro ao criar log de upload');
    }

    console.log('Log criado:', uploadLog.id);

    // Retornar resposta imediata
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Upload registrado com sucesso",
        upload_log_id: uploadLog.id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
