import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useVolumetria } from "@/contexts/VolumetriaContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import type { UploadedExamRow } from "@/components/volumetria/VolumetriaExamesComparison";

// Tipos para linhas
interface VolumetriaRow {
  EMPRESA?: string;
  NOME_PACIENTE?: string;
  CODIGO_PACIENTE?: string | number;
  ESTUDO_DESCRICAO?: string;
  ACCESSION_NUMBER?: string;
  MODALIDADE?: string;
  PRIORIDADE?: string;
  VALORES?: number;
  ESPECIALIDADE?: string;
  MEDICO?: string;
  DUPLICADO?: string | boolean;
  DATA_REALIZACAO?: string;
  HORA_REALIZACAO?: string;
  DATA_TRANSFERENCIA?: string;
  HORA_TRANSFERENCIA?: string;
  DATA_LAUDO?: string;
  HORA_LAUDO?: string;
  DATA_PRAZO?: string;
  HORA_PRAZO?: string;
  STATUS?: string;
  UNIDADE_ORIGEM?: string;
}

type DivergenciaTipo = 'arquivo_nao_no_sistema' | 'sistema_nao_no_arquivo' | 'quantidade_diferente' | 'categoria_diferente';

interface LinhaDivergencia {
  tipo: DivergenciaTipo;
  chave: string;
  // Colunas pedidas (preenchidas do lado disponível)
  EMPRESA: string;
  NOME_PACIENTE: string;
  CODIGO_PACIENTE: string;
  ESTUDO_DESCRICAO: string;
  ACCESSION_NUMBER: string;
  MODALIDADE: string;
  PRIORIDADE: string;
  VALORES: number | string;
  ESPECIALIDADE: string;
  MEDICO: string;
  DUPLICADO: string;
  DATA_REALIZACAO: string;
  HORA_REALIZACAO: string;
  DATA_TRANSFERENCIA: string;
  HORA_TRANSFERENCIA: string;
  DATA_LAUDO: string;
  HORA_LAUDO: string;
  DATA_PRAZO: string;
  HORA_PRAZO: string;
  STATUS: string;
  UNIDADE_ORIGEM: string;
  CLIENTE: string;
  // extras
  total_arquivo?: number;
  total_sistema?: number;
  categoria_arquivo?: string;
  categoria_sistema?: string;
}

function canonical(val?: string) {
  const s = (val || '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  return s;
}
function normalizeModalidade(m?: string) {
  const u = canonical(m);
  if (u === 'CT') return 'TC';
  if (u === 'MR') return 'RM';
  return u;
}
function normalizeCliente(name?: string) {
  let s = canonical(name);
  if (["INTERCOR2","INTERCOR 2"].includes(s)) s = 'INTERCOR';
  if (s === 'P HADVENTISTA') s = 'HADVENTISTA';
  if (s === 'P UNIMED CARUARU') s = 'UNIMED CARUARU';
  if (s === 'PRN MEDIMAGEM CAMBORIU') s = 'MEDIMAGEM CAMBORIU';
  if (s === 'UNIMAGEM CENTRO') s = 'UNIMAGEM ATIBAIA';
  if (["CEDI RJ","CEDI RO","CEDI UNIMED"].includes(s)) s = 'CEDIDIAG';
  s = s.replace(/ - TELE$/, '').replace(/ - CT$/, '').replace(/ - MR$/, '').replace(/_PLANT(AO|AO)$/,'').replace(/_RMX$/, '');
  return s;
}

function cleanExamName(name?: string) {
  const raw = (name || '').toString();
  return raw.replace(/\s+X[1-9]\b/gi, '').replace(/\s+XE\b/gi, '').replace(/\s+/g, ' ').trim();
}

function formatDateBR(val?: string) {
  if (!val) return '-';
  const s = String(val).trim();
  if (!s) return '-';
  // ISO or yyyy-mm-dd
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  // dd/mm/yyyy keep
  const br = s.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{2,4})$/);
  if (br) return `${br[1].padStart(2,'0')}/${br[2].padStart(2,'0')}/${br[3].length===2?`20${br[3]}`:br[3]}`;
  // try Date parse fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yy = String(d.getFullYear());
    return `${dd}/${mm}/${yy}`;
  }
  return s;
}

function toYMD(val?: any) {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (!s) return '';
  // ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // dd/mm/yyyy or dd-mm-yyyy
  const br = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (br) return `${br[3].length===2?`20${br[3]}`:br[3]}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}`;
  // Excel serial number (approx range)
  const num = Number(s);
  if (!isNaN(num) && num > 25000 && num < 60000) {
    const base = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(base.getTime() + Math.round(num) * 86400000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2,'0');
    const day = String(d.getUTCDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  return '';
}

export default function VolumetriaDivergencias({ uploadedExams }: { uploadedExams?: UploadedExamRow[] }) {
  const { data: ctx } = useVolumetria();
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  // Filtros básicos
  const [referencia, setReferencia] = useState<string>('2025-06');
  const [cliente, setCliente] = useState<string>('todos');

  useEffect(() => {
    // Carregar mapa de clientes (id -> nome)
    (async () => {
      const { data } = await supabase.from('clientes').select('id,nome').eq('ativo', true);
      const map: Record<string, string> = {};
      (data || []).forEach((c) => { map[c.id] = c.nome; });
      setClientesMap(map);
    })();
  }, []);

  // Carregar período mais recente disponível na inicialização
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('volumetria_mobilemed')
          .select('periodo_referencia')
          .not('periodo_referencia', 'is', null)
          .order('periodo_referencia', { ascending: false })
          .limit(1);
        
        if (data && data.length > 0) {
          const ultimoPeriodo = data[0].periodo_referencia as string;
          console.log('🔍 Último período encontrado:', ultimoPeriodo);
          
          // Converter de formato "jun/25" para "2025-06"
          if (ultimoPeriodo && ultimoPeriodo.includes('/')) {
            const [mes, ano] = ultimoPeriodo.split('/');
            const mesesMap: Record<string, string> = {
              'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
              'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12'
            };
            const mesNum = mesesMap[mes];
            if (mesNum && ano) {
              const anoCompleto = ano.length === 2 ? `20${ano}` : ano;
              const refFormatada = `${anoCompleto}-${mesNum}`;
              console.log('🔄 Convertendo período:', ultimoPeriodo, '->', refFormatada);
              setReferencia(refFormatada);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar último período:', error);
        // Manter valor padrão em caso de erro
      }
    })();
  }, []);

  const clienteOptions = useMemo(() => ctx.clientes || [], [ctx.clientes]);

  const gerarExcelDivergencias = async () => {
    console.log('🚀 INÍCIO DO PROCESSO DE DIVERGÊNCIAS');
    try {
      setExporting(true);
      
      // CORREÇÃO: O período no banco está no formato "2025-06", não "jun/25"
      // Usar diretamente o formato selecionado
      const periodoReferenciaBanco = referencia; // Já está no formato correto "2025-06"
      
      console.log('🔍 Processando divergências para período:', {
        referenciaSelecionada: referencia,
        periodoReferenciaBanco,
        cliente: cliente !== 'todos' ? cliente : 'todos'
      });
      
      // TESTE DIRETO: Buscar um paciente específico no banco
      console.log('🔍 TESTE DIRETO: Buscando Vilma Borges no banco...');
      const testeVilma = await supabase
        .from('volumetria_mobilemed')
        .select('*')
        .ilike('NOME_PACIENTE', '%VILMA BORGES%')
        .limit(5);
      
      console.log('🔍 RESULTADO TESTE VILMA:', {
        erro: testeVilma.error,
        encontrados: testeVilma.data?.length || 0,
        dados: testeVilma.data
      });
      
      // 1) Ler dados do SISTEMA (volumetria processada no banco) por período/cliente
      let sysQuery = supabase.from('volumetria_mobilemed').select(`
        "EMPRESA", "MODALIDADE", "ESPECIALIDADE", "ESTUDO_DESCRICAO", 
        "NOME_PACIENTE", "DATA_REALIZACAO", "DATA_LAUDO", "VALORES",
        "PRIORIDADE", "MEDICO", "DUPLICADO", "CODIGO_PACIENTE",
        "ACCESSION_NUMBER", "HORA_REALIZACAO", "DATA_TRANSFERENCIA",
        "HORA_TRANSFERENCIA", "HORA_LAUDO", "DATA_PRAZO", "HORA_PRAZO",
        "STATUS", "CATEGORIA"
      `);
      
      console.log('🔍 Consultando banco com período:', periodoReferenciaBanco);
      sysQuery = sysQuery.eq('periodo_referencia', periodoReferenciaBanco);
      if (cliente !== 'todos') {
        console.log('🔍 Filtro de cliente aplicado:', cliente);
        // CORREÇÃO: Remover filtro SQL e filtrar em memória para garantir consistência
        console.log('🔍 Não aplicando filtro SQL - filtrando em memória para consistência');
      }
      
      // Teste específico: verificar se existem registros com os pacientes mencionados
      console.log('🔍 Fazendo consulta específica para pacientes VILMA e ADELINO...');
      const testQuery = await supabase
        .from('volumetria_mobilemed')
        .select('NOME_PACIENTE, EMPRESA, ESTUDO_DESCRICAO, DATA_REALIZACAO, periodo_referencia')
        .eq('periodo_referencia', periodoReferenciaBanco)
        .or('NOME_PACIENTE.ilike.%VILMA%,NOME_PACIENTE.ilike.%ADELINO%')
        .limit(20);
      
      console.log('🔍 Resultado da consulta específica:', {
        erro: testQuery.error,
        quantidade: testQuery.data?.length || 0,
        primeiros5: testQuery.data?.slice(0, 5)
      });
      
      // Verificar também todos os períodos disponíveis
      const periodosQuery = await supabase
        .from('volumetria_mobilemed')
        .select('periodo_referencia')
        .not('periodo_referencia', 'is', null)
        .or('NOME_PACIENTE.ilike.%VILMA%,NOME_PACIENTE.ilike.%ADELINO%');
      
      console.log('🔍 Períodos onde encontramos VILMA/ADELINO:', 
        [...new Set(periodosQuery.data?.map(p => p.periodo_referencia) || [])]
      );
      
      // OTIMIZAÇÃO: Limitar consulta para evitar timeout
      const { data: systemRows, error: sysErr } = await sysQuery
        .order('created_at', { ascending: false })
        .limit(15000); // Limite para evitar timeout do banco
      
      if (sysErr) {
        console.error('❌ Erro na consulta do sistema:', sysErr);
        throw sysErr;
      }

      console.log('🏥 Query executada no sistema:', {
        periodoReferenciaBanco,
        cliente: cliente !== 'todos' ? cliente : 'todos',
        totalRegistros: systemRows?.length || 0
      });

      // Mapear por chave agregada
      type AggSys = { total: number; amostra?: VolumetriaRow };
      const mapSistema = new Map<string, AggSys>();
      console.log('🔍 Total de registros do sistema encontrados:', systemRows?.length || 0);
      
      (systemRows || []).forEach((r: any, index) => {
        // CORREÇÃO: Aplicar filtro de cliente após busca para garantir consistência
        const empresaNormalizada = normalizeCliente(r.EMPRESA);
        if (cliente !== 'todos') {
          const clienteNormalizado = normalizeCliente(cliente);
          if (empresaNormalizada !== clienteNormalizado) {
            return; // Pular registro que não é do cliente selecionado
          }
        }
        
        const key = [
          empresaNormalizada,
          normalizeModalidade(r.MODALIDADE),
          canonical(r.ESPECIALIDADE),
          canonical(cleanExamName(r.ESTUDO_DESCRICAO)),
          canonical(r.NOME_PACIENTE),
          toYMD(r.DATA_REALIZACAO || r.DATA_LAUDO)
        ].join('|');
        
        // Log especial para AKC PALMAS
        if (r.EMPRESA?.includes('AKC') || empresaNormalizada.includes('AKC')) {
          console.log('🏥 AKC PALMAS - Processando registro do sistema:', {
            index,
            empresaOriginal: r.EMPRESA,
            empresaNormalizada,
            paciente: r.NOME_PACIENTE,
            exame: r.ESTUDO_DESCRICAO,
            valores: r.VALORES,
            chaveGerada: key
          });
        }
        
        if (index < 5 || r.NOME_PACIENTE?.includes('VILMA') || r.NOME_PACIENTE?.includes('ADELINO')) {
          console.log('🏥 Processando registro do sistema:', {
            index,
            empresa: r.EMPRESA,
            empresaNormalizada,
            paciente: r.NOME_PACIENTE,
            exame: r.ESTUDO_DESCRICAO,
            modalidade: r.MODALIDADE,
            especialidade: r.ESPECIALIDADE,
            dataRealizacao: r.DATA_REALIZACAO,
            dataLaudo: r.DATA_LAUDO,
            chaveGerada: key
          });
        }
        
        const cur = mapSistema.get(key) || { total: 0, amostra: r };
        cur.total += Number(r.VALORES || 0);
        if (!cur.amostra) cur.amostra = r;
        mapSistema.set(key, cur);
      });
      
      console.log('📊 Total de chaves únicas no sistema:', mapSistema.size);

      // 2) Ler dados do ARQUIVO (enviado na tela)
      type AggFile = { total: number; amostra?: UploadedExamRow };
      const mapArquivo = new Map<string, AggFile>();
      const inMonth = (val: any) => {
        if (!val) return true;
        const s = String(val);
        let ym = '';
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) ym = s.slice(0,7);
        else {
          const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
          if (m) ym = `${m[3].length===2?`20${m[3]}`:m[3]}-${m[2].padStart(2,'0')}`;
        }
        return ym ? ym === referencia : true;
      };
      console.log('🔍 Total de registros do arquivo disponíveis:', uploadedExams?.length || 0);
      
      (uploadedExams || []).forEach((r, index) => {
        const clienteNormalizado = normalizeCliente(r.cliente);
        if (cliente !== 'todos' && clienteNormalizado !== normalizeCliente(cliente)) return;
        if (!inMonth((r as any).data_exame || (r as any).data_laudo)) return;
        
        // Usar mesmos campos que o sistema para garantir correspondência
        const pacienteNome = (r as any).paciente || (r as any).nome_paciente || (r as any).NOME_PACIENTE;
        const exameDescricao = r.exame || (r as any).estudo_descricao || (r as any).ESTUDO_DESCRICAO;
        const dataExame = (r as any).data_exame || (r as any).data_realizacao || (r as any).DATA_REALIZACAO;
        const dataLaudo = (r as any).data_laudo || (r as any).DATA_LAUDO;
        
        // Log especial para AKC PALMAS
        if (r.cliente?.includes('AKC') || clienteNormalizado.includes('AKC')) {
          console.log('📁 AKC PALMAS - Processando registro do arquivo:', {
            index,
            clienteOriginal: r.cliente,
            clienteNormalizado,
            paciente: pacienteNome,
            exame: exameDescricao,
            valores: r.quant || (r as any).quantidade || (r as any).valores || 1
          });
        }
        
        // Log detalhado para casos específicos
        if (index < 5 || pacienteNome?.includes('VILMA') || pacienteNome?.includes('ADELINO')) {
          console.log('📁 Processando registro do arquivo:', {
            index,
            cliente: r.cliente,
            clienteNormalizado,
            paciente: pacienteNome,
            exame: exameDescricao,
            modalidade: r.modalidade,
            especialidade: r.especialidade,
            dataExame,
            dataLaudo,
            registroCompleto: r
          });
        }
        
        const key = [
          clienteNormalizado,
          normalizeModalidade(r.modalidade),
          canonical(r.especialidade),
          canonical(cleanExamName(exameDescricao)),
          canonical(pacienteNome),
          toYMD(dataExame || dataLaudo)
        ].join('|');
        
        const cur = mapArquivo.get(key) || { total: 0, amostra: r };
        cur.total += Number(r.quant || (r as any).quantidade || (r as any).valores || 1);
        if (!cur.amostra) cur.amostra = r;
        mapArquivo.set(key, cur);
        
        if (index < 5 || pacienteNome?.includes('VILMA') || pacienteNome?.includes('ADELINO')) {
          console.log('📝 Chave gerada para arquivo:', key);
        }
      });
      
      console.log('📊 Total de chaves únicas no arquivo:', mapArquivo.size);

      // Construir divergências
      const allKeys = new Set<string>([...mapArquivo.keys(), ...mapSistema.keys()]);
      const divergencias: LinhaDivergencia[] = [];

      const splitKey = (k: string) => k.split('|');
      const findSistemaCandidato = (k: string) => {
        const [cli, mod, esp, exame, pac, data] = splitKey(k);
        for (const ks of mapSistema.keys()) {
          const [cliS, modS, espS, exameS, pacS] = splitKey(ks);
          if (cli===cliS && mod===modS && esp===espS && exame===exameS && pac===pacS) return {ks, motivo:'data_diferente'};
        }
        for (const ks of mapSistema.keys()) {
          const [cliS, modS, _espS, exameS, pacS, dataS] = splitKey(ks);
          if (cli===cliS && mod===modS && exame===exameS && pac===pacS && data===dataS) return {ks, motivo:'especialidade_diferente'};
        }
        for (const ks of mapSistema.keys()) {
          const [cliS, modS, espS, _exameS, pacS, dataS] = splitKey(ks);
          if (cli===cliS && mod===modS && esp===espS && pac===pacS && data===dataS) return {ks, motivo:'descricao_exame_variavel'};
        }
        return null;
      };

      const toLinhaFromArquivo = (key: string, a: AggFile): LinhaDivergencia => {
        const r = a.amostra as any as UploadedExamRow;
        return {
          tipo: 'arquivo_nao_no_sistema',
          chave: key,
          EMPRESA: r.cliente || '-',
          NOME_PACIENTE: (r as any).paciente || '-',
          CODIGO_PACIENTE: String((r as any).codigoPaciente ?? '-') ,
          ESTUDO_DESCRICAO: (r as any).exame || '-',
          ACCESSION_NUMBER: (r as any).accessionNumber || '-',
          MODALIDADE: r.modalidade || '-',
          PRIORIDADE: (r as any).prioridade || '-',
          VALORES: Number(a.total || 0),
          ESPECIALIDADE: r.especialidade || '-',
          MEDICO: (r as any).medico || '-',
          DUPLICADO: '-',
          DATA_REALIZACAO: ((r as any).data_exame || '-') as string,
          HORA_REALIZACAO: '-',
          DATA_TRANSFERENCIA: '-',
          HORA_TRANSFERENCIA: '-',
          DATA_LAUDO: ((r as any).data_laudo || '-') as string,
          HORA_LAUDO: '-',
          DATA_PRAZO: '-',
          HORA_PRAZO: '-',
          STATUS: '-',
          UNIDADE_ORIGEM: '-',
          CLIENTE: r.cliente || '-',
          total_arquivo: a.total,
          total_sistema: 0,
          categoria_arquivo: (r as any).categoria || undefined,
        };
      };
      const toLinhaFromSistema = (key: string, s: AggSys): LinhaDivergencia => {
        const r = s.amostra as any as VolumetriaRow;
        return {
          tipo: 'sistema_nao_no_arquivo',
          chave: key,
          EMPRESA: r.EMPRESA || '-',
          NOME_PACIENTE: r.NOME_PACIENTE || '-',
          CODIGO_PACIENTE: String(r.CODIGO_PACIENTE ?? '-') ,
          ESTUDO_DESCRICAO: r.ESTUDO_DESCRICAO || '-',
          ACCESSION_NUMBER: r.ACCESSION_NUMBER || '-',
          MODALIDADE: r.MODALIDADE || '-',
          PRIORIDADE: r.PRIORIDADE || '-',
          VALORES: Number(s.total || 0),
          ESPECIALIDADE: r.ESPECIALIDADE || '-',
          MEDICO: r.MEDICO || '-',
          DUPLICADO: String(r.DUPLICADO ?? '-') ,
          DATA_REALIZACAO: r.DATA_REALIZACAO || '-',
          HORA_REALIZACAO: r.HORA_REALIZACAO || '-',
          DATA_TRANSFERENCIA: r.DATA_TRANSFERENCIA || '-',
          HORA_TRANSFERENCIA: r.HORA_TRANSFERENCIA || '-',
          DATA_LAUDO: r.DATA_LAUDO || '-',
          HORA_LAUDO: r.HORA_LAUDO || '-',
          DATA_PRAZO: r.DATA_PRAZO || '-',
          HORA_PRAZO: r.HORA_PRAZO || '-',
          STATUS: r.STATUS || '-',
          UNIDADE_ORIGEM: (r as any).UNIDADE_ORIGEM || r.EMPRESA || '-',
          CLIENTE: r.EMPRESA || '-',
          total_arquivo: 0,
          total_sistema: s.total,
          categoria_sistema: (r as any).CATEGORIA || undefined,
        };
      };

      // Log de análise especial para os casos mencionados
      console.log('🔍 Análise de divergências - Total de chaves únicas:', allKeys.size);
      
      // Buscar pacientes específicos mencionados
      const pacientesEspecificos = ['VILMA', 'ADELINO'];
      pacientesEspecificos.forEach(nome => {
        console.log(`🔍 Buscando registros de ${nome}:`);
        
        // No arquivo
        const chavesArquivo = Array.from(mapArquivo.keys()).filter(k => k.includes(nome));
        console.log(`📁 ${nome} - Chaves no arquivo (${chavesArquivo.length}):`, chavesArquivo);
        
        // No sistema
        const chavesSistema = Array.from(mapSistema.keys()).filter(k => k.includes(nome));
        console.log(`🏥 ${nome} - Chaves no sistema (${chavesSistema.length}):`, chavesSistema);
        
        // Comparação direta
        chavesArquivo.forEach(chaveArq => {
          const temNoSistema = mapSistema.has(chaveArq);
          if (!temNoSistema) {
            console.log(`❌ ${nome} - Chave só no arquivo:`, chaveArq);
            console.log(`📋 ${nome} - Dados do arquivo:`, mapArquivo.get(chaveArq)?.amostra);
            
            // Buscar chaves similares no sistema
            const [cli, mod, esp, exame, pac, data] = chaveArq.split('|');
            const chavesSimilares = Array.from(mapSistema.keys()).filter(ks => {
              const [cliS, modS, espS, exameS, pacS] = ks.split('|');
              return pac === pacS && cli === cliS; // Mesmo paciente e cliente
            });
            console.log(`🔍 ${nome} - Chaves similares no sistema:`, chavesSimilares);
            chavesSimilares.forEach(cs => {
              console.log(`📋 ${nome} - Dados similares no sistema:`, mapSistema.get(cs)?.amostra);
            });
          } else {
            console.log(`✅ ${nome} - Chave encontrada no sistema:`, chaveArq);
          }
        });
      });

      allKeys.forEach((k) => {
        const a = mapArquivo.get(k);
        const s = mapSistema.get(k);
        
        // Log especial para pacientes mencionados
        const temPacienteEspecifico = pacientesEspecificos.some(nome => k.includes(nome));
        
        if (a && !s) {
          if (temPacienteEspecifico) {
            console.log('🚨 DIVERGÊNCIA ESPECÍFICA - Só no arquivo:', {
              chave: k,
              dadosArquivo: a.amostra,
              paciente: (a.amostra as any)?.paciente,
              cliente: a.amostra?.cliente
            });
          }
          
          const cand = findSistemaCandidato(k);
          if (cand) {
            console.warn('[Divergência: Só no Arquivo] possível causa:', cand.motivo, { arquivo: a.amostra, sistema_exemplo: mapSistema.get(cand.ks)?.amostra });
          }
          divergencias.push(toLinhaFromArquivo(k, a));
        } else if (!a && s) {
          if (temPacienteEspecifico) {
            console.log('🚨 DIVERGÊNCIA ESPECÍFICA - Só no sistema:', {
              chave: k,
              dadosSistema: s.amostra,
              paciente: (s.amostra as any)?.NOME_PACIENTE,
              cliente: (s.amostra as any)?.EMPRESA
            });
          }
          divergencias.push(toLinhaFromSistema(k, s));
        } else if (a && s) {
          const catA = canonical(((a.amostra as any) || {}).categoria || '');
          const catS = canonical(((s.amostra as any) || {}).CATEGORIA || '');
          if (catA && catS && catA !== catS) {
            const base = toLinhaFromArquivo(k, a);
            base.tipo = 'categoria_diferente';
            base.total_sistema = s.total;
            base.categoria_arquivo = (a.amostra as any).categoria || '';
            base.categoria_sistema = (s.amostra as any).CATEGORIA || '';
            divergencias.push(base);
          } else if (a.total !== s.total) {
            const base = toLinhaFromArquivo(k, a);
            base.tipo = 'quantidade_diferente';
            base.total_sistema = s.total;
            divergencias.push(base);
          }
        }
      });

      // Gerar Excel com as divergências
      if (divergencias.length === 0) {
        alert('Nenhuma divergência encontrada para o período e cliente selecionados.');
        return;
      }

      // Preparar dados para Excel
      const dadosExcel = divergencias.map(linha => ({
        'Tipo Divergência': linha.tipo === 'arquivo_nao_no_sistema' ? 'Somente no Arquivo' :
                           linha.tipo === 'sistema_nao_no_arquivo' ? 'Somente no Sistema' :
                           linha.tipo === 'quantidade_diferente' ? 'Quantidade Diferente' :
                           linha.tipo === 'categoria_diferente' ? 'Categoria Diferente' : linha.tipo,
        'Cliente': linha.EMPRESA,
        'Paciente': linha.NOME_PACIENTE,
        'Código Paciente': linha.CODIGO_PACIENTE,
        'Exame': linha.ESTUDO_DESCRICAO,
        'Accession Number': linha.ACCESSION_NUMBER,
        'Modalidade': linha.MODALIDADE,
        'Especialidade': linha.ESPECIALIDADE,
        'Prioridade': linha.PRIORIDADE,
        'Médico': linha.MEDICO,
        'Data Realização': formatDateBR(linha.DATA_REALIZACAO),
        'Data Laudo': formatDateBR(linha.DATA_LAUDO),
        'Status': linha.STATUS,
        'Valores Arquivo': linha.total_arquivo || 0,
        'Valores Sistema': linha.total_sistema || 0,
        'Categoria Arquivo': linha.categoria_arquivo || '-',
        'Categoria Sistema': linha.categoria_sistema || '-',
      }));

      // Criar planilha
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosExcel);
      
      // Ajustar largura das colunas
      const columnWidths = [
        { wch: 20 }, // Tipo Divergência
        { wch: 25 }, // Cliente
        { wch: 30 }, // Paciente
        { wch: 15 }, // Código Paciente
        { wch: 40 }, // Exame
        { wch: 15 }, // Accession Number
        { wch: 12 }, // Modalidade
        { wch: 20 }, // Especialidade
        { wch: 12 }, // Prioridade
        { wch: 30 }, // Médico
        { wch: 15 }, // Data Realização
        { wch: 15 }, // Data Laudo
        { wch: 12 }, // Status
        { wch: 12 }, // Valores Arquivo
        { wch: 12 }, // Valores Sistema
        { wch: 15 }, // Categoria Arquivo
        { wch: 15 }, // Categoria Sistema
      ];
      ws['!cols'] = columnWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Divergências');
      
      // Nome do arquivo
      const nomeArquivo = `divergencias_${referencia}_${cliente !== 'todos' ? cliente : 'todos'}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      
      // Download
      XLSX.writeFile(wb, nomeArquivo);
      
      console.log(`✅ Excel gerado com ${divergencias.length} divergências`);
      
    } catch (e) {
      console.error('Erro ao gerar excel de divergências:', e);
      alert('Erro ao gerar relatório de divergências. Verifique o console para mais detalhes.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Divergências de Exames</span>
        </CardTitle>
        <CardDescription>
          Gerar relatório Excel com divergências entre arquivo enviado e dados do sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Período de Referência</label>
            <Select value={referencia} onValueChange={setReferencia}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025-06">Junho/2025</SelectItem>
                <SelectItem value="2025-05">Maio/2025</SelectItem>
                <SelectItem value="2025-04">Abril/2025</SelectItem>
                <SelectItem value="2025-03">Março/2025</SelectItem>
                <SelectItem value="2025-02">Fevereiro/2025</SelectItem>
                <SelectItem value="2025-01">Janeiro/2025</SelectItem>
                <SelectItem value="2024-12">Dezembro/2024</SelectItem>
                <SelectItem value="2024-11">Novembro/2024</SelectItem>
                <SelectItem value="2024-10">Outubro/2024</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Cliente</label>
            <Select value={cliente} onValueChange={setCliente}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Clientes</SelectItem>
                {clienteOptions.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <Button 
            onClick={gerarExcelDivergencias}
            disabled={exporting || !uploadedExams || uploadedExams.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Gerando Excel...' : 'Gerar Relatório Excel'}
          </Button>
        </div>

        {!uploadedExams || uploadedExams.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Faça upload de um arquivo na aba "Por Exame" para gerar o relatório de divergências.</p>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            <p>✅ Arquivo carregado com {uploadedExams.length} registros</p>
            <p>📊 Clique em "Gerar Relatório Excel" para processar e baixar as divergências</p>
            <p>⚠️ O processamento pode levar alguns minutos dependendo do volume de dados</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
