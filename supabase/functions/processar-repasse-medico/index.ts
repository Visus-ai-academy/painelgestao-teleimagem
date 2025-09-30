import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RepasseRow {
  medico_nome?: string;
  medico_crm?: string;
  modalidade: string;
  especialidade: string;
  categoria?: string;
  prioridade: string;
  valor: number;
  esta_no_escopo?: boolean | string;
  cliente_nome?: string;
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

    console.log(`📊 Processando arquivo: ${file.name}`);

    // Ler como texto para processar linha por linha (evita memória do XLSX)
    const text = await file.text();
    const lines = text.split('\n');
    
    if (lines.length < 2) {
      throw new Error('Arquivo vazio ou sem dados');
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log(`Headers: ${headers.join(', ')}`);

    let processados = 0;
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const detalhesErros: any[] = [];

    // Buscar médicos e clientes UMA VEZ
    const { data: medicos } = await supabase
      .from('medicos')
      .select('id, nome, crm')
      .eq('ativo', true);

    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, nome, nome_fantasia')
      .eq('ativo', true);

    const medicoMapNome = new Map(medicos?.map(m => [m.nome.toLowerCase(), m.id]) || []);
    const medicoMapCrm = new Map(medicos?.map(m => [m.crm?.toLowerCase(), m.id]) || []);
    const clienteMap = new Map(clientes?.map(c => [c.nome_fantasia?.toLowerCase() || c.nome.toLowerCase(), c.id]) || []);

    // Processar linha por linha (MUITO mais eficiente em memória)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      processados++;

      try {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || null;
        });

        // Validação
        if (!row.modalidade || !row.especialidade || !row.prioridade || !row.valor) {
          throw new Error('Campos obrigatórios faltando');
        }

        // Buscar médico
        let medico_id = null;
        if (row.medico_crm) {
          medico_id = medicoMapCrm.get(row.medico_crm.toLowerCase());
        } else if (row.medico_nome) {
          medico_id = medicoMapNome.get(row.medico_nome.toLowerCase());
        }

        // Buscar cliente
        let cliente_id = null;
        if (row.cliente_nome) {
          cliente_id = clienteMap.get(row.cliente_nome.toLowerCase());
        }

        // Escopo
        let esta_no_escopo = false;
        if (row.esta_no_escopo) {
          const valor = String(row.esta_no_escopo).toLowerCase();
          esta_no_escopo = ['sim', 'yes', 'true', '1', 's', 'y'].includes(valor);
        }

        const repasseData = {
          medico_id: medico_id || null,
          modalidade: row.modalidade,
          especialidade: row.especialidade,
          categoria: row.categoria || null,
          prioridade: row.prioridade,
          valor: parseFloat(row.valor),
          esta_no_escopo,
          cliente_id: cliente_id || null
        };

        // Verificar duplicata
        let query = supabase
          .from('medicos_valores_repasse')
          .select('id')
          .eq('modalidade', repasseData.modalidade)
          .eq('especialidade', repasseData.especialidade)
          .eq('prioridade', repasseData.prioridade);

        if (medico_id) query = query.eq('medico_id', medico_id);
        else query = query.is('medico_id', null);

        if (repasseData.categoria) query = query.eq('categoria', repasseData.categoria);
        else query = query.is('categoria', null);

        if (cliente_id) query = query.eq('cliente_id', cliente_id);
        else query = query.is('cliente_id', null);

        const { data: existente } = await query.maybeSingle();

        if (existente) {
          await supabase
            .from('medicos_valores_repasse')
            .update({ valor: repasseData.valor, esta_no_escopo: repasseData.esta_no_escopo })
            .eq('id', existente.id);
          atualizados++;
        } else {
          await supabase
            .from('medicos_valores_repasse')
            .insert(repasseData);
          inseridos++;
        }

        if (processados % 20 === 0) {
          console.log(`Processadas ${processados} linhas...`);
        }

      } catch (error: any) {
        erros++;
        detalhesErros.push({
          linha: i + 1,
          erro: error.message
        });
      }
    }

    // Log
    await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file.name,
        tipo_arquivo: 'repasse_medico',
        tipo_dados: 'configuracao',
        status: erros === processados ? 'erro' : 'concluido',
        registros_processados: processados,
        registros_inseridos: inseridos,
        registros_atualizados: atualizados,
        registros_erro: erros,
        detalhes_erro: detalhesErros.length > 0 ? detalhesErros : null,
        tamanho_arquivo: file.size
      });

    const resultado = {
      sucesso: true,
      arquivo: file.name,
      processados,
      inseridos,
      atualizados,
      erros,
      detalhes_erros: detalhesErros.slice(0, 10)
    };

    console.log('✅ Concluído:', resultado);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});