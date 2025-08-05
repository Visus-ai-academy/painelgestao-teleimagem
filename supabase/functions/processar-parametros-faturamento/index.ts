import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParametroRow {
  "Nome Empresa"?: string;
  "Cliente Consolidado"?: string;
  "Status"?: string;
  "Impostos abMin"?: string;
  "Simples"?: string;
  "Tipo métrica convênio"?: string;
  "Valor convênio"?: number;
  "Tipo métrica URGÊNCIA"?: string;
  "Valor URGÊNCIA"?: number;
  "Tipo Desconto / Acréscimo"?: string;
  "Desconto / Acréscimo"?: number;
  "Integração"?: string;
  "Data Início Integração"?: string;
  "Portal de Laudos"?: string;
  "% ISS"?: number;
  "Possui Franquia"?: string;
  "Valor Franquia"?: number;
  "Frequencia Contínua"?: string;
  "Frequência por volume"?: string;
  "Volume"?: number;
  "R$ Valor Franquia Acima Volume"?: number;
  "Data Início Franquia"?: string;
  "Cobrar URGÊNCIA como ROTINA"?: string;
  "Incluir Empresa Origem"?: string;
  "Incluir Acces Number"?: string;
  "Incluir Médico Solicitante"?: string;
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

    if (!file) {
      throw new Error('Nenhum arquivo foi enviado');
    }

    console.log(`Processando arquivo: ${file.name}, tamanho: ${file.size} bytes`);

    // Ler arquivo Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as ParametroRow[];

    console.log(`Total de linhas encontradas: ${jsonData.length}`);

    let processados = 0;
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const detalhesErros: any[] = [];

    // Buscar clientes
    const { data: clientes } = await supabase.from('clientes').select('id, nome');
    const clienteMap = new Map(clientes?.map(c => [c.nome.toLowerCase(), c.id]) || []);

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      processados++;

      try {
        if (!row["Nome Empresa"]) {
          throw new Error('Campo "Nome Empresa" é obrigatório');
        }

        // Preparar dados do parâmetro
        const parametroData = {
          cliente_id: clienteMap.get(row["Nome Empresa"].toLowerCase().trim()),
          tipo_cliente: row["Status"]?.trim() || 'CO',
          valor_integracao: row["Valor convênio"] ? Number(row["Valor convênio"]) : null,
          cobrar_integracao: row["Integração"]?.trim()?.toLowerCase() === 'sim',
          percentual_urgencia: row["Valor URGÊNCIA"] ? Number(row["Valor URGÊNCIA"]) : null,
          aplicar_adicional_urgencia: row["Tipo métrica URGÊNCIA"]?.trim()?.toLowerCase() === 'percentual',
          valor_franquia: row["Valor Franquia"] ? Number(row["Valor Franquia"]) : null,
          volume_franquia: row["Volume"] ? Number(row["Volume"]) : null,
          frequencia_continua: row["Frequencia Contínua"]?.trim()?.toLowerCase() === 'sim',
          frequencia_por_volume: row["Frequência por volume"]?.trim()?.toLowerCase() === 'sim',
          valor_acima_franquia: row["R$ Valor Franquia Acima Volume"] ? Number(row["R$ Valor Franquia Acima Volume"]) : null,
          aplicar_franquia: row["Possui Franquia"]?.trim()?.toLowerCase() === 'sim',
          data_aniversario_contrato: row["Data Início Franquia"] ? new Date(row["Data Início Franquia"]).toISOString().split('T')[0] : null,
          periodicidade_reajuste: 'anual',
          indice_reajuste: 'IGP-M',
          percentual_reajuste_fixo: row["Desconto / Acréscimo"] ? Number(row["Desconto / Acréscimo"]) : null,
          ativo: true
        };

        if (!parametroData.cliente_id) {
          throw new Error(`Cliente não encontrado: ${row["Nome Empresa"]}`);
        }

        // Verificar se já existe
        const { data: existente } = await supabase
          .from('parametros_faturamento')
          .select('id')
          .eq('cliente_id', parametroData.cliente_id)
          .single();

        if (existente) {
          // Atualizar existente
          const { error: updateError } = await supabase
            .from('parametros_faturamento')
            .update(parametroData)
            .eq('id', existente.id);

          if (updateError) throw updateError;
          atualizados++;
        } else {
          // Inserir novo
          const { error: insertError } = await supabase
            .from('parametros_faturamento')
            .insert(parametroData);

          if (insertError) throw insertError;
          inseridos++;
        }

        console.log(`Linha ${i + 1}: Processada com sucesso - ${row["Nome Empresa"]}`);

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

    // Registrar processamento
    const { error: logError } = await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file.name,
        tipo_arquivo: 'parametros_faturamento',
        tipo_dados: 'configuracao',
        status: erros === processados ? 'erro' : 'concluido',
        registros_processados: processados,
        registros_inseridos: inseridos,
        registros_atualizados: atualizados,
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
      processados,
      inseridos,
      atualizados,
      erros,
      detalhes_erros: detalhesErros
    };

    console.log('Processamento concluído:', resultado);

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