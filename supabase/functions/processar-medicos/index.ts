import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MedicoRow {
  'Nome_Médico': string;
  'CRM': string;
  'CPF'?: string;
  'Status_Ativo_Médico'?: string;
  'Sócio?'?: string;
  'Função'?: string;
  'Especialidade de Atuação'?: string;
  'Equipe'?: string;
  'Acrescimo sem digitador'?: string | number;
  'Adicional de Valor sem utilizar digitador'?: string | number;
  'Nome_empresa'?: string;
  'CNPJ'?: string;
  'Telefone'?: string;
  'E-MAIL'?: string;
  'Optante pelo simples'?: string;
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
      throw new Error('Nenhum arquivo enviado');
    }

    console.log('📄 Processando arquivo:', file.name);

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData: MedicoRow[] = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📊 Total de registros no arquivo: ${jsonData.length}`);

    let processados = 0;
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const errosDetalhados: string[] = [];

    for (const row of jsonData) {
      try {
        processados++;

        if (!row['Nome_Médico'] || !row['CRM']) {
          errosDetalhados.push(`Linha ${processados}: Nome_Médico e CRM são obrigatórios`);
          erros++;
          continue;
        }

        // Mapear Status_Ativo_Médico para boolean
        const ativo = row['Status_Ativo_Médico']?.toString().toLowerCase();
        const isAtivo = ativo === 'sim' || ativo === 'ativo' || ativo === 'true' || ativo === '1';

        // Processar adicional de valor
        const adicionalValor = row['Adicional de Valor sem utilizar digitador'];
        const adicionalValorNum = typeof adicionalValor === 'number' 
          ? adicionalValor 
          : parseFloat(adicionalValor?.toString().replace(/[^\d.,]/g, '').replace(',', '.') || '0');

        const medicoData = {
          nome: row['Nome_Médico'].toString().trim(),
          crm: row['CRM'].toString().trim(),
          cpf: row['CPF']?.toString().trim() || null,
          email: row['E-MAIL']?.toString().trim() || null,
          telefone: row['Telefone']?.toString().trim() || null,
          socio: row['Sócio?']?.toString().trim() || null,
          funcao: row['Função']?.toString().trim() || null,
          especialidade: row['Especialidade de Atuação']?.toString().trim() || 'GERAL',
          especialidade_atuacao: row['Especialidade de Atuação']?.toString().trim() || null,
          equipe: row['Equipe']?.toString().trim() || null,
          acrescimo_sem_digitador: row['Acrescimo sem digitador']?.toString().trim() || null,
          adicional_valor_sem_digitador: adicionalValorNum || null,
          nome_empresa: row['Nome_empresa']?.toString().trim() || null,
          cnpj: row['CNPJ']?.toString().trim() || null,
          optante_simples: row['Optante pelo simples']?.toString().trim() || null,
          ativo: isAtivo,
          modalidades: [],
          especialidades: []
        };

        // Verificar se médico já existe pelo CRM
        const { data: existente } = await supabase
          .from('medicos')
          .select('id')
          .eq('crm', medicoData.crm)
          .maybeSingle();

        if (existente) {
          // Atualizar médico existente
          const { error: updateError } = await supabase
            .from('medicos')
            .update(medicoData)
            .eq('id', existente.id);

          if (updateError) {
            console.error('Erro ao atualizar médico:', updateError);
            errosDetalhados.push(`Linha ${processados}: ${updateError.message}`);
            erros++;
          } else {
            atualizados++;
          }
        } else {
          // Inserir novo médico
          const { error: insertError } = await supabase
            .from('medicos')
            .insert(medicoData);

          if (insertError) {
            console.error('Erro ao inserir médico:', insertError);
            errosDetalhados.push(`Linha ${processados}: ${insertError.message}`);
            erros++;
          } else {
            inseridos++;
          }
        }
      } catch (err: any) {
        console.error('Erro ao processar linha:', err);
        errosDetalhados.push(`Linha ${processados}: ${err.message}`);
        erros++;
      }
    }

    // Log do processamento
    const { error: logError } = await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file.name,
        tipo_arquivo: 'medicos',
        tipo_dados: 'cadastro',
        status: erros > 0 ? 'concluido_com_erros' : 'concluido',
        registros_processados: processados,
        registros_inseridos: inseridos,
        registros_atualizados: atualizados,
        registros_erro: erros,
        detalhes_erro: erros > 0 ? { erros: errosDetalhados } : null
      });

    if (logError) {
      console.error('Erro ao gravar log:', logError);
    }

    console.log('✅ Processamento concluído:', {
      processados,
      inseridos,
      atualizados,
      erros
    });

    return new Response(
      JSON.stringify({
        success: true,
        processados,
        inseridos,
        atualizados,
        erros,
        errosDetalhados: erros > 0 ? errosDetalhados : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('❌ Erro fatal:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
