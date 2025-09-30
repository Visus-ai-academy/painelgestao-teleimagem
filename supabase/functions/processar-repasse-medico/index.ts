import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import * as XLSX from "https://deno.land/x/sheetjs@v0.18.3/xlsx.mjs";

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

    console.log(`📊 Processando ${file.name} (${Math.round(file.size/1024)}KB)`);

    // Criar registro de upload inicial
    const { data: uploadRecord, error: uploadError } = await supabase
      .from('processamento_uploads')
      .insert({
        arquivo_nome: file.name,
        tipo_arquivo: 'repasse_medico',
        
        status: 'processando',
        registros_processados: 0,
        registros_inseridos: 0,
        registros_atualizados: 0,
        registros_erro: 0,
        tamanho_arquivo: file.size
      })
      .select()
      .single();

    if (uploadError) throw uploadError;
    const uploadId = uploadRecord.id;

    // Ler Excel com opções mínimas de memória
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellDates: true,
      cellStyles: false,
      sheetStubs: false,
      dense: true // Usa array denso (menos memória)
    });
    
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: null,
      blankrows: false
    }) as RepasseRow[];

    const totalLinhas = jsonData.length;
    console.log(`Total: ${totalLinhas} registros`);

    // Atualizar com total de linhas
    await supabase
      .from('processamento_uploads')
      .update({ detalhes_erro: { total_linhas: totalLinhas } })
      .eq('id', uploadId);

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

    let processados = 0;
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    const detalhesErros: any[] = [];

    // Processar em lotes MUITO pequenos (10 registros)
    const BATCH_SIZE = 10;
    
    for (let batchStart = 0; batchStart < totalLinhas; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalLinhas);
      const batch = jsonData.slice(batchStart, batchEnd);
      
      const batchPromises = batch.map(async (row, idx) => {
        const lineNum = batchStart + idx + 1;
        
        try {
          if (!row.modalidade || !row.especialidade || !row.prioridade || !row.valor) {
            throw new Error('Campos obrigatórios faltando');
          }

          // Buscar médico
          let medico_id = null;
          if (row.medico_crm) {
            medico_id = medicoMapCrm.get(row.medico_crm.toLowerCase().trim());
          } else if (row.medico_nome) {
            medico_id = medicoMapNome.get(row.medico_nome.toLowerCase().trim());
          }

          // Buscar cliente
          let cliente_id = null;
          if (row.cliente_nome) {
            cliente_id = clienteMap.get(row.cliente_nome.toLowerCase().trim());
          }

          // Escopo
          let esta_no_escopo = false;
          if (row.esta_no_escopo) {
            const valor = String(row.esta_no_escopo).toLowerCase();
            esta_no_escopo = ['sim', 'yes', 'true', '1', 's', 'y'].includes(valor);
          }

          const repasseData = {
            medico_id: medico_id || null,
            modalidade: row.modalidade.trim(),
            especialidade: row.especialidade.trim(),
            categoria: row.categoria?.trim() || null,
            prioridade: row.prioridade.trim(),
            valor: Number(row.valor),
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
              .update({ valor: repasseData.valor, esta_no_escopo })
              .eq('id', existente.id);
            return { tipo: 'atualizado', linha: lineNum };
          } else {
            await supabase
              .from('medicos_valores_repasse')
              .insert(repasseData);
            return { tipo: 'inserido', linha: lineNum };
          }
        } catch (error: any) {
          return { tipo: 'erro', linha: lineNum, erro: error.message };
        }
      });

      // Processar batch
      const resultados = await Promise.all(batchPromises);
      
      resultados.forEach(r => {
        processados++;
        if (r.tipo === 'inserido') inseridos++;
        else if (r.tipo === 'atualizado') atualizados++;
        else if (r.tipo === 'erro') {
          erros++;
          if (detalhesErros.length < 50) { // Limitar memória de erros
            detalhesErros.push({ linha: r.linha, erro: r.erro });
          }
        }
      });

      // Log progresso a cada 100 registros
      if (batchEnd % 100 === 0 || batchEnd === totalLinhas) {
        console.log(`Processados ${batchEnd}/${totalLinhas} (${Math.round(batchEnd/totalLinhas*100)}%)`);
        
        // Atualizar progresso no banco
        await supabase
          .from('processamento_uploads')
          .update({
            registros_processados: processados,
            registros_inseridos: inseridos,
            registros_atualizados: atualizados,
            registros_erro: erros
          })
          .eq('id', uploadId);
      }

      // Pequena pausa para GC
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    // Atualizar registro final
    await supabase
      .from('processamento_uploads')
      .update({
        status: erros > 0 && inseridos === 0 && atualizados === 0 ? 'erro' : 'concluido',
        registros_processados: processados,
        registros_inseridos: inseridos,
        registros_atualizados: atualizados,
        registros_erro: erros,
        detalhes_erro: detalhesErros.length > 0 ? { erros: detalhesErros, total_linhas: totalLinhas } : { total_linhas: totalLinhas }
      })
      .eq('id', uploadId);

    const resultado = {
      sucesso: true,
      upload_id: uploadId,
      arquivo: file.name,
      processados,
      inseridos,
      atualizados,
      erros,
      detalhes_erros: detalhesErros.slice(0, 10)
    };

    console.log(`✅ Concluído: ${inseridos} inseridos, ${atualizados} atualizados, ${erros} erros`);

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('❌ Erro:', error.message);
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