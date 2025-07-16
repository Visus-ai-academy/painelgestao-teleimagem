// Tipos para o sistema de faturamento

export interface ExameRealizado {
  id: string;
  paciente: string;
  cliente: string;
  medico: string;
  dataExame: string;
  modalidade: "MR" | "CT" | "DO" | "MG" | "RX";
  especialidade: "CA" | "NE" | "ME" | "MI" | "MA";
  categoria: "Angio" | "Contrastado" | "Mastoide" | "OIT" | "Pescoço" | "Prostata" | "Score";
  prioridade: "Plantão" | "Rotina" | "Urgente";
  status: "Realizado" | "Faturado" | "Pago";
  valorBruto?: number; // Será calculado baseado no contrato
}

export interface RegraContrato {
  id: string;
  clienteId: string;
  modalidade: "MR" | "CT" | "DO" | "MG" | "RX";
  especialidade: "CA" | "NE" | "ME" | "MI" | "MA";
  categoria: "Angio" | "Contrastado" | "Mastoide" | "OIT" | "Pescoço" | "Prostata" | "Score";
  prioridade: "Plantão" | "Rotina" | "Urgente";
  valor: number;
  desconto?: number;
  acrescimo?: number;
  dataVigenciaInicio: string;
  dataVigenciaFim: string;
}

export interface PeriodoFaturamento {
  id: string;
  periodo: string; // "2024-01", "2024-02", etc.
  dataInicio: string;
  dataFim: string;
  status: "Aberto" | "Processando" | "Fechado" | "Faturado";
  bloqueado: boolean;
  dataProcessamento?: string;
  totalExames: number;
  valorTotal: number;
}

export interface FaturamentoItem {
  id: string;
  exameId: string;
  clienteId: string;
  periodo: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade: string;
  valorContrato: number;
  desconto: number;
  acrescimo: number;
  valorFinal: number;
  dataFaturamento: string;
}

export interface Fatura {
  id: string;
  numero: string;
  clienteId: string;
  cliente: string;
  periodo: string;
  dataEmissao: string;
  dataVencimento: string;
  status: "Gerada" | "Enviada" | "Paga" | "Vencida";
  items: FaturamentoItem[];
  subtotal: number;
  desconto: number;
  acrescimo: number;
  valorTotal: number;
  observacoes?: string;
}

export interface CalculoFaturamento {
  clienteId: string;
  periodo: string;
  exames: ExameRealizado[];
  regrasAplicadas: RegraContrato[];
  items: FaturamentoItem[];
  resumo: {
    totalExames: number;
    subtotal: number;
    totalDesconto: number;
    totalAcrescimo: number;
    valorFinal: number;
  };
}