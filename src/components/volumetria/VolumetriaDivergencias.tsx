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
  CATEGORIA?: string;
}

type DivergenciaTipo = 'arquivo_nao_no_sistema' | 'sistema_nao_no_arquivo' | 'quantidade_diferente' | 'categoria' | 'especialidade' | 'modalidade' | 'prioridade';

interface LinhaDivergencia {
  tipo: DivergenciaTipo;
  chave: string;
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
  total_arquivo?: number;
  total_sistema?: number;
  categoria_arquivo?: string;
  categoria_sistema?: string;
  especialidade_arquivo?: string;
  especialidade_sistema?: string;
  modalidade_arquivo?: string;
  modalidade_sistema?: string;
  prioridade_arquivo?: string;
  prioridade_sistema?: string;
}

// NOVA IMPLEMENTAÇÃO: Funções de normalização mais robustas
function normalizar(texto: string): string {
  if (!texto) return '';
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') // Remove caracteres especiais
    .trim();
}

function normalizarCliente(nome: string): string {
  let limpo = normalizar(nome);
  
  // Mapeamentos específicos
  const mapeamentos: Record<string, string> = {
    'INTERCOR2': 'INTERCOR',
    'PHADVENTISTA': 'HADVENTISTA', 
    'PUNIMEDCARUARU': 'UNIMEDCARUARU',
    'PRNMEDIMAGEM': 'MEDIMAGEM',
    'UNIMAGEMSCENTRO': 'UNIMAGEMATIBAIA',
    'CEDIRJ': 'CEDIDIAG',
    'CEDIRO': 'CEDIDIAG', 
    'CEDIUNIMED': 'CEDIDIAG',
    'VIVERCLIN2': 'VIVERCLIN'
  };
  
  // Aplicar mapeamentos
  if (mapeamentos[limpo]) {
    limpo = mapeamentos[limpo];
  }
  
  // Remover sufixos comuns
  limpo = limpo
    .replace(/TELE$/, '')
    .replace(/CT$/, '')
    .replace(/MR$/, '')
    .replace(/PLANTAO$/, '')
    .replace(/RMX$/, '');
    
  return limpo;
}

function normalizarModalidade(modalidade: string): string {
  const normalizada = normalizar(modalidade);
  if (normalizada === 'CT') return 'TC';
  if (normalizada === 'MR') return 'RM';
  return normalizada;
}

function normalizarPrioridade(prioridade: string): string {
  const normalizada = normalizar(prioridade);
  if (['URGENCIA', 'URGENTE'].includes(normalizada)) return 'URGENTE';
  if (normalizada === 'ROTINA') return 'ROTINA';
  if (['EMERGENCIA', 'EMERGENCIAL'].includes(normalizada)) return 'EMERGENCIA';
  if (normalizada === 'PLANTAO') return 'PLANTAO';
  return normalizada;
}

function normalizarExame(exame: string): string {
  return normalizar(exame)
    .replace(/\sX\d+$/gi, '') // Remove multiplicadores como " X2", " X3"
    .replace(/\sXE$/gi, ''); // Remove " XE"
}

function normalizarData(data: any): string {
  if (!data) return '';
  
  let dataString = String(data).trim();
  if (!dataString) return '';
  
  // Se é número (Excel serial date)
  const num = Number(dataString);
  if (!isNaN(num) && num > 25000 && num < 60000) {
    const baseDate = new Date(1899, 11, 30);
    const convertedDate = new Date(baseDate.getTime() + num * 24 * 60 * 60 * 1000);
    return convertedDate.toISOString().split('T')[0];
  }
  
  // Se é formato ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(dataString)) {
    return dataString.split('T')[0];
  }
  
  // Se é formato brasileiro dd/mm/yyyy
  const match = dataString.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const dia = match[1].padStart(2, '0');
    const mes = match[2].padStart(2, '0');
    const ano = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${ano}-${mes}-${dia}`;
  }
  
  // Tentar parse nativo
  try {
    const date = new Date(dataString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    // Ignorar erro
  }
  
  return '';
}

function formatarDataBR(data: any): string {
  const dataISO = normalizarData(data);
  if (!dataISO) return '-';
  
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

// NOVA IMPLEMENTAÇÃO: Criação de chave mais robusta e específica
function criarChaveComparacao(item: any, tipoItem: 'sistema' | 'arquivo'): string {
  let paciente = '';
  let exame = '';
  let dataExame = '';
  let dataLaudo = '';
  let medico = '';
  
  if (tipoItem === 'sistema') {
    paciente = normalizar(item.NOME_PACIENTE || '');
    exame = normalizarExame(item.ESTUDO_DESCRICAO || '');
    dataExame = normalizarData(item.DATA_REALIZACAO || item.DATA_EXAME);
    dataLaudo = normalizarData(item.DATA_LAUDO);
    medico = normalizar((item.MEDICO || '').replace(/^DR[A]?\s*/i, ''));
  } else {
    paciente = normalizar(item.paciente || item.nome_paciente || item.NOME_PACIENTE || '');
    exame = normalizarExame(item.exame || item.estudo_descricao || item.ESTUDO_DESCRICAO || '');
    dataExame = normalizarData(item.data_exame || item.data_realizacao || item.DATA_REALIZACAO);
    dataLaudo = normalizarData(item.data_laudo || item.DATA_LAUDO);
    medico = normalizar((item.medico || item.MEDICO || '').replace(/^DR[A]?\s*/i, ''));
  }
  
  // Usar data de exame como prioridade, depois data de laudo
  const dataFinal = dataExame || dataLaudo;
  
  return [paciente, exame, dataFinal, medico].join('|');
}

export default function VolumetriaDivergencias({ uploadedExams }: { uploadedExams?: UploadedExamRow[] }) {
  const { data: ctx } = useVolumetria();
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  
  const [referencia, setReferencia] = useState<string>('2025-06');
  const [cliente, setCliente] = useState<string>('todos');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('clientes').select('id,nome').eq('ativo', true);
      const map: Record<string, string> = {};
      (data || []).forEach((c) => { map[c.id] = c.nome; });
      setClientesMap(map);
    })();
  }, []);

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
              setReferencia(refFormatada);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar último período:', error);
      }
    })();
  }, []);

  const clienteOptions = useMemo(() => ctx.clientes || [], [ctx.clientes]);

  const gerarExcelDivergencias = async () => {
    console.log('🚀 INÍCIO PROCESSAMENTO DIVERGÊNCIAS - NOVA IMPLEMENTAÇÃO');
    console.log('📝 uploadedExams recebido:', uploadedExams?.length || 0, 'registros');
    console.log('📊 Primeiros 3 itens do uploadedExams:', uploadedExams?.slice(0, 3));
    
    try {
      setExporting(true);
      
      // VALIDAÇÃO 1: Verificar arquivo carregado
      if (!uploadedExams || uploadedExams.length === 0) {
        alert('⚠️ ERRO: Nenhum arquivo foi carregado. Faça upload na aba "Por Exame" primeiro.');
        return;
      }
      console.log('📁 Arquivo validado:', uploadedExams.length, 'registros');
      
      // VALIDAÇÃO 2: Buscar dados do sistema
      console.log('🔍 Buscando dados do sistema para período:', referencia);
      
      const [ano, mes] = referencia.split('-');
      const mesesNome = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const mesNome = mesesNome[parseInt(mes) - 1];
      const anoShort = ano.substring(2, 4);
      const periodoFormatado = `${mesNome}/${anoShort}`;
      
      console.log('🔄 Período convertido:', referencia, '->', periodoFormatado);
      
      // Buscar dados do sistema
      const { data: systemData, error } = await supabase
        .from('volumetria_mobilemed')
        .select('*')
        .eq('periodo_referencia', periodoFormatado);
      
      if (error || !systemData || systemData.length === 0) {
        // Tentar busca alternativa por data_referencia
        const { data: systemDataAlt, error: errorAlt } = await supabase
          .from('volumetria_mobilemed')
          .select('*')
          .gte('data_referencia', `${ano}-${mes}-01`)
          .lt('data_referencia', `${ano}-${String(parseInt(mes) + 1).padStart(2, '0')}-01`);
        
        if (errorAlt || !systemDataAlt || systemDataAlt.length === 0) {
          alert(`⚠️ ERRO: Nenhum dado do sistema encontrado para o período ${periodoFormatado}.`);
          return;
        }
        
        console.log('✅ Dados do sistema encontrados via data_referencia:', systemDataAlt.length);
        var dadosSistema = systemDataAlt;
      } else {
        console.log('✅ Dados do sistema encontrados via periodo_referencia:', systemData.length);
        var dadosSistema = systemData;
      }
      
      // FILTRAR dados por cliente se necessário
      const sistemaFiltrado = dadosSistema.filter((item: any) => {
        if (cliente === 'todos') return true;
        const empresaNormalizada = normalizarCliente(item.EMPRESA || '');
        return empresaNormalizada === normalizarCliente(cliente);
      });
      
      const arquivoFiltrado = uploadedExams.filter((item: any) => {
        if (cliente === 'todos') return true;
        const clienteNormalizado = normalizarCliente(item.cliente || '');
        return clienteNormalizado === normalizarCliente(cliente);
      });
      
      console.log('📊 Dados filtrados - Sistema:', sistemaFiltrado.length, '| Arquivo:', arquivoFiltrado.length);
      
      // NOVA IMPLEMENTAÇÃO: Criar mapas de agregação usando chaves robustas
      console.log('🔧 Criando mapas de agregação...');
      
      // Mapa do sistema
      const mapaSistema = new Map<string, { total: number; itens: any[] }>();
      sistemaFiltrado.forEach((item: any, index: number) => {
        const chave = criarChaveComparacao(item, 'sistema');
        const valores = Number(item.VALORES || 1);
        
        // Debug detalhado para primeiros itens
        if (index < 3) {
          console.log(`🔍 SISTEMA [${index}]:`, {
            item_original: item,
            chave_gerada: chave,
            paciente: item.NOME_PACIENTE,
            exame: item.ESTUDO_DESCRICAO,
            data_realizacao: item.DATA_REALIZACAO,
            data_laudo: item.DATA_LAUDO,
            medico: item.MEDICO,
            valores
          });
        }
        
        if (mapaSistema.has(chave)) {
          const existente = mapaSistema.get(chave)!;
          existente.total += valores;
          existente.itens.push(item);
        } else {
          mapaSistema.set(chave, { total: valores, itens: [item] });
        }
      });
      
      // Mapa do arquivo
      const mapaArquivo = new Map<string, { total: number; itens: any[] }>();
      arquivoFiltrado.forEach((item: any, index: number) => {
        const chave = criarChaveComparacao(item, 'arquivo');
        const quantidade = Number(item.quant || item.quantidade || item.valores || 1);
        
        // Debug detalhado para primeiros itens
        if (index < 3) {
          console.log(`🔍 ARQUIVO [${index}]:`, {
            item_original: item,
            chave_gerada: chave,
            paciente: item.paciente || item.nome_paciente,
            exame: item.exame || item.estudo_descricao,
            data_exame: item.data_exame || item.data_realizacao,
            data_laudo: item.data_laudo,
            medico: item.medico,
            quantidade
          });
        }
        
        if (mapaArquivo.has(chave)) {
          const existente = mapaArquivo.get(chave)!;
          existente.total += quantidade;
          existente.itens.push(item);
        } else {
          mapaArquivo.set(chave, { total: quantidade, itens: [item] });
        }
      });
      
      console.log('📈 Mapas criados - Sistema:', mapaSistema.size, '| Arquivo:', mapaArquivo.size);
      
      // DEBUG: Verificar sobreposição
      const chavesComuns = Array.from(mapaArquivo.keys()).filter(chave => mapaSistema.has(chave));
      console.log('🎯 Chaves comuns encontradas:', chavesComuns.length);
      
      if (chavesComuns.length === 0) {
        console.log('⚠️ PROBLEMA: Nenhuma chave comum! Analisando...');
        console.log('🔍 Primeira chave arquivo:', Array.from(mapaArquivo.keys())[0]);
        console.log('🔍 Primeira chave sistema:', Array.from(mapaSistema.keys())[0]);
      }
      
      // NOVA IMPLEMENTAÇÃO: Identificar divergências
      console.log('🕵️ Identificando divergências...');
      const divergencias: LinhaDivergencia[] = [];
      
      // Todas as chaves únicas
      const todasChaves = new Set([...mapaArquivo.keys(), ...mapaSistema.keys()]);
      
      for (const chave of todasChaves) {
        const dadosArquivo = mapaArquivo.get(chave);
        const dadosSistema = mapaSistema.get(chave);
        
        if (dadosArquivo && dadosSistema) {
          // Existe em ambos - verificar divergências específicas
          const itemArquivo = dadosArquivo.itens[0];
          const itemSistema = dadosSistema.itens[0];
          
          // Comparar campos específicos
          const catArq = normalizar(itemArquivo.categoria || '');
          const catSis = normalizar(itemSistema.CATEGORIA || '');
          const espArq = normalizar(itemArquivo.especialidade || '');
          const espSis = normalizar(itemSistema.ESPECIALIDADE || '');
          const modArq = normalizarModalidade(itemArquivo.modalidade || '');
          const modSis = normalizarModalidade(itemSistema.MODALIDADE || '');
          const prioArq = normalizarPrioridade(itemArquivo.prioridade || '');
          const prioSis = normalizarPrioridade(itemSistema.PRIORIDADE || '');
          
          let tipoDivergencia: DivergenciaTipo | null = null;
          
          // Verificar diferenças
          if (catArq !== catSis && catArq && catSis) {
            tipoDivergencia = 'categoria';
          } else if (espArq !== espSis && espArq && espSis) {
            tipoDivergencia = 'especialidade';
          } else if (modArq !== modSis && modArq && modSis) {
            tipoDivergencia = 'modalidade';
          } else if (prioArq !== prioSis && prioArq && prioSis) {
            tipoDivergencia = 'prioridade';
          } else if (dadosArquivo.total !== dadosSistema.total) {
            tipoDivergencia = 'quantidade_diferente';
          }
          
          if (tipoDivergencia) {
            divergencias.push({
              tipo: tipoDivergencia,
              chave,
              EMPRESA: itemArquivo.cliente || '-',
              NOME_PACIENTE: itemArquivo.paciente || itemArquivo.nome_paciente || '-',
              CODIGO_PACIENTE: String(itemArquivo.codigoPaciente || '-'),
              ESTUDO_DESCRICAO: itemArquivo.exame || '-',
              ACCESSION_NUMBER: itemArquivo.accessionNumber || '-',
              MODALIDADE: itemArquivo.modalidade || '-',
              PRIORIDADE: itemArquivo.prioridade || '-',
              VALORES: dadosArquivo.total,
              ESPECIALIDADE: itemArquivo.especialidade || '-',
              MEDICO: itemArquivo.medico || '-',
              DUPLICADO: '-',
              DATA_REALIZACAO: formatarDataBR(itemArquivo.data_exame),
              HORA_REALIZACAO: '-',
              DATA_TRANSFERENCIA: '-',
              HORA_TRANSFERENCIA: '-',
              DATA_LAUDO: formatarDataBR(itemArquivo.data_laudo),
              HORA_LAUDO: '-',
              DATA_PRAZO: '-',
              HORA_PRAZO: '-',
              STATUS: '-',
              UNIDADE_ORIGEM: '-',
              CLIENTE: itemArquivo.cliente || '-',
              total_arquivo: dadosArquivo.total,
              total_sistema: dadosSistema.total,
              categoria_arquivo: catArq,
              categoria_sistema: catSis,
              especialidade_arquivo: espArq,
              especialidade_sistema: espSis,
              modalidade_arquivo: modArq,
              modalidade_sistema: modSis,
              prioridade_arquivo: prioArq,
              prioridade_sistema: prioSis,
            });
          }
          
        } else if (dadosArquivo && !dadosSistema) {
          // Só no arquivo
          const itemArquivo = dadosArquivo.itens[0];
          divergencias.push({
            tipo: 'arquivo_nao_no_sistema',
            chave,
            EMPRESA: itemArquivo.cliente || '-',
            NOME_PACIENTE: itemArquivo.paciente || itemArquivo.nome_paciente || '-',
            CODIGO_PACIENTE: String(itemArquivo.codigoPaciente || '-'),
            ESTUDO_DESCRICAO: itemArquivo.exame || '-',
            ACCESSION_NUMBER: itemArquivo.accessionNumber || '-',
            MODALIDADE: itemArquivo.modalidade || '-',
            PRIORIDADE: itemArquivo.prioridade || '-',
            VALORES: dadosArquivo.total,
            ESPECIALIDADE: itemArquivo.especialidade || '-',
            MEDICO: itemArquivo.medico || '-',
            DUPLICADO: '-',
            DATA_REALIZACAO: formatarDataBR(itemArquivo.data_exame),
            HORA_REALIZACAO: '-',
            DATA_TRANSFERENCIA: '-',
            HORA_TRANSFERENCIA: '-',
            DATA_LAUDO: formatarDataBR(itemArquivo.data_laudo),
            HORA_LAUDO: '-',
            DATA_PRAZO: '-',
            HORA_PRAZO: '-',
            STATUS: '-',
            UNIDADE_ORIGEM: '-',
            CLIENTE: itemArquivo.cliente || '-',
            total_arquivo: dadosArquivo.total,
            total_sistema: 0,
            categoria_arquivo: normalizar(itemArquivo.categoria || ''),
          });
          
        } else if (!dadosArquivo && dadosSistema) {
          // Só no sistema
          const itemSistema = dadosSistema.itens[0];
          divergencias.push({
            tipo: 'sistema_nao_no_arquivo',
            chave,
            EMPRESA: itemSistema.EMPRESA || '-',
            NOME_PACIENTE: itemSistema.NOME_PACIENTE || '-',
            CODIGO_PACIENTE: String(itemSistema.CODIGO_PACIENTE || '-'),
            ESTUDO_DESCRICAO: itemSistema.ESTUDO_DESCRICAO || '-',
            ACCESSION_NUMBER: itemSistema.ACCESSION_NUMBER || '-',
            MODALIDADE: itemSistema.MODALIDADE || '-',
            PRIORIDADE: itemSistema.PRIORIDADE || '-',
            VALORES: dadosSistema.total,
            ESPECIALIDADE: itemSistema.ESPECIALIDADE || '-',
            MEDICO: itemSistema.MEDICO || '-',
            DUPLICADO: String(itemSistema.DUPLICADO || '-'),
            DATA_REALIZACAO: formatarDataBR(itemSistema.DATA_REALIZACAO),
            HORA_REALIZACAO: itemSistema.HORA_REALIZACAO || '-',
            DATA_TRANSFERENCIA: formatarDataBR(itemSistema.DATA_TRANSFERENCIA),
            HORA_TRANSFERENCIA: itemSistema.HORA_TRANSFERENCIA || '-',
            DATA_LAUDO: formatarDataBR(itemSistema.DATA_LAUDO),
            HORA_LAUDO: itemSistema.HORA_LAUDO || '-',
            DATA_PRAZO: itemSistema.DATA_PRAZO || '-',
            HORA_PRAZO: itemSistema.HORA_PRAZO || '-',
            STATUS: itemSistema.STATUS || '-',
            UNIDADE_ORIGEM: itemSistema.EMPRESA || '-',
            CLIENTE: itemSistema.EMPRESA || '-',
            total_arquivo: 0,
            total_sistema: dadosSistema.total,
            categoria_sistema: normalizar(itemSistema.CATEGORIA || ''),
          });
        }
      }
      
      console.log('📊 RESULTADO FINAL:');
      console.log('- Total de divergências:', divergencias.length);
      console.log('- Chaves sistema:', mapaSistema.size);
      console.log('- Chaves arquivo:', mapaArquivo.size);
      console.log('- Chaves comuns:', chavesComuns.length);
      
      // Contar tipos de divergências
      const tipoContadores = divergencias.reduce((acc, div) => {
        acc[div.tipo] = (acc[div.tipo] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log('- Tipos:', tipoContadores);
      
      if (divergencias.length === 0) {
        alert('✅ Nenhuma divergência encontrada! Os dados do arquivo e sistema estão sincronizados.');
        return;
      }
      
      // NOVA IMPLEMENTAÇÃO: Gerar Excel com layout limpo
      const dadosExcel = divergencias.map(div => ({
        'Tipo Divergência': div.tipo === 'arquivo_nao_no_sistema' ? 'Somente no Arquivo' :
                          div.tipo === 'sistema_nao_no_arquivo' ? 'Somente no Sistema' :
                          div.tipo === 'quantidade_diferente' ? 'Quantidade Diferente' :
                          div.tipo === 'categoria' ? 'Categoria Diferente' :
                          div.tipo === 'especialidade' ? 'Especialidade Diferente' :
                          div.tipo === 'modalidade' ? 'Modalidade Diferente' :
                          div.tipo === 'prioridade' ? 'Prioridade Diferente' :
                          div.tipo,
        'Cliente': div.EMPRESA,
        'Paciente': div.NOME_PACIENTE,
        'Código Paciente': div.CODIGO_PACIENTE,
        'Exame': div.ESTUDO_DESCRICAO,
        'Modalidade': div.MODALIDADE,
        'Especialidade': div.ESPECIALIDADE,
        'Prioridade': div.PRIORIDADE,
        'Médico': div.MEDICO,
        'Data Realização': div.DATA_REALIZACAO,
        'Data Laudo': div.DATA_LAUDO,
        'Qtd Arquivo': div.total_arquivo || 0,
        'Qtd Sistema': div.total_sistema || 0,
        'Categoria Arquivo': div.categoria_arquivo || '-',
        'Categoria Sistema': div.categoria_sistema || '-',
        'Especialidade Arquivo': div.especialidade_arquivo || '-',
        'Especialidade Sistema': div.especialidade_sistema || '-',
        'Modalidade Arquivo': div.modalidade_arquivo || '-',
        'Modalidade Sistema': div.modalidade_sistema || '-',
        'Prioridade Arquivo': div.prioridade_arquivo || '-',
        'Prioridade Sistema': div.prioridade_sistema || '-',
      }));
      
      // Criar workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dadosExcel);
      
      // Ajustar colunas
      ws['!cols'] = [
        { wch: 20 }, // Tipo Divergência
        { wch: 25 }, // Cliente
        { wch: 30 }, // Paciente
        { wch: 15 }, // Código
        { wch: 35 }, // Exame
        { wch: 12 }, // Modalidade
        { wch: 20 }, // Especialidade
        { wch: 12 }, // Prioridade
        { wch: 25 }, // Médico
        { wch: 15 }, // Data Realização
        { wch: 15 }, // Data Laudo
        { wch: 12 }, // Qtd Arquivo
        { wch: 12 }, // Qtd Sistema
        { wch: 15 }, // Categoria Arquivo
        { wch: 15 }, // Categoria Sistema
        { wch: 18 }, // Especialidade Arquivo
        { wch: 18 }, // Especialidade Sistema
        { wch: 15 }, // Modalidade Arquivo
        { wch: 15 }, // Modalidade Sistema
        { wch: 15 }, // Prioridade Arquivo
        { wch: 15 }, // Prioridade Sistema
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Divergências');
      
      // Nome do arquivo
      const nomeArquivo = `divergencias_${referencia}_${cliente !== 'todos' ? cliente : 'todos'}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      
      // Download
      XLSX.writeFile(wb, nomeArquivo);
      
      console.log(`✅ Excel gerado: ${nomeArquivo} com ${divergencias.length} divergências`);
      
    } catch (error) {
      console.error('❌ Erro ao gerar excel:', error);
      alert('Erro ao gerar relatório. Verifique o console para detalhes.');
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