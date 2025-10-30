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

    // Criar registro de upload inicial (sem tipo_dados para evitar constraint)
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

    // Ler Excel com baixo uso de memória e processar em CHUNKS
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellDates: false,
      cellStyles: false,
      sheetStubs: false,
      dense: false
    });

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const ref = (worksheet as any)['!ref'] as string | undefined;
    if (!ref) {
      throw new Error('Planilha vazia ou inválida');
    }

    const fullRange = XLSX.utils.decode_range(ref);
    const headerRowIndex = fullRange.s.r; // Geralmente 0

    // Ler cabeçalho uma única vez
    const headerRow = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      range: { s: { r: headerRowIndex, c: fullRange.s.c }, e: { r: headerRowIndex, c: fullRange.e.c } }
    })[0] as string[] | undefined;

    const headers = Array.isArray(headerRow) ? headerRow : [];

    // Total de linhas de dados (exclui cabeçalho)
    const totalLinhas = Math.max(0, fullRange.e.r - headerRowIndex);
    console.log(`Total estimado: ${totalLinhas} registros`);

    // Atualizar com total de linhas
    await supabase
      .from('processamento_uploads')
      .update({ detalhes_erro: { total_linhas: totalLinhas } })
      .eq('id', uploadId);

    let processados = 0;
    let inseridos = 0;
    let atualizados = 0;
    let erros = 0;
    let ignorados = 0;
    const detalhesErros: any[] = [];

    // Configurações de processamento
    const ROWS_PER_CHUNK = 100; // Linhas lidas da planilha por vez
    const BATCH_SIZE = 3;       // Registros processados (DB) por vez

    // Funções de normalização de nomes (suporte a abreviações)
    const normalizar = (s: string | null): string => {
      if (!s) return '';
      return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\bdr\.?\s*/gi, '')
        .replace(/\bdra\.?\s*/gi, '');
    };

    // Nomes a serem ignorados (não são médicos)
    const nomesIgnorados = [
      'teste medico',
      'ana caroline blanco carreiro',
      'juliano manzoli marques luiz'
    ];

    const extrairTokens = (nome: string): string[] => {
      return normalizar(nome)
        .split(/\s+/)
        .filter(t => t.length > 0);
    };

    const ehInicial = (token: string): boolean => {
      return token.length === 1 || (token.length === 2 && token.endsWith('.'));
    };

    const letraInicial = (token: string): string => {
      return token.charAt(0);
    };

    const matchComAbreviacoes = (nome1: string, nome2: string): boolean => {
      const tokens1 = extrairTokens(nome1);
      const tokens2 = extrairTokens(nome2);
      
      if (tokens1.length === 0 || tokens2.length === 0) return false;
      if (tokens1.join(' ') === tokens2.join(' ')) return true;
      
      const verificarMatch = (tokensA: string[], tokensB: string[]): boolean => {
        let matchCount = 0;
        const usedIndices = new Set<number>();
        
        for (const tokenA of tokensA) {
          let encontrou = false;
          
          for (let i = 0; i < tokensB.length; i++) {
            if (usedIndices.has(i)) continue;
            
            const tokenB = tokensB[i];
            
            if (tokenA === tokenB) {
              matchCount++;
              usedIndices.add(i);
              encontrou = true;
              break;
            }
            
            if (ehInicial(tokenA) && tokenB.startsWith(letraInicial(tokenA))) {
              matchCount++;
              usedIndices.add(i);
              encontrou = true;
              break;
            }
            
            if (ehInicial(tokenB) && tokenA.startsWith(letraInicial(tokenB))) {
              matchCount++;
              usedIndices.add(i);
              encontrou = true;
              break;
            }
          }
          
          if (!encontrou) return false;
        }
        
        return matchCount >= Math.min(tokensA.length, tokensB.length) * 0.7;
      };
      
      return verificarMatch(tokens1, tokens2) || verificarMatch(tokens2, tokens1);
    };

    // Cache de médicos cadastrados (carregado uma vez)
    let medicosCadastrados: Array<{ id: string; nome: string; crm: string | null; nome_normalizado: string }> | null = null;

    const carregarMedicos = async () => {
      if (medicosCadastrados) return medicosCadastrados;
      
      const { data } = await supabase
        .from('medicos')
        .select('id, nome, crm')
        .eq('ativo', true);
      
      medicosCadastrados = (data || []).map(m => ({
        ...m,
        nome_normalizado: normalizar(m.nome)
      }));
      
      return medicosCadastrados;
    };

    // Funções auxiliares de busca "sob demanda"
    const buscarMedicoId = async (row: RepasseRow): Promise<{ id: string | null; ignorado: boolean }> => {
      try {
        // Ignorar nomes da lista de exclusão
        if (row.medico_nome) {
          const nomeNormalizado = normalizar(row.medico_nome);
          if (nomesIgnorados.includes(nomeNormalizado)) {
            return { id: null, ignorado: true };
          }
        }
        
        const medicos = await carregarMedicos();
        
        // 1. Busca por CRM (prioritária e exata)
        if (row.medico_crm) {
          const crm = row.medico_crm.trim();
          const medicoComCRM = medicos.find(m => m.crm === crm);
          if (medicoComCRM) return { id: medicoComCRM.id, ignorado: false };
        }
        
        // 2. Busca por nome com normalização e suporte a abreviações
        if (row.medico_nome) {
          const nomeOriginal = row.medico_nome.trim();
          const nomeNormalizado = normalizar(nomeOriginal);
          
          // 2.1. Match exato normalizado
          const matchExato = medicos.find(m => m.nome_normalizado === nomeNormalizado);
          if (matchExato) return { id: matchExato.id, ignorado: false };
          
          // 2.2. Match com abreviações
          const matchAbreviacao = medicos.find(m => matchComAbreviacoes(nomeOriginal, m.nome));
          if (matchAbreviacao) return { id: matchAbreviacao.id, ignorado: false };
        }
      } catch (error) {
        console.error('Erro ao buscar médico:', error);
      }
      return { id: null, ignorado: false };
    };

    const buscarClienteId = async (row: RepasseRow): Promise<string | null> => {
      try {
        if (row.cliente_nome) {
          const term = row.cliente_nome.trim();
          // Tente primeiro por nome_fantasia
          let { data } = await supabase
            .from('clientes')
            .select('id')
            .ilike('nome_fantasia', term)
            .eq('ativo', true)
            .maybeSingle();
          if (data?.id) return data.id;

          // Tente pelo nome
          const resp2 = await supabase
            .from('clientes')
            .select('id')
            .ilike('nome', term)
            .eq('ativo', true)
            .maybeSingle();
          return resp2.data?.id ?? null;
        }
      } catch (_) {}
      return null;
    };

    // Iterar por CHUNKS de linhas da planilha (evita materializar tudo em memória)
    for (let start = headerRowIndex + 1; start <= fullRange.e.r; start += ROWS_PER_CHUNK) {
      const end = Math.min(start + ROWS_PER_CHUNK - 1, fullRange.e.r);

      const rows = XLSX.utils.sheet_to_json(worksheet, {
        raw: true,
        blankrows: false,
        header: headers.length > 0 ? headers : undefined,
        range: { s: { r: start, c: fullRange.s.c }, e: { r: end, c: fullRange.e.c } }
      }) as RepasseRow[];

      // Processar a cada BATCH_SIZE registros para reduzir picos de memória
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const lineNum = start + i; // linha real considerando cabeçalho

        try {
          if (!row || !row.modalidade || !row.especialidade || !row.prioridade || !row.valor) {
            erros++;
            if (detalhesErros.length < 50) detalhesErros.push({ linha: lineNum, erro: 'Campos obrigatórios faltando' });
            processados++;
          } else {
            // Normalizações leves
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

            const medicoResult = await buscarMedicoId(row);
            
            // Se foi ignorado (nome na lista de exclusão), pular este registro
            if (medicoResult.ignorado) {
              ignorados++;
              processados++;
              continue;
            }
            
            const medico_id = medicoResult.id;
            const cliente_id = await buscarClienteId(row);

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

            // Verificar duplicata
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
          }
        } catch (error: any) {
          erros++;
          if (detalhesErros.length < 50) detalhesErros.push({ linha: lineNum, erro: error?.message || 'Erro desconhecido' });
          processados++;
        }

        // A cada BATCH_SIZE, persistir progresso
        if ((i + 1) % BATCH_SIZE === 0) {
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
      }

      // Atualizar ao final do chunk
      console.log(`Progresso: ${Math.min(processados, totalLinhas)}/${totalLinhas}`);
      await supabase
        .from('processamento_uploads')
        .update({
          registros_processados: processados,
          registros_inseridos: inseridos,
          registros_atualizados: atualizados,
          registros_erro: erros
        })
        .eq('id', uploadId);

      // Pausa curta para GC
      await new Promise((r) => setTimeout(r, 10));
    }

    // Atualizar registro final
    const detalhesFinais = {
      erros: detalhesErros,
      total_linhas: totalLinhas,
      ignorados,
      resumo: `${inseridos} inseridos + ${atualizados} atualizados + ${erros} erros + ${ignorados} ignorados = ${inseridos + atualizados + erros + ignorados} de ${totalLinhas}`
    };
    
    await supabase
      .from('processamento_uploads')
      .update({
        status: erros > 0 && inseridos === 0 && atualizados === 0 ? 'erro' : 'concluido',
        registros_processados: processados,
        registros_inseridos: inseridos,
        registros_atualizados: atualizados,
        registros_erro: erros,
        registros_ignorados: ignorados,
        detalhes_erro: detalhesFinais
      })
      .eq('id', uploadId);

    const resultado = {
      sucesso: true,
      upload_id: uploadId,
      arquivo: file.name,
      total_arquivo: totalLinhas,
      processados,
      inseridos,
      atualizados,
      erros,
      ignorados,
      detalhes_erros: detalhesErros.slice(0, 10)
    };

    console.log(`✅ Concluído: ${inseridos} inseridos, ${atualizados} atualizados, ${erros} erros, ${ignorados} ignorados (total arquivo: ${totalLinhas})`);

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