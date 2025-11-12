// Utilitários para cálculo de períodos de faturamento
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface PeriodoFaturamento {
  inicioPeriodo: Date;
  fimPeriodo: Date;
  mesReferencia: string;
  anoReferencia: number;
}

/**
 * Calcula o período de faturamento baseado na regra:
 * Período: dia 8 do mês anterior até dia 7 do mês atual
 * Referência: mês anterior (ex: 08/06 a 07/07 = junho/25)
 */
export function calcularPeriodoFaturamento(dataReferencia: Date = new Date()): PeriodoFaturamento {
  const dia = dataReferencia.getDate();
  const mes = dataReferencia.getMonth();
  const ano = dataReferencia.getFullYear();

  let inicioPeriodo: Date;
  let fimPeriodo: Date;
  let mesRef: number;
  let anoRef: number;

  // Se a data for antes do dia 8, o período é do mês anterior
  if (dia < 8) {
    // Período: dia 8 do mês anterior ao anterior até dia 7 do mês anterior
    inicioPeriodo = new Date(ano, mes - 2, 8);
    fimPeriodo = new Date(ano, mes - 1, 7);
    mesRef = mes - 1; // Mês anterior ao anterior
    anoRef = mes - 1 < 0 ? ano - 1 : ano;
    
    // Ajustar se o mês ficou negativo
    if (mesRef < 0) {
      mesRef = 11; // Dezembro
      anoRef = ano - 1;
    }
  } else {
    // Período: dia 8 do mês anterior até dia 7 do mês atual
    inicioPeriodo = new Date(ano, mes - 1, 8);
    fimPeriodo = new Date(ano, mes, 7);
    mesRef = mes - 1; // Mês anterior
    anoRef = mes - 1 < 0 ? ano - 1 : ano;
    
    // Ajustar se o mês ficou negativo
    if (mesRef < 0) {
      mesRef = 11; // Dezembro
      anoRef = ano - 1;
    }
  }

  const mesReferencia = format(new Date(anoRef, mesRef, 1), 'MMMM/yy', { locale: ptBR });

  return {
    inicioPeriodo,
    fimPeriodo,
    mesReferencia: mesReferencia.charAt(0).toUpperCase() + mesReferencia.slice(1),
    anoReferencia: anoRef
  };
}

/**
 * Verifica se um período é considerado "dados do passado" (anterior a outubro/2025)
 */
export function isDadosPassado(periodo: PeriodoFaturamento): boolean {
  const outubroRef = new Date(2025, 9, 1); // Outubro de 2025
  const periodoRef = new Date(periodo.anoReferencia, periodo.inicioPeriodo.getMonth(), 1);
  
  return periodoRef < outubroRef;
}

/**
 * Verifica se um período pode ser faturado (regra: faturamento no dia 10)
 */
export function podeFaturar(periodo: PeriodoFaturamento, dataAtual: Date = new Date()): boolean {
  // Para dados do passado, sempre pode faturar
  if (isDadosPassado(periodo)) {
    return true;
  }

  // Para períodos atuais, só pode faturar depois do dia 10 do mês seguinte ao período
  const mesAposPeriodo = new Date(periodo.fimPeriodo);
  mesAposPeriodo.setMonth(mesAposPeriodo.getMonth() + 1);
  const diaFaturamento = new Date(mesAposPeriodo.getFullYear(), mesAposPeriodo.getMonth(), 10);
  
  return dataAtual >= diaFaturamento;
}

/**
 * Gera lista de períodos disponíveis para seleção
 */
export function gerarPeriodosDisponiveis(quantidadeMeses: number = 12): PeriodoFaturamento[] {
  const periodos: PeriodoFaturamento[] = [];
  const dataAtual = new Date();
  
  for (let i = 0; i < quantidadeMeses; i++) {
    const dataRef = new Date(dataAtual);
    dataRef.setMonth(dataRef.getMonth() - i);
    
    const periodo = calcularPeriodoFaturamento(dataRef);
    periodos.push(periodo);
  }
  
  return periodos;
}

/**
 * Formata período para exibição
 */
export function formatarPeriodo(periodo: PeriodoFaturamento): string {
  const inicio = format(periodo.inicioPeriodo, 'dd/MM');
  const fim = format(periodo.fimPeriodo, 'dd/MM/yyyy');
  
  return `${inicio} a ${fim}`;
}

/**
 * Converte período para string de consulta (YYYY-MM)
 */
export function periodoParaString(periodo: PeriodoFaturamento): string {
  const ano = periodo.anoReferencia.toString();
  const mes = (periodo.inicioPeriodo.getMonth() + 1).toString().padStart(2, '0');
  
  return `${ano}-${mes}`;
}

/**
 * Converte string de período (YYYY-MM) para objeto PeriodoFaturamento
 */
export function stringParaPeriodo(periodoString: string): PeriodoFaturamento {
  const [ano, mes] = periodoString.split('-').map(Number);
  const dataRef = new Date(ano, mes - 1, 15); // Dia 15 para garantir que está no mês correto
  
  return calcularPeriodoFaturamento(dataRef);
}