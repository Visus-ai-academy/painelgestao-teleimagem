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

// Funções de normalização
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

function normalizarPrioridade(prioridade: string): string {
  if (!prioridade) return '';
  
  const prioridadeNormalizada = normalizar(prioridade);
  
  // Mapeamentos de prioridades comuns
  const mapeamentos: Record<string, string> = {
    'URGENCIA': 'URGENCIA',
    'URGENTE': 'URGENCIA', 
    'URGENT': 'URGENCIA',
    'ROTINA': 'ROTINA',
    'ROUTINE': 'ROTINA',
    'NORMAL': 'ROTINA',
    'ELETIVO': 'ROTINA'
  };
  
  return mapeamentos[prioridadeNormalizada] || prioridadeNormalizada;
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

function normalizarMedico(nome: string): string {
  if (!nome) return '';
  
  let nomeNormalizado = nome
    .toString()
    .trim()
    .toUpperCase()
    .replace(/^DR\.?\s+|^DRA\.?\s+/g, '') // Remove Dr./Dra. do início
    .replace(/\s*\([^)]*\)\s*/g, '') // Remove códigos entre parênteses
    .replace(/\.$/, '') // Remove ponto final
    .trim();
  
  // Dividir em palavras
  const palavras = nomeNormalizado.split(/\s+/).filter(p => p.length > 0);
  
  if (palavras.length === 0) return '';
  if (palavras.length === 1) return palavras[0];
  
  // Nova regra: PRIMEIRO NOME + PRIMEIRA INICIAL DO SEGUNDO NOME apenas
  // Exemplo: "Guilherme Nogueira Schincariol Vicente" → "GUILHERME N"
  // Exemplo: "Guilherme N. Schincariol" → "GUILHERME N"
  
  const primeiroNome = palavras[0];
  const segundaPalavra = palavras[1];
  
  // Pegar apenas a primeira letra da segunda palavra
  const primeiraInicialSegundo = segundaPalavra[0];
  
  return `${primeiroNome} ${primeiraInicialSegundo}`;
}

function normalizarExame(nome: string): string {
  if (!nome) return '';
  
  let exameNormalizado = nome
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^A-Z0-9\s]/g, ' ') // Substitui especiais por espaço
    .replace(/\s+/g, ' ') // Unifica espaços
    .trim();
  
  // Remover palavras específicas para comparativo
  const palavrasRemover = [
    'COMPARATIVO',
    'REVISAO', 
    'REVISÃO',
    'CONTROLE',
    'SEGUIMENTO'
  ];
  
  palavrasRemover.forEach(palavra => {
    // Remover a palavra isolada (com espaços ou no final da string)
    exameNormalizado = exameNormalizado.replace(new RegExp(`\\b${palavra}\\b`, 'g'), '');
  });
  
  // Limpar espaços extras após remoção de palavras
  exameNormalizado = exameNormalizado.replace(/\s+/g, ' ').trim();
  
  // Normalizações específicas de exames
  const mapeamentos: Record<string, string> = {
    'RADIOGRAFIA': 'RX',
    'RAIO X': 'RX',
    'TOMOGRAFIA COMPUTADORIZADA': 'TC',
    'RESSONANCIA MAGNETICA': 'RM',
    'ULTRASSONOGRAFIA': 'US',
    'ECOGRAFIA': 'US'
  };
  
  // Aplicar mapeamentos
  Object.entries(mapeamentos).forEach(([original, substituto]) => {
    exameNormalizado = exameNormalizado.replace(new RegExp(original, 'g'), substituto);
  });
  
  return exameNormalizado;
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

export default function VolumetriaDivergencias({ uploadedExams, periodoSelecionado }: { uploadedExams?: UploadedExamRow[], periodoSelecionado?: string }) {
  const { data: ctx } = useVolumetria();
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  
  // Usar período ativo do contexto (sem filtro local duplicado)
  const [cliente, setCliente] = useState<string>('todos');

  // DEBUG: Log sempre que uploadedExams mudar
  useEffect(() => {
    console.log('🔄 VolumetriaDivergencias - uploadedExams mudou:', {
      recebido: !!uploadedExams,
      quantidade: uploadedExams?.length || 0,
      primeiros_3: uploadedExams?.slice(0, 3)
    });
  }, [uploadedExams]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('clientes').select('id,nome').eq('ativo', true);
      const map: Record<string, string> = {};
      (data || []).forEach((c) => { map[c.id] = c.nome; });
      setClientesMap(map);
    })();
  }, []);

  // Obter período selecionado do prop ou usar o ativo do contexto
  const periodoAtivo = periodoSelecionado || ctx.dashboardStats?.periodo_ativo || 'jun/25';
  
  console.log('🎯 VolumetriaDivergencias - Período selecionado:', periodoAtivo);
  
  // DEBUG: Testar normalização dos exames problemáticos
  console.log('🧪 TESTE NORMALIZAÇÃO EXAMES:');
  console.log('   "RM ARTICULACOES SACROILIACAS COMPARATIVO" →', normalizarExame('RM ARTICULACOES SACROILIACAS COMPARATIVO'));
  console.log('   "RM ARTICULACOES SACROILIACAS" →', normalizarExame('RM ARTICULACOES SACROILIACAS'));
  console.log('   "Gisele Costa De Almeida" →', normalizar('Gisele Costa De Almeida'));
  console.log('   "Dra. Priscila Maciel Cavalcanti" →', normalizarMedico('Dra. Priscila Maciel Cavalcanti'));

  const clienteOptions = useMemo(() => ctx.clientes || [], [ctx.clientes]);

  const gerarExcelDivergencias = async () => {
      console.log('🚀 PROCESSAMENTO EXCEL - Utilizando comparativo já calculado');
      
      try {
        setExporting(true);
        
        // Verificar se já existe comparativo na memória dos componentes pais
        if (!uploadedExams || uploadedExams.length === 0) {
          alert('⚠️ ERRO: Nenhum arquivo foi carregado. Faça upload primeiro.');
          return;
        }
        
        console.log('📁 Arquivo validado:', uploadedExams.length, 'registros');
        
        // USAR DADOS JÁ CARREGADOS DO CONTEXTO (sem nova consulta)
        console.log('📊 Utilizando dados já carregados do contexto');
        const dadosSistema = (ctx.detailedData as any[]) || [];
        
        console.log('📊 DADOS DISPONÍVEIS:');
        console.log(`   📋 Sistema: ${dadosSistema.length} registros`);
        console.log(`   📄 Arquivo: ${uploadedExams.length} registros`);
        
        if (dadosSistema.length === 0) {
          alert('⚠️ ERRO: Nenhum dado do sistema encontrado no contexto.');
          return;
        }
      
      // PROCESSAMENTO DEFINITIVO DAS DIVERGÊNCIAS
      console.log('🔧 Iniciando processamento de divergências...');
      
      // Criar função de chave normalizada para comparação
      const criarChave = (paciente: string, exame: string, dataExame: any, dataLaudo: any, medico: string) => {
        const p = normalizar(paciente || '');
        const e = normalizarExame(exame || '');
        const dr = normalizarData(dataExame);
        const dl = normalizarData(dataLaudo);
        const m = normalizarMedico(medico || '');
        return `${p}|${e}|${dr}|${dl}|${m}`;
      };
      
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
      console.log('🔍 Resumo dos dados carregados:');
      console.log(`   📋 Sistema: ${sistemaFiltrado.length} registros`);
      console.log(`   📄 Arquivo: ${arquivoFiltrado.length} registros`);
      console.log(`   🎯 Cliente selecionado: ${cliente}`);
      
      if (sistemaFiltrado.length < 100) {
        console.log('⚠️ ALERTA: Poucos dados do sistema encontrados!');
        console.log('   Isso pode indicar:');
        console.log('   - Dados ainda não processados para este período');
        console.log('   - Problemas na importação dos dados');
        console.log('   - Período selecionado incorreto');
      }
      
      // MAPA DO ARQUIVO
      const mapaArquivo = new Map<string, any>();
      let processadosArquivo = 0;
      
      arquivoFiltrado.forEach((item, index) => {
        try {
          const chave = criarChave(item.paciente || '', item.exame || '', item.data_exame, item.data_laudo, item.medico || '');
          
          // Debug específico para o caso da Gisele
          if (item.paciente && item.paciente.includes('Gisele') && item.exame?.includes('RM ARTICULACOES SACROILIACAS')) {
            console.log('🔍 DEBUG GISELE - ARQUIVO:', {
              paciente_original: item.paciente,
              paciente_normalizado: normalizar(item.paciente || ''),
              exame_original: item.exame,
              exame_normalizado: normalizarExame(item.exame || ''),
              data_exame_original: item.data_exame,
              data_exame_normalizada: normalizarData(item.data_exame),
              data_laudo_original: item.data_laudo,
              data_laudo_normalizada: normalizarData(item.data_laudo),
              medico_original: item.medico,
              medico_normalizado: normalizarMedico(item.medico || ''),
              chave_final: chave
            });
          }
          
          if (index < 3) {
            console.log(`📝 ARQUIVO [${index}]:`, {
              original: item,
              chave_gerada: chave,
              paciente: item.paciente,
              exame: item.exame,
              data_exame: item.data_exame,
              data_laudo: item.data_laudo,
              medico: item.medico
            });
          }
          
          if (mapaArquivo.has(chave)) {
            const existing = mapaArquivo.get(chave);
            existing.quantidade += (item.quant || 1);
          } else {
            mapaArquivo.set(chave, {
              ...item,
              quantidade: item.quant || 1,
              chave
            });
          }
          processadosArquivo++;
        } catch (err) {
          console.error('Erro ao processar item do arquivo:', item, err);
        }
      });
      
      console.log('📋 Mapa do arquivo criado:', mapaArquivo.size, 'chaves únicas de', processadosArquivo, 'registros');
      
      // MAPA DO SISTEMA
      const mapaSistema = new Map<string, any>();
      let processadosSistema = 0;
      
      sistemaFiltrado.forEach((item, index) => {
        try {
          const chave = criarChave(item.NOME_PACIENTE || '', item.ESTUDO_DESCRICAO || '', item.DATA_REALIZACAO, item.DATA_LAUDO, item.MEDICO || '');
          
          // Debug específico para o caso da Gisele
          if (item.NOME_PACIENTE && item.NOME_PACIENTE.includes('Gisele') && item.ESTUDO_DESCRICAO?.includes('RM ARTICULACOES SACROILIACAS')) {
            console.log('🔍 DEBUG GISELE - SISTEMA:', {
              paciente_original: item.NOME_PACIENTE,
              paciente_normalizado: normalizar(item.NOME_PACIENTE || ''),
              exame_original: item.ESTUDO_DESCRICAO,
              exame_normalizado: normalizarExame(item.ESTUDO_DESCRICAO || ''),
              data_realizacao_original: item.DATA_REALIZACAO,
              data_realizacao_normalizada: normalizarData(item.DATA_REALIZACAO),
              data_laudo_original: item.DATA_LAUDO,
              data_laudo_normalizada: normalizarData(item.DATA_LAUDO),
              medico_original: item.MEDICO,
              medico_normalizado: normalizarMedico(item.MEDICO || ''),
              chave_final: chave
            });
          }
          
          if (index < 3) {
            console.log(`💾 SISTEMA [${index}]:`, {
              original: item,
              chave_gerada: chave,
              paciente: item.NOME_PACIENTE,
              exame: item.ESTUDO_DESCRICAO,
              data_realizacao: item.DATA_REALIZACAO,
              data_laudo: item.DATA_LAUDO,
              medico: item.MEDICO
            });
          }
          
          if (mapaSistema.has(chave)) {
            const existing = mapaSistema.get(chave);
            existing.quantidade += (item.VALORES || 1);
          } else {
            mapaSistema.set(chave, {
              ...item,
              quantidade: item.VALORES || 1,
              chave
            });
          }
          processadosSistema++;
        } catch (err) {
          console.error('Erro ao processar item do sistema:', item, err);
        }
      });
      
      console.log('💽 Mapa do sistema criado:', mapaSistema.size, 'chaves únicas de', processadosSistema, 'registros');
      
      // DEBUG: Mostrar exemplos de chaves do arquivo e sistema para debug
      console.log('🔍 DEBUGGING - Primeiras 5 chaves do arquivo:', Array.from(mapaArquivo.keys()).slice(0, 5));
      console.log('🔍 DEBUGGING - Primeiras 5 chaves do sistema:', Array.from(mapaSistema.keys()).slice(0, 5));
      
      // DEBUG: Verificar se há chaves comuns
      const chavesComuns: string[] = [];
      mapaArquivo.forEach((_, chave) => {
        if (mapaSistema.has(chave)) {
          chavesComuns.push(chave);
        }
      });
      
      console.log('🎯 Chaves comuns encontradas:', chavesComuns.length);
      
      // DEBUG ESPECÍFICO: Procurar por Gisele nas chaves
      const chavesGiseleArquivo: string[] = [];
      const chavesGiseleSistema: string[] = [];
      
      mapaArquivo.forEach((item, chave) => {
        if (item.paciente && item.paciente.includes('Gisele') && item.exame?.includes('RM ARTICULACOES SACROILIACAS')) {
          chavesGiseleArquivo.push(chave);
          console.log('🔍 CHAVE GISELE NO ARQUIVO:', chave);
        }
      });
      
      mapaSistema.forEach((item, chave) => {
        if (item.NOME_PACIENTE && item.NOME_PACIENTE.includes('Gisele') && item.ESTUDO_DESCRICAO?.includes('RM ARTICULACOES SACROILIACAS')) {
          chavesGiseleSistema.push(chave);
          console.log('🔍 CHAVE GISELE NO SISTEMA:', chave);
        }
      });
      
      console.log('🎯 Chaves Gisele - Arquivo:', chavesGiseleArquivo.length, 'Sistema:', chavesGiseleSistema.length);
      
      if (chavesGiseleArquivo.length > 0 && chavesGiseleSistema.length > 0) {
        console.log('🔍 COMPARAÇÃO DIRECT GISELE:');
        console.log('   Arquivo:', chavesGiseleArquivo[0]);
        console.log('   Sistema:', chavesGiseleSistema[0]);
        console.log('   São iguais?', chavesGiseleArquivo[0] === chavesGiseleSistema[0]);
      }
      
      if (chavesComuns.length === 0) {
        console.log('⚠️ ALERTA: Nenhuma chave comum encontrada!');
        console.log('📝 Primeira chave do arquivo:', Array.from(mapaArquivo.keys())[0]);
        console.log('💾 Primeira chave do sistema:', Array.from(mapaSistema.keys())[0]);
        
        // DEBUG: Verificar se há chaves do sistema que contêm a mesma base que as do arquivo
        const primeiraChaveArquivo = Array.from(mapaArquivo.keys())[0];
        if (primeiraChaveArquivo) {
          const partesArquivo = primeiraChaveArquivo.split('|');
          const pacienteArquivo = partesArquivo[0];
          const exameArquivo = partesArquivo[1];
          
          console.log('🔍 Procurando no sistema chaves similares para:', pacienteArquivo, exameArquivo);
          let encontradas = 0;
          mapaSistema.forEach((valor, chaveSistema) => {
            if (encontradas < 3 && (chaveSistema.includes(pacienteArquivo) || chaveSistema.includes(exameArquivo))) {
              console.log('🔍 Chave similar encontrada no sistema:', chaveSistema);
              encontradas++;
            }
          });
        }
      }
      
      // IDENTIFICAR DIVERGÊNCIAS REAIS
      const divergenciasReais: any[] = [];
      let contadorDivergencias = 0;
      
      // 1. Chaves que existem no arquivo MAS NÃO no sistema
      console.log('🔍 Analisando chaves apenas no arquivo...');
      let apenasNoArquivo = 0;
      mapaArquivo.forEach((itemArquivo, chave) => {
        if (!mapaSistema.has(chave)) {
          apenasNoArquivo++;
          contadorDivergencias++;
          
          if (apenasNoArquivo <= 3) {
            console.log(`📋 APENAS NO ARQUIVO [${apenasNoArquivo}]:`, {
              chave,
              item: itemArquivo
            });
          }
          
          divergenciasReais.push({
            'Tipo Divergência': 'Dados apenas no arquivo',
            'Cliente': itemArquivo.cliente || '-',
            'Paciente': itemArquivo.paciente || '-',
            'Código Paciente': itemArquivo.codigoPaciente || '-',
            'Exame': itemArquivo.exame || '-',
            'Data Realização': formatarDataBR(itemArquivo.data_exame),
            'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
            'Médico': itemArquivo.medico || '-',
            'Qtd Arquivo': itemArquivo.quantidade,
            'Qtd Sistema': 0,
            'Modalidade Sistema': '-',
            'Modalidade Arquivo': itemArquivo.modalidade || '-',
            'Especialidade Sistema': '-',
            'Especialidade Arquivo': itemArquivo.especialidade || '-',
            'Categoria Sistema': '-',
            'Categoria Arquivo': itemArquivo.categoria || '-',
            'Prioridade Sistema': '-',
            'Prioridade Arquivo': itemArquivo.prioridade || '-',
            'Observação': 'Exame no arquivo mas não encontrado no sistema'
          });
        }
      });
      
      console.log(`📊 Encontradas ${apenasNoArquivo} chaves apenas no arquivo`);
      
      // 2. Chaves que existem no sistema MAS NÃO no arquivo  
      console.log('🔍 Analisando chaves apenas no sistema...');
      let apenasNoSistema = 0;
      mapaSistema.forEach((itemSistema, chave) => {
        if (!mapaArquivo.has(chave)) {
          apenasNoSistema++;
          contadorDivergencias++;
          
          if (apenasNoSistema <= 3) {
            console.log(`💾 APENAS NO SISTEMA [${apenasNoSistema}]:`, {
              chave,
              item: itemSistema
            });
          }
          
          divergenciasReais.push({
            'Tipo Divergência': 'Dados apenas no sistema',
            'Cliente': itemSistema.EMPRESA || '-',
            'Paciente': itemSistema.NOME_PACIENTE || '-',
            'Código Paciente': itemSistema.CODIGO_PACIENTE || '-',
            'Exame': itemSistema.ESTUDO_DESCRICAO || '-',
            'Data Realização': formatarDataBR(itemSistema.DATA_REALIZACAO),
            'Data Laudo': formatarDataBR(itemSistema.DATA_LAUDO),
            'Médico': itemSistema.MEDICO || '-',
            'Qtd Arquivo': 0,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
            'Modalidade Sistema': itemSistema.MODALIDADE || '-',
            'Modalidade Arquivo': '-',
            'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
            'Especialidade Arquivo': '-',
            'Categoria Sistema': itemSistema.CATEGORIA || '-',
            'Categoria Arquivo': '-',
            'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
            'Prioridade Arquivo': '-',
            'Observação': 'Exame no sistema mas não encontrado no arquivo'
          });
        }
      });
      
      console.log(`📊 Encontradas ${apenasNoSistema} chaves apenas no sistema`);
      
      // 3. Chaves comuns mas com quantidades diferentes
      console.log('🔍 Analisando quantidades diferentes...');
      let quantidadesDiferentes = 0;
      
      // 4. Divergências específicas de modalidade, especialidade, categoria e prioridade
      console.log('🔍 Analisando divergências específicas...');
      let divergenciasModalidade = 0;
      let divergenciasEspecialidade = 0;
      let divergenciasCategoria = 0;
      let divergenciasPrioridade = 0;
      let divergenciasModalidadeEspecialidade = 0;
      let divergenciasModalidadeCategoria = 0;
      
      mapaArquivo.forEach((itemArquivo, chave) => {
        const itemSistema = mapaSistema.get(chave);
        
        if (itemSistema) {
          // Verificar divergências de quantidade
          if (itemArquivo.quantidade !== itemSistema.quantidade) {
            quantidadesDiferentes++;
            contadorDivergencias++;
            
            if (quantidadesDiferentes <= 3) {
              console.log(`⚖️ QUANTIDADE DIFERENTE [${quantidadesDiferentes}]:`, {
                chave,
                arquivo: itemArquivo.quantidade,
                sistema: itemSistema.quantidade
              });
            }
            
            divergenciasReais.push({
              'Tipo Divergência': 'Quantidade diferente',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Arquivo: ${itemArquivo.quantidade}, Sistema: ${itemSistema.VALORES || itemSistema.quantidade}`
            });
          }
          
          // Verificar divergências específicas
          const modalidadeSistema = normalizar(itemSistema.MODALIDADE || '');
          const modalidadeArquivo = normalizar(itemArquivo.modalidade || '');
          const especialidadeSistema = normalizar(itemSistema.ESPECIALIDADE || '');
          const especialidadeArquivo = normalizar(itemArquivo.especialidade || '');
          const categoriaSistema = normalizar(itemSistema.CATEGORIA || '');
          const categoriaArquivo = normalizar(itemArquivo.categoria || '');
          const prioridadeSistema = normalizarPrioridade(itemSistema.PRIORIDADE || '');
          const prioridadeArquivo = normalizarPrioridade(itemArquivo.prioridade || '');
          
          // Divergência de Modalidade
          if (modalidadeSistema !== modalidadeArquivo) {
            divergenciasModalidade++;
            contadorDivergencias++;
            
            divergenciasReais.push({
              'Tipo Divergência': 'Divergência de Modalidade',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Sistema: ${itemSistema.MODALIDADE || '-'}, Arquivo: ${itemArquivo.modalidade || '-'}`
            });
          }
          
          // Divergência de Especialidade
          if (especialidadeSistema !== especialidadeArquivo) {
            divergenciasEspecialidade++;
            contadorDivergencias++;
            
            divergenciasReais.push({
              'Tipo Divergência': 'Divergência de Especialidade',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Sistema: ${itemSistema.ESPECIALIDADE || '-'}, Arquivo: ${itemArquivo.especialidade || '-'}`
            });
          }
          
          // Divergência de Categoria
          if (categoriaSistema !== categoriaArquivo) {
            divergenciasCategoria++;
            contadorDivergencias++;
            
            divergenciasReais.push({
              'Tipo Divergência': 'Divergência de Categoria',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Sistema: ${itemSistema.CATEGORIA || '-'}, Arquivo: ${itemArquivo.categoria || '-'}`
            });
          }
          
          // Divergência de Prioridade
          if (prioridadeSistema !== prioridadeArquivo) {
            divergenciasPrioridade++;
            contadorDivergencias++;
            
            divergenciasReais.push({
              'Tipo Divergência': 'Divergência de Prioridade',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Sistema: ${itemSistema.PRIORIDADE || '-'}, Arquivo: ${itemArquivo.prioridade || '-'}`
            });
          }
          
          // Divergência de Modalidade + Especialidade
          if (modalidadeSistema !== modalidadeArquivo && especialidadeSistema !== especialidadeArquivo) {
            divergenciasModalidadeEspecialidade++;
            contadorDivergencias++;
            
            divergenciasReais.push({
              'Tipo Divergência': 'Divergência de Modalidade+Especialidade',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Modalidade - Sistema: ${itemSistema.MODALIDADE || '-'}, Arquivo: ${itemArquivo.modalidade || '-'} | Especialidade - Sistema: ${itemSistema.ESPECIALIDADE || '-'}, Arquivo: ${itemArquivo.especialidade || '-'}`
            });
          }
          
          // Divergência de Modalidade + Categoria
          if (modalidadeSistema !== modalidadeArquivo && categoriaSistema !== categoriaArquivo) {
            divergenciasModalidadeCategoria++;
            contadorDivergencias++;
            
            divergenciasReais.push({
              'Tipo Divergência': 'Divergência de Modalidade+Categoria',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Modalidade - Sistema: ${itemSistema.MODALIDADE || '-'}, Arquivo: ${itemArquivo.modalidade || '-'} | Categoria - Sistema: ${itemSistema.CATEGORIA || '-'}, Arquivo: ${itemArquivo.categoria || '-'}`
            });
          }
          
          // Divergência de Modalidade + Prioridade
          if (modalidadeSistema !== modalidadeArquivo && prioridadeSistema !== prioridadeArquivo) {
            divergenciasReais.push({
              'Tipo Divergência': 'Divergência de Modalidade+Prioridade',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Modalidade - Sistema: ${itemSistema.MODALIDADE || '-'}, Arquivo: ${itemArquivo.modalidade || '-'} | Prioridade - Sistema: ${itemSistema.PRIORIDADE || '-'}, Arquivo: ${itemArquivo.prioridade || '-'}`
            });
          }
          
          // Divergência de Especialidade + Categoria
          if (especialidadeSistema !== especialidadeArquivo && categoriaSistema !== categoriaArquivo) {
            divergenciasReais.push({
              'Tipo Divergência': 'Divergência de Especialidade+Categoria',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Especialidade - Sistema: ${itemSistema.ESPECIALIDADE || '-'}, Arquivo: ${itemArquivo.especialidade || '-'} | Categoria - Sistema: ${itemSistema.CATEGORIA || '-'}, Arquivo: ${itemArquivo.categoria || '-'}`
            });
          }
          
          // Divergência de Especialidade + Prioridade
          if (especialidadeSistema !== especialidadeArquivo && prioridadeSistema !== prioridadeArquivo) {
            divergenciasReais.push({
              'Tipo Divergência': 'Divergência de Especialidade+Prioridade',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Especialidade - Sistema: ${itemSistema.ESPECIALIDADE || '-'}, Arquivo: ${itemArquivo.especialidade || '-'} | Prioridade - Sistema: ${itemSistema.PRIORIDADE || '-'}, Arquivo: ${itemArquivo.prioridade || '-'}`
            });
          }
          
          // Divergência de Categoria + Prioridade
          if (categoriaSistema !== categoriaArquivo && prioridadeSistema !== prioridadeArquivo) {
            divergenciasReais.push({
              'Tipo Divergência': 'Divergência de Categoria+Prioridade',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Categoria - Sistema: ${itemSistema.CATEGORIA || '-'}, Arquivo: ${itemArquivo.categoria || '-'} | Prioridade - Sistema: ${itemSistema.PRIORIDADE || '-'}, Arquivo: ${itemArquivo.prioridade || '-'}`
            });
          }
          
          // TRIOS - Divergência de Modalidade + Especialidade + Categoria
          if (modalidadeSistema !== modalidadeArquivo && especialidadeSistema !== especialidadeArquivo && categoriaSistema !== categoriaArquivo) {
            divergenciasReais.push({
              'Tipo Divergência': 'Divergência de Modalidade+Especialidade+Categoria',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Modalidade - Sistema: ${itemSistema.MODALIDADE || '-'}, Arquivo: ${itemArquivo.modalidade || '-'} | Especialidade - Sistema: ${itemSistema.ESPECIALIDADE || '-'}, Arquivo: ${itemArquivo.especialidade || '-'} | Categoria - Sistema: ${itemSistema.CATEGORIA || '-'}, Arquivo: ${itemArquivo.categoria || '-'}`
            });
          }
          
          // TRIOS - Divergência de Modalidade + Especialidade + Prioridade
          if (modalidadeSistema !== modalidadeArquivo && especialidadeSistema !== especialidadeArquivo && prioridadeSistema !== prioridadeArquivo) {
            divergenciasReais.push({
              'Tipo Divergência': 'Divergência de Modalidade+Especialidade+Prioridade',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Modalidade - Sistema: ${itemSistema.MODALIDADE || '-'}, Arquivo: ${itemArquivo.modalidade || '-'} | Especialidade - Sistema: ${itemSistema.ESPECIALIDADE || '-'}, Arquivo: ${itemArquivo.especialidade || '-'} | Prioridade - Sistema: ${itemSistema.PRIORIDADE || '-'}, Arquivo: ${itemArquivo.prioridade || '-'}`
            });
          }
          
          // TRIOS - Divergência de Modalidade + Categoria + Prioridade
          if (modalidadeSistema !== modalidadeArquivo && categoriaSistema !== categoriaArquivo && prioridadeSistema !== prioridadeArquivo) {
            divergenciasReais.push({
              'Tipo Divergência': 'Divergência de Modalidade+Categoria+Prioridade',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Modalidade - Sistema: ${itemSistema.MODALIDADE || '-'}, Arquivo: ${itemArquivo.modalidade || '-'} | Categoria - Sistema: ${itemSistema.CATEGORIA || '-'}, Arquivo: ${itemArquivo.categoria || '-'} | Prioridade - Sistema: ${itemSistema.PRIORIDADE || '-'}, Arquivo: ${itemArquivo.prioridade || '-'}`
            });
          }
          
          // TRIOS - Divergência de Especialidade + Categoria + Prioridade
          if (especialidadeSistema !== especialidadeArquivo && categoriaSistema !== categoriaArquivo && prioridadeSistema !== prioridadeArquivo) {
            divergenciasReais.push({
              'Tipo Divergência': 'Divergência de Especialidade+Categoria+Prioridade',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
               'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Especialidade - Sistema: ${itemSistema.ESPECIALIDADE || '-'}, Arquivo: ${itemArquivo.especialidade || '-'} | Categoria - Sistema: ${itemSistema.CATEGORIA || '-'}, Arquivo: ${itemArquivo.categoria || '-'} | Prioridade - Sistema: ${itemSistema.PRIORIDADE || '-'}, Arquivo: ${itemArquivo.prioridade || '-'}`
            });
          }
          
          // TODAS AS 4 - Divergência de Modalidade + Especialidade + Categoria + Prioridade
          if (modalidadeSistema !== modalidadeArquivo && especialidadeSistema !== especialidadeArquivo && categoriaSistema !== categoriaArquivo && prioridadeSistema !== prioridadeArquivo) {
            divergenciasReais.push({
              'Tipo Divergência': 'Divergência de Modalidade+Especialidade+Categoria+Prioridade',
              'Cliente': itemArquivo.cliente || '-',
              'Paciente': itemArquivo.paciente || '-',
              'Código Paciente': itemArquivo.codigoPaciente || '-',
              'Exame': itemArquivo.exame || '-',
              'Data Realização': formatarDataBR(itemArquivo.data_exame),
              'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
              'Médico': itemArquivo.medico || '-',
              'Qtd Arquivo': itemArquivo.quantidade,
              'Qtd Sistema': itemSistema.VALORES || itemSistema.quantidade,
              'Modalidade Sistema': itemSistema.MODALIDADE || '-',
              'Modalidade Arquivo': itemArquivo.modalidade || '-',
              'Especialidade Sistema': itemSistema.ESPECIALIDADE || '-',
              'Especialidade Arquivo': itemArquivo.especialidade || '-',
              'Categoria Sistema': itemSistema.CATEGORIA || '-',
              'Categoria Arquivo': itemArquivo.categoria || '-',
              'Prioridade Sistema': itemSistema.PRIORIDADE || '-',
              'Prioridade Arquivo': itemArquivo.prioridade || '-',
              'Observação': `Todas divergem - Modalidade: Sistema ${itemSistema.MODALIDADE || '-'} vs Arquivo ${itemArquivo.modalidade || '-'} | Especialidade: Sistema ${itemSistema.ESPECIALIDADE || '-'} vs Arquivo ${itemArquivo.especialidade || '-'} | Categoria: Sistema ${itemSistema.CATEGORIA || '-'} vs Arquivo ${itemArquivo.categoria || '-'} | Prioridade: Sistema ${itemSistema.PRIORIDADE || '-'} vs Arquivo ${itemArquivo.prioridade || '-'}`
            });
          }
        }
      });
      
      console.log(`📊 Encontradas ${quantidadesDiferentes} diferenças de quantidade`);
      console.log(`📊 Encontradas ${divergenciasModalidade} divergências de modalidade`);
      console.log(`📊 Encontradas ${divergenciasEspecialidade} divergências de especialidade`);
      console.log(`📊 Encontradas ${divergenciasCategoria} divergências de categoria`);
      console.log(`📊 Encontradas ${divergenciasPrioridade} divergências de prioridade`);
      console.log(`📊 Encontradas ${divergenciasModalidadeEspecialidade} divergências de modalidade+especialidade`);
      console.log(`📊 Encontradas ${divergenciasModalidadeCategoria} divergências de modalidade+categoria`);
      
      // RESUMO FINAL
      console.log('📋 RESUMO FINAL DAS DIVERGÊNCIAS:');
      console.log(`- Total de divergências REAIS: ${contadorDivergencias}`);
      console.log(`- Apenas no arquivo: ${apenasNoArquivo}`);
      console.log(`- Apenas no sistema: ${apenasNoSistema}`);
      console.log(`- Quantidades diferentes: ${quantidadesDiferentes}`);
      console.log(`- Chaves arquivo: ${mapaArquivo.size}`);
      console.log(`- Chaves sistema: ${mapaSistema.size}`);
      
      if (divergenciasReais.length === 0) {
        alert('✅ Parabéns! Não há divergências entre o arquivo e o sistema!');
        return;
      }
      
      // GERAR ARQUIVO EXCEL
      console.log('📁 Gerando arquivo Excel...');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(divergenciasReais);
      
      // Ajustar largura das colunas
      ws['!cols'] = [
        { wch: 25 }, // Tipo Divergência
        { wch: 20 }, // Cliente
        { wch: 30 }, // Paciente
        { wch: 15 }, // Código Paciente
        { wch: 35 }, // Exame
        { wch: 15 }, // Data Realização
        { wch: 15 }, // Data Laudo
        { wch: 25 }, // Médico
        { wch: 12 }, // Qtd Arquivo
        { wch: 12 }, // Qtd Sistema
        { wch: 18 }, // Modalidade Sistema
        { wch: 18 }, // Modalidade Arquivo
        { wch: 20 }, // Especialidade Sistema
        { wch: 20 }, // Especialidade Arquivo
        { wch: 18 }, // Categoria Sistema
        { wch: 18 }, // Categoria Arquivo
        { wch: 18 }, // Prioridade Sistema
        { wch: 18 }, // Prioridade Arquivo
        { wch: 50 }, // Observação
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Divergências Reais');
      
      // Nome do arquivo usando período do contexto
      const nomeArquivo = `divergencias_REAIS_${periodoAtivo.replace('/', '-')}_${cliente !== 'todos' ? cliente : 'todos'}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      
      // Download
      XLSX.writeFile(wb, nomeArquivo);
      
      console.log(`✅ Excel gerado com SUCESSO: ${nomeArquivo}`);
      console.log(`📊 Total de divergências REAIS exportadas: ${divergenciasReais.length}`);
      
      alert(`✅ Excel gerado com sucesso!\n\nArquivo: ${nomeArquivo}\nDivergências encontradas: ${divergenciasReais.length}\n\n- Apenas no arquivo: ${apenasNoArquivo}\n- Apenas no sistema: ${apenasNoSistema}\n- Quantidades diferentes: ${quantidadesDiferentes}`);
      
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
          Gerar relatório Excel com divergências entre arquivo enviado e dados do sistema.
          <br />
          <strong>Período ativo:</strong> {periodoAtivo}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6">
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