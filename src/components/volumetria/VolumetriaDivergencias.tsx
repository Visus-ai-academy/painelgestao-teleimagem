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

export default function VolumetriaDivergencias({ uploadedExams }: { uploadedExams?: UploadedExamRow[] }) {
  const { data: ctx } = useVolumetria();
  const [clientesMap, setClientesMap] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  
  const [referencia, setReferencia] = useState<string>('2025-06');
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
    console.log('🚀 INÍCIO PROCESSAMENTO DIVERGÊNCIAS - VERSÃO CORRIGIDA DEFINITIVA');
    
    try {
      setExporting(true);
      
      // VALIDAÇÃO 1: Verificar arquivo carregado
      if (!uploadedExams || uploadedExams.length === 0) {
        alert('⚠️ ERRO: Nenhum arquivo foi carregado. Faça upload primeiro.');
        return;
      }
      console.log('📁 Arquivo validado:', uploadedExams.length, 'registros');
      console.log('📊 Primeiros 3 registros do arquivo:', uploadedExams.slice(0, 3));
      
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
      
      if (error) {
        console.error('❌ Erro na consulta:', error);
        alert(`⚠️ ERRO na consulta: ${error.message}`);
        return;
      }
      
      let dadosSistema = systemData;
      
      if (!systemData || systemData.length === 0) {
        console.log('⚠️ Nenhum dado encontrado com periodo_referencia. Tentando busca alternativa...');
        
        // Busca alternativa por data_referencia
        const { data: systemDataAlt, error: errorAlt } = await supabase
          .from('volumetria_mobilemed')
          .select('*')
          .gte('data_referencia', `${ano}-${mes}-01`)
          .lt('data_referencia', `${ano}-${String(parseInt(mes) + 1).padStart(2, '0')}-01`);
        
        if (errorAlt || !systemDataAlt || systemDataAlt.length === 0) {
          alert(`⚠️ ERRO: Nenhum dado do sistema encontrado para o período ${periodoFormatado}.`);
          return;
        }
        
        console.log('✅ Dados do sistema encontrados via data_referencia:', systemDataAlt.length, 'registros');
        dadosSistema = systemDataAlt;
      } else {
        console.log('✅ Dados do sistema encontrados via periodo_referencia:', dadosSistema.length, 'registros');
      }
      
      console.log('📊 Primeiros 3 registros do sistema:', dadosSistema.slice(0, 3));
      
      // PROCESSAMENTO DEFINITIVO DAS DIVERGÊNCIAS
      console.log('🔧 Iniciando processamento de divergências...');
      
      // Criar função de chave normalizada
      const criarChave = (paciente: string, exame: string, dataExame: any, medico: string) => {
        const p = normalizar(paciente || '');
        const e = normalizar(exame || '');
        const d = normalizarData(dataExame);
        const m = normalizar(medico || '');
        return `${p}|${e}|${d}|${m}`;
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
      
      // MAPA DO ARQUIVO
      const mapaArquivo = new Map<string, any>();
      let processadosArquivo = 0;
      
      arquivoFiltrado.forEach((item, index) => {
        try {
          const chave = criarChave(item.paciente || '', item.exame || '', item.data_exame, item.medico || '');
          
          if (index < 3) {
            console.log(`📝 ARQUIVO [${index}]:`, {
              original: item,
              chave_gerada: chave,
              paciente: item.paciente,
              exame: item.exame,
              data_exame: item.data_exame,
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
          const chave = criarChave(item.NOME_PACIENTE || '', item.ESTUDO_DESCRICAO || '', item.DATA_REALIZACAO, item.MEDICO || '');
          
          if (index < 3) {
            console.log(`💾 SISTEMA [${index}]:`, {
              original: item,
              chave_gerada: chave,
              paciente: item.NOME_PACIENTE,
              exame: item.ESTUDO_DESCRICAO,
              data_realizacao: item.DATA_REALIZACAO,
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
      
      // DEBUG: Verificar se há chaves comuns
      const chavesComuns: string[] = [];
      mapaArquivo.forEach((_, chave) => {
        if (mapaSistema.has(chave)) {
          chavesComuns.push(chave);
        }
      });
      
      console.log('🎯 Chaves comuns encontradas:', chavesComuns.length);
      
      if (chavesComuns.length === 0) {
        console.log('⚠️ ALERTA: Nenhuma chave comum encontrada!');
        console.log('📝 Primeira chave do arquivo:', Array.from(mapaArquivo.keys())[0]);
        console.log('💾 Primeira chave do sistema:', Array.from(mapaSistema.keys())[0]);
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
            'Modalidade': itemArquivo.modalidade || '-',
            'Especialidade': itemArquivo.especialidade || '-',
            'Prioridade': itemArquivo.prioridade || '-',
            'Médico': itemArquivo.medico || '-',
            'Data Realização': formatarDataBR(itemArquivo.data_exame),
            'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
            'Qtd Arquivo': itemArquivo.quantidade,
            'Qtd Sistema': 0,
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
            'Modalidade': itemSistema.MODALIDADE || '-',
            'Especialidade': itemSistema.ESPECIALIDADE || '-',
            'Prioridade': itemSistema.PRIORIDADE || '-',
            'Médico': itemSistema.MEDICO || '-',
            'Data Realização': itemSistema.DATA_REALIZACAO || '-',
            'Data Laudo': itemSistema.DATA_LAUDO || '-',
            'Qtd Arquivo': 0,
            'Qtd Sistema': itemSistema.quantidade,
            'Observação': 'Exame no sistema mas não encontrado no arquivo'
          });
        }
      });
      
      console.log(`📊 Encontradas ${apenasNoSistema} chaves apenas no sistema`);
      
      // 3. Chaves comuns mas com quantidades diferentes
      console.log('🔍 Analisando quantidades diferentes...');
      let quantidadesDiferentes = 0;
      mapaArquivo.forEach((itemArquivo, chave) => {
        const itemSistema = mapaSistema.get(chave);
        if (itemSistema && itemArquivo.quantidade !== itemSistema.quantidade) {
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
            'Modalidade': itemArquivo.modalidade || '-',
            'Especialidade': itemArquivo.especialidade || '-',
            'Prioridade': itemArquivo.prioridade || '-',
            'Médico': itemArquivo.medico || '-',
            'Data Realização': formatarDataBR(itemArquivo.data_exame),
            'Data Laudo': formatarDataBR(itemArquivo.data_laudo),
            'Qtd Arquivo': itemArquivo.quantidade,
            'Qtd Sistema': itemSistema.quantidade,
            'Observação': `Arquivo: ${itemArquivo.quantidade}, Sistema: ${itemSistema.quantidade}`
          });
        }
      });
      
      console.log(`📊 Encontradas ${quantidadesDiferentes} diferenças de quantidade`);
      
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
        { wch: 40 }, // Observação
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, 'Divergências Reais');
      
      // Nome do arquivo
      const nomeArquivo = `divergencias_REAIS_${referencia}_${cliente !== 'todos' ? cliente : 'todos'}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      
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