import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MedicoRow {
  nome: string;
  crm: string;
  email?: string;
  telefone?: string;
  categoria?: string;
  modalidades?: string;
  especialidades?: string;
  ativo?: string;
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

        if (!row.nome || !row.crm) {
          errosDetalhados.push(`Linha ${processados}: Nome e CRM são obrigatórios`);
          erros++;
          continue;
        }

        // Parse modalidades e especialidades (podem vir como string separada por vírgula ou ponto-e-vírgula)
        const modalidades = row.modalidades 
          ? row.modalidades.split(/[,;]/).map(m => m.trim()).filter(Boolean)
          : [];
        
        const especialidades = row.especialidades
          ? row.especialidades.split(/[,;]/).map(e => e.trim()).filter(Boolean)
          : [];

        const medicoData = {
          nome: row.nome.trim(),
          crm: row.crm.trim(),
          email: row.email?.trim() || null,
          telefone: row.telefone?.trim() || null,
          categoria: row.categoria?.trim() || null,
          modalidades,
          especialidades,
          ativo: row.ativo?.toLowerCase() !== 'false' && row.ativo?.toLowerCase() !== 'não'
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
        arquivo_fonte: file.name,
        tipo_processamento: 'medicos',
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
