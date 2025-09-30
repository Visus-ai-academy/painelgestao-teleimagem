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

    const { action, fileName, totalRows, uploadId, rows } = await req.json();

    if (action === 'start') {
      const { data, error } = await supabase
        .from('processamento_uploads')
        .insert({
          arquivo_nome: fileName || 'repasse.json',
          tipo_arquivo: 'repasse_medico',
          status: 'processando',
          registros_processados: 0,
          registros_inseridos: 0,
          registros_atualizados: 0,
          registros_erro: 0,
          detalhes_erro: totalRows ? { total_linhas: totalRows } : null
        })
        .select()
        .single();

      if (error) throw error;
      console.log(`🚀 Upload de repasse iniciado: ${data.id} (${fileName}) total=${totalRows ?? 'N/A'}`);
      return new Response(JSON.stringify({ upload_id: data.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'chunk') {
      if (!uploadId || !Array.isArray(rows)) throw new Error('uploadId ou rows inválidos');

      let processados = 0, inseridos = 0, atualizados = 0, erros = 0;
      const detalhesErros: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as RepasseRow;
        const lineNum = i + 1;
        try {
          if (!row || !row.modalidade || !row.especialidade || !row.prioridade || row.valor === undefined || row.valor === null) {
            erros++;
            if (detalhesErros.length < 50) detalhesErros.push({ linha: lineNum, erro: 'Campos obrigatórios faltando' });
            processados++;
            continue;
          }

          // Normalizações
          const modalidade = String(row.modalidade).trim();
          const especialidade = String(row.especialidade).trim();
          const prioridade = String(row.prioridade).trim();
          const categoria = row.categoria ? String(row.categoria).trim() : null;
          const valorNum = Number(row.valor);

          let esta_no_escopo = false;
          if (row.esta_no_escopo) {
            const v = String(row.esta_no_escopo).toLowerCase();
            esta_no_escopo = ['sim','yes','true','1','s','y'].includes(v);
          }

          // Buscar médico/cliente sob demanda
          let medico_id: string | null = null;
          if (row.medico_crm) {
            const { data: m } = await supabase
              .from('medicos')
              .select('id')
              .eq('crm', row.medico_crm.trim())
              .eq('ativo', true)
              .maybeSingle();
            medico_id = m?.id ?? null;
          } else if (row.medico_nome) {
            const { data: m } = await supabase
              .from('medicos')
              .select('id')
              .ilike('nome', row.medico_nome.trim())
              .eq('ativo', true)
              .maybeSingle();
            medico_id = m?.id ?? null;
          }

          let cliente_id: string | null = null;
          if (row.cliente_nome) {
            const term = row.cliente_nome.trim();
            let { data: c } = await supabase
              .from('clientes')
              .select('id')
              .ilike('nome_fantasia', term)
              .eq('ativo', true)
              .maybeSingle();
            if (!c?.id) {
              const r2 = await supabase
                .from('clientes')
                .select('id')
                .ilike('nome', term)
                .eq('ativo', true)
                .maybeSingle();
              cliente_id = r2.data?.id ?? null;
            } else {
              cliente_id = c.id;
            }
          }

          const repasseData = {
            medico_id: medico_id || null,
            modalidade,
            especialidade,
            categoria,
            prioridade,
            valor: valorNum,
            esta_no_escopo,
            cliente_id: cliente_id || null
          } as const;

          // Deduplicação
          let query = supabase
            .from('medicos_valores_repasse')
            .select('id')
            .eq('modalidade', repasseData.modalidade)
            .eq('especialidade', repasseData.especialidade)
            .eq('prioridade', repasseData.prioridade);
          if (medico_id) query = query.eq('medico_id', medico_id); else query = query.is('medico_id', null);
          if (repasseData.categoria) query = query.eq('categoria', repasseData.categoria); else query = query.is('categoria', null);
          if (cliente_id) query = query.eq('cliente_id', cliente_id); else query = query.is('cliente_id', null);

          const { data: existente } = await query.maybeSingle();
          if (existente) {
            await supabase
              .from('medicos_valores_repasse')
              .update({ valor: repasseData.valor, esta_no_escopo })
              .eq('id', existente.id);
            atualizados++;
          } else {
            await supabase
              .from('medicos_valores_repasse')
              .insert(repasseData);
            inseridos++;
          }
          processados++;
        } catch (e: any) {
          erros++;
          if (detalhesErros.length < 50) detalhesErros.push({ linha: lineNum, erro: e?.message || 'Erro desconhecido' });
          processados++;
        }
      }

      // Buscar contadores atuais e somar
      const { data: upload } = await supabase
        .from('processamento_uploads')
        .select('registros_processados, registros_inseridos, registros_atualizados, registros_erro, detalhes_erro')
        .eq('id', uploadId)
        .maybeSingle();

      const atual = upload || { registros_processados: 0, registros_inseridos: 0, registros_atualizados: 0, registros_erro: 0, detalhes_erro: null };

      const novoDetalhe = (() => {
        const base = (atual.detalhes_erro as any) || {};
        const errosExistentes = Array.isArray(base.erros) ? base.erros : [];
        const combinados = [...errosExistentes, ...detalhesErros].slice(0, 50);
        return { ...base, erros: combinados };
      })();

      await supabase
        .from('processamento_uploads')
        .update({
          registros_processados: (atual.registros_processados || 0) + processados,
          registros_inseridos: (atual.registros_inseridos || 0) + inseridos,
          registros_atualizados: (atual.registros_atualizados || 0) + atualizados,
          registros_erro: (atual.registros_erro || 0) + erros,
          detalhes_erro: novoDetalhe
        })
        .eq('id', uploadId);

      console.log(`📈 Chunk aplicado: +${processados} (ins ${inseridos}, upd ${atualizados}, err ${erros})`);
      return new Response(JSON.stringify({ ok: true, delta: { processados, inseridos, atualizados, erros } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'finish') {
      if (!uploadId) throw new Error('uploadId inválido');

      // Status final baseado nos contadores atuais
      const { data: upload } = await supabase
        .from('processamento_uploads')
        .select('registros_inseridos, registros_atualizados, registros_erro, detalhes_erro')
        .eq('id', uploadId)
        .maybeSingle();

      const temSucesso = (upload?.registros_inseridos || 0) + (upload?.registros_atualizados || 0) > 0;
      await supabase
        .from('processamento_uploads')
        .update({ status: temSucesso ? 'concluido' : 'erro' })
        .eq('id', uploadId);

      console.log(`✅ Upload concluído: ${uploadId} status=${temSucesso ? 'concluido' : 'erro'}`);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error('Ação inválida');
  } catch (error: any) {
    console.error('❌ Erro importar-repasse-medico:', error?.message);
    return new Response(JSON.stringify({ error: error?.message || 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});