import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessamentoLegado {
  tipo_arquivo: string;
  periodo_referencia: string;
  descricao?: string;
  metadados?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const tipoArquivo = formData.get('tipo_arquivo') as string;
    const periodoReferencia = formData.get('periodo_referencia') as string;
    const descricao = formData.get('descricao') as string;

    if (!file || !tipoArquivo || !periodoReferencia) {
      throw new Error('Arquivo, tipo_arquivo e periodo_referencia são obrigatórios');
    }

    console.log(`Processando dados legado: ${file.name}, tipo: ${tipoArquivo}, período: ${periodoReferencia}`);

    // Criar controle de origem
    const { data: controleOrigem, error: controleError } = await supabase
      .from('controle_dados_origem')
      .insert({
        tabela_origem: tipoArquivo === 'volumetria' ? 'volumetria_mobilemed' : 'faturamento',
        tipo_dados: 'legado',
        periodo_referencia: periodoReferencia,
        descricao: descricao || `Importação dados legado - ${tipoArquivo}`,
        status: 'processando',
        metadados: {
          arquivo_nome: file.name,
          tamanho_arquivo: file.size,
          tipo_arquivo: tipoArquivo
        }
      })
      .select()
      .single();

    if (controleError) {
      throw new Error(`Erro ao criar controle de origem: ${controleError.message}`);
    }

    // Ler arquivo Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Total de linhas encontradas: ${jsonData.length}`);

    let processados = 0;
    let inseridos = 0;
    let erros = 0;
    const detalhesErros: any[] = [];

    // Processar dados baseado no tipo
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i] as any;
      processados++;

      try {
        if (tipoArquivo === 'volumetria') {
          await processarVolumetria(supabase, row, controleOrigem.id, periodoReferencia);
        } else if (tipoArquivo === 'faturamento') {
          await processarFaturamento(supabase, row, controleOrigem.id, periodoReferencia);
        } else {
          throw new Error(`Tipo de arquivo não suportado: ${tipoArquivo}`);
        }

        inseridos++;
        console.log(`Linha ${i + 1}: Processada com sucesso`);

      } catch (error: any) {
        erros++;
        const detalheErro = {
          linha: i + 1,
          dados: row,
          erro: error.message
        };
        detalhesErros.push(detalheErro);
        console.error(`Erro na linha ${i + 1}:`, error.message);
      }
    }

    // Atualizar controle de origem
    const { error: updateError } = await supabase
      .from('controle_dados_origem')
      .update({
        status: erros === processados ? 'erro' : 'ativo',
        total_registros: inseridos,
        metadados: {
          ...controleOrigem.metadados,
          processados,
          inseridos,
          erros,
          detalhes_erros: detalhesErros.slice(0, 100) // Limitar erros salvos
        }
      })
      .eq('id', controleOrigem.id);

    if (updateError) {
      console.error('Erro ao atualizar controle:', updateError);
    }

    // Registrar processamento
    const { error: logError } = await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file.name,
        tipo_arquivo: `legado_${tipoArquivo}`,
        tipo_dados: 'legado',
        periodo_referencia: periodoReferencia,
        status: erros === processados ? 'erro' : 'concluido',
        registros_processados: processados,
        registros_inseridos: inseridos,
        registros_erro: erros,
        detalhes_erro: detalhesErros.length > 0 ? detalhesErros : null,
        tamanho_arquivo: file.size
      });

    if (logError) {
      console.error('Erro ao registrar log:', logError);
    }

    const resultado = {
      sucesso: true,
      arquivo: file.name,
      tipo_dados: 'legado',
      periodo_referencia: periodoReferencia,
      controle_origem_id: controleOrigem.id,
      processados,
      inseridos,
      erros,
      detalhes_erros: detalhesErros
    };

    console.log('Processamento legado concluído:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message,
        detalhes: error.stack 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

async function processarVolumetria(supabase: any, row: any, controleOrigemId: string, periodoReferencia: string) {
  // Mapear campos comuns para volumetria
  const volumetriaData = {
    EMPRESA: row.EMPRESA || row.empresa || row.Cliente,
    MODALIDADE: row.MODALIDADE || row.modalidade,
    ESPECIALIDADE: row.ESPECIALIDADE || row.especialidade,
    CATEGORIA: row.CATEGORIA || row.categoria,
    PRIORIDADE: row.PRIORIDADE || row.prioridade,
    MEDICO: row.MEDICO || row.medico,
    PACIENTE: row.PACIENTE || row.paciente,
    ESTUDO_DESCRICAO: row.ESTUDO_DESCRICAO || row.estudo_descricao || row.Exame,
    VALORES: row.VALORES || row.valores || row.Valor || 0,
    DATA_REALIZACAO: row.DATA_REALIZACAO || row.data_realizacao || row.Data,
    DATA_LAUDO: row.DATA_LAUDO || row.data_laudo,
    HORA_LAUDO: row.HORA_LAUDO || row.hora_laudo,
    DATA_PRAZO: row.DATA_PRAZO || row.data_prazo,
    HORA_PRAZO: row.HORA_PRAZO || row.hora_prazo,
    tipo_dados: 'legado',
    periodo_referencia: periodoReferencia,
    controle_origem_id: controleOrigemId,
    arquivo_fonte: 'legado',
    data_referencia: row.DATA_REALIZACAO || row.data_realizacao || row.Data || new Date().toISOString().split('T')[0]
  };

  const { error } = await supabase
    .from('volumetria_mobilemed')
    .insert(volumetriaData);

  if (error) {
    throw error;
  }
}

async function processarFaturamento(supabase: any, row: any, controleOrigemId: string, periodoReferencia: string) {
  // Mapear campos comuns para faturamento
  const faturamentoData = {
    omie_id: row.omie_id || `LEGADO_${Date.now()}_${Math.random()}`,
    cliente_nome: row.cliente_nome || row.Cliente || row.EMPRESA,
    cliente_email: row.cliente_email || row.Email,
    numero_fatura: row.numero_fatura || row.Numero || `LEGADO_${Date.now()}`,
    data_emissao: row.data_emissao || row.Data || new Date().toISOString().split('T')[0],
    data_vencimento: row.data_vencimento || row.Vencimento,
    valor: row.valor || row.Valor || 0,
    data_pagamento: row.data_pagamento || row.Pagamento || null,
    paciente: row.paciente || row.Paciente,
    medico: row.medico || row.Medico,
    modalidade: row.modalidade || row.Modalidade,
    especialidade: row.especialidade || row.Especialidade,
    categoria: row.categoria || row.Categoria,
    prioridade: row.prioridade || row.Prioridade,
    nome_exame: row.nome_exame || row.Exame,
    data_exame: row.data_exame || row.DataExame,
    quantidade: row.quantidade || row.Quantidade || 1,
    valor_bruto: row.valor_bruto || row.ValorBruto || row.valor || 0,
    tipo_dados: 'legado',
    periodo_referencia: periodoReferencia,
    controle_origem_id: controleOrigemId
  };

  const { error } = await supabase
    .from('faturamento')
    .insert(faturamentoData);

  if (error) {
    throw error;
  }
}