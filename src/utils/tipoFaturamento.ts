// Definição dos tipos de faturamento
export type TipoFaturamento = "CO-FT" | "NC-NF" | "NC-FT";

// Lista de clientes NC (não consolidados)
const CLIENTES_NC = [
  "CDICARDIO",
  "CDIGOIAS", 
  "CISP",
  "CLIRAM",
  "CRWANDERLEY",
  "DIAGMAX-PR",
  "GOLD",
  "PRODIMAGEM",
  "TRANSDUSON",
  "ZANELLO"
];

// Função para determinar o tipo de faturamento
export function determinarTipoFaturamento(
  cliente: string,
  especialidade?: string,
  prioridade?: string
): TipoFaturamento {
  // Clientes NC
  if (CLIENTES_NC.includes(cliente)) {
    // Por enquanto, todos os clientes NC são NC-FT
    // As regras específicas serão aplicadas posteriormente
    return "NC-FT";
  }

  // Clientes CO (consolidados)
  return "CO-FT";
}

// Função para verificar se é cliente NC
export function isClienteNC(cliente: string): boolean {
  return CLIENTES_NC.includes(cliente);
}

// Função para obter todos os tipos de faturamento disponíveis
export function getTiposFaturamento(): TipoFaturamento[] {
  return ["CO-FT", "NC-FT", "NC-NF"];
}