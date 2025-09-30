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

// Helpers: normalização de cabeçalhos e parsing seguro
const normalize = (s: any): string => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const toKey = (s: string) => normalize(s).replace(/[^a-z0-9]+/g, '_');

const KEY_SYNONYMS: Record<string, string> = {
  // medico_nome
  medico_nome: 'medico_nome', medico: 'medico_nome', medicoa: 'medico_nome', nome_medico: 'medico_nome', nome_do_medico: 'medico_nome', dr: 'medico_nome', medico__nome: 'medico_nome',
  // medico_crm
  medico_crm: 'medico_crm', crm: 'medico_crm', crm_medico: 'medico_crm', crmm: 'medico_crm',
  // modalidade
  modalidade: 'modalidade', mod: 'modalidade', tipo: 'modalidade', modalidade_exame: 'modalidade',
  // especialidade
  especialidade: 'especialidade', esp: 'especialidade', especialidade_medica: 'especialidade',
  // categoria
  categoria: 'categoria', cat: 'categoria',
  // prioridade
  prioridade: 'prioridade', prio: 'prioridade',
  // valor
  valor: 'valor', preco: 'valor', preco_repasse: 'valor', preco_do_repasse: 'valor', preco_medico: 'valor', preco_med: 'valor', preco_: 'valor', preco_total: 'valor', preco__repasse: 'valor', preco_unitario: 'valor', preco_do_medico: 'valor', preco_exame: 'valor', preco__exame: 'valor', preco_repasses: 'valor', preco_repasse_medico: 'valor', preco_repasse__medico: 'valor', preco_bruto: 'valor', preco_liquido: 'valor', preco_final: 'valor', preco__final: 'valor', preco___final: 'valor', pre_o: 'valor', valores: 'valor', valor_repasse: 'valor', valor_do_repasse: 'valor', valor_medico: 'valor', valor_total: 'valor', valor__repasse: 'valor', valor__total: 'valor',
  // escopo
  esta_no_escopo: 'esta_no_escopo', escopo: 'esta_no_escopo', no_escopo: 'esta_no_escopo', esta_no_escopo_: 'esta_no_escopo',
  // cliente
  cliente_nome: 'cliente_nome', cliente: 'cliente_nome', nome_cliente: 'cliente_nome', cliente_nome_fantasia: 'cliente_nome', nome_fantasia: 'cliente_nome'
};

const parseDecimal = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  // Trata formatos: 1.234,56 ou 1234,56 ou 1234.56
  const only = s.replace(/[^0-9.,-]/g, '');
  const hasComma = only.includes(',');
  const normalized = hasComma ? only.replace(/\./g, '').replace(',', '.') : only;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const mapRowToCanonical = (row: Record<string, any>): RepasseRow => {
  const out: any = {};
  for (const [k, v] of Object.entries(row || {})) {
    const nk = KEY_SYNONYMS[toKey(k)];
    if (nk) out[nk] = v;
  }
  // Conversões finais
  if (out.valor !== undefined) {
    const n = parseDecimal(out.valor);
    if (n !== null) out.valor = n;
  }
  if (out.esta_no_escopo !== undefined) {
    const vv = String(out.esta_no_escopo).toLowerCase();
    out.esta_no_escopo = ['sim','yes','true','1','s','y'].includes(vv);
  }
  // Trim básicos
  ['medico_nome','medico_crm','modalidade','especialidade','categoria','prioridade','cliente_nome'].forEach(f => {
    if (out[f]) out[f] = String(out[f]).trim();
  });
  return out as RepasseRow;
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

      // OTIMIZAÇÃO: Carregar médicos e clientes UMA VEZ no início
      const { data: medicosCache } = await supabase
        .from('medicos')
        .select('id, nome, crm')
        .eq('ativo', true);
      
      const { data: clientesCache } = await supabase
        .from('clientes')
        .select('id, nome, nome_fantasia')
        .eq('ativo', true);

      // Criar maps para busca rápida em memória
      const medicoPorCRM = new Map(medicosCache?.map(m => [m.crm?.trim().toLowerCase(), m.id]) || []);
      const medicoPorNome = new Map(medicosCache?.map(m => [m.nome?.trim().toLowerCase(), m.id]) || []);
      const clientePorNomeFantasia = new Map(clientesCache?.map(c => [c.nome_fantasia?.trim().toLowerCase(), c.id]) || []);
      const clientePorNome = new Map(clientesCache?.map(c => [c.nome?.trim().toLowerCase(), c.id]) || []);

      // Preparar listas para batch insert/update
      const toUpsert: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const rawRow = rows[i] as Record<string, any>;
        const row = mapRowToCanonical(rawRow);
        const lineNum = i + 1;
        try {
          // Validações obrigatórias
          if (!row || !row.modalidade || !row.especialidade || !row.prioridade) {
            erros++;
            if (detalhesErros.length < 50) detalhesErros.push({ linha: lineNum, erro: 'Campos obrigatórios faltando (modalidade/especialidade/prioridade)' });
            processados++;
            continue;
          }

          const valorNum = parseDecimal((row as any).valor);
          if (valorNum === null) {
            erros++;
            if (detalhesErros.length < 50) detalhesErros.push({ linha: lineNum, erro: 'Valor inválido' });
            processados++;
            continue;
          }

          const esta_no_escopo = Boolean(row.esta_no_escopo);

          // Buscar médico em memória (muito mais rápido)
          let medico_id: string | null = null;
          if (row.medico_crm) {
            medico_id = medicoPorCRM.get(row.medico_crm.trim().toLowerCase()) || null;
          }
          if (!medico_id && row.medico_nome) {
            medico_id = medicoPorNome.get(row.medico_nome.trim().toLowerCase()) || null;
          }

          // Buscar cliente em memória
          let cliente_id: string | null = null;
          if (row.cliente_nome) {
            const term = row.cliente_nome.trim().toLowerCase();
            cliente_id = clientePorNomeFantasia.get(term) || clientePorNome.get(term) || null;
          }

          const repasseData = {
            medico_id: medico_id || null,
            modalidade: row.modalidade,
            especialidade: row.especialidade,
            categoria: row.categoria ?? null,
            prioridade: row.prioridade,
            valor: valorNum,
            esta_no_escopo,
            cliente_id: cliente_id || null
          };

          // Upsert direto: evitar consulta de duplicatas por linha
          toUpsert.push(repasseData);
          processados++;
        } catch (e: any) {
          erros++;
          if (detalhesErros.length < 50) detalhesErros.push({ linha: lineNum, erro: e?.message || 'Erro desconhecido' });
          processados++;
        }
      }

      // UPSERT em lotes (elimina consultas de duplicidade e conflitos)
      if (toUpsert.length > 0) {
        for (let i = 0; i < toUpsert.length; i += 1000) {
          const batch = toUpsert.slice(i, i + 1000);
          const { error: upsertError } = await supabase
            .from('medicos_valores_repasse')
            .upsert(batch, { onConflict: 'medico_id,modalidade,especialidade,prioridade' });
          if (upsertError) {
            console.error('Erro no upsert:', upsertError);
            erros += batch.length;
          } else {
            atualizados += batch.length;
          }
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