import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    // Normalizar cabeçalhos para evitar erros com acentos/variações
    const normalize = (s: string) => s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remover acentos
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    const normalizeRow = (r: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(r)) {
        out[normalize(k)] = r[k as keyof typeof r];
      }
      return out;
    };

    const dataNormalized = jsonData.map(normalizeRow);

    console.log(`📊 Total de registros no arquivo: ${dataNormalized.length}`);

    let processados = 0;
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const errosDetalhados: string[] = [];

    for (const rowRaw of dataNormalized) {
      try {
        processados++;

        const row = rowRaw as Record<string, unknown>;
        const nomeMed = (row['nome_medico'] as string | undefined) ?? (row['nome'] as string | undefined) ?? (row['nomemedico'] as string | undefined);
        const crmVal = (row['crm'] as string | undefined) ?? (row['c_r_m'] as string | undefined);

        if (!nomeMed) {
          errosDetalhados.push(`Linha ${processados}: Nome_Médico é obrigatório`);
          erros++;
          continue;
        }

        // Mapear Status_Ativo_Médico para boolean (aceita diversas variações)
        const ativoStr = ((row['status_ativo_medico'] as string | undefined) ?? (row['ativo'] as string | undefined) ?? '').toString().toLowerCase();
        const isAtivo = ['sim','ativo','true','1','s','y','yes'].includes(ativoStr);

        // Processar adicional de valor
        const adicionalValorRaw = (row['adicional_de_valor_sem_utilizar_digitador'] ?? row['adicional_valor_sem_digitador'] ?? row['adicional'] ?? 0) as unknown;
        const adicionalValorNum = typeof adicionalValorRaw === 'number'
          ? adicionalValorRaw
          : parseFloat(adicionalValorRaw?.toString().replace(/[^\d.,]/g, '').replace(',', '.') || '0');

        const medicoData = {
          nome: nomeMed.toString().trim(),
          crm: crmVal?.toString().trim() || null,
          cpf: (row['cpf'] as string | undefined)?.toString().trim() || null,
          email: (row['e_mail'] as string | undefined)?.toString().trim() || null,
          telefone: (row['telefone'] as string | undefined)?.toString().trim() || null,
          socio: (row['socio'] as string | undefined)?.toString().trim() || null,
          funcao: (row['funcao'] as string | undefined)?.toString().trim() || null,
          especialidade: ((row['especialidade_de_atuacao'] as string | undefined)?.toString().trim()) || 'GERAL',
          especialidade_atuacao: (row['especialidade_de_atuacao'] as string | undefined)?.toString().trim() || null,
          equipe: (row['equipe'] as string | undefined)?.toString().trim() || null,
          acrescimo_sem_digitador: (row['acrescimo_sem_digitador'] as string | undefined)?.toString().trim() || null,
          adicional_valor_sem_digitador: adicionalValorNum || null,
          nome_empresa: (row['nome_empresa'] as string | undefined)?.toString().trim() || null,
          cnpj: (row['cnpj'] as string | undefined)?.toString().trim() || null,
          optante_simples: (row['optante_pelo_simples'] as string | undefined)?.toString().trim() || null,
          ativo: isAtivo,
          modalidades: [],
          especialidades: []
        };

        // Verificar se médico já existe pelo CRM (se fornecido) ou nome
        let query = supabase.from('medicos').select('id');
        
        if (medicoData.crm) {
          query = query.eq('crm', medicoData.crm);
        } else {
          query = query.eq('nome', medicoData.nome);
        }
        
        const { data: existente } = await query.maybeSingle();

        if (existente) {
          // Atualizar médico existente
          const { error: updateError } = await supabase
            .from('medicos')
            .update(medicoData)
            .eq('id', (existente as any).id);

          if (updateError) {
            console.error('Erro ao atualizar médico:', {
              crm: medicoData.crm,
              nome: medicoData.nome,
              erro: updateError
            });
            errosDetalhados.push(`Linha ${processados} (${medicoData.nome}): ${updateError.message}`);
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
            console.error('Erro ao inserir médico:', {
              crm: medicoData.crm,
              nome: medicoData.nome,
              dados: medicoData,
              erro: insertError
            });
            errosDetalhados.push(`Linha ${processados} (${medicoData.nome}): ${insertError.message} - Detalhes: ${insertError.details || 'N/A'}`);
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
        status: 'concluido',
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
