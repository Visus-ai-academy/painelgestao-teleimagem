// Tipos de Faturamento Definidos:
// CO-FT: CO com faturamento
// CO-NF: CO não faturado
// NC-FT: NC faturado
// NC-NF: NC não faturado
// NC1-NF: NC1 não faturado
export type TipoFaturamento = "CO-FT" | "CO-NF" | "NC-FT" | "NC-NF" | "NC1-NF";

// Determinação do Tipo de Cliente:
// CO (cliente do tipo CO)
// NC (Cliente do tipo NC)
// NC1 (Cliente do tipo NC1)

// Lista de clientes NC (Cliente do tipo NC)
const CLIENTES_NC = [
  "CBU",
  "CDICARDIO",
  "CDIGOIAS",
  "CICOMANGRA",
  "CISP",
  "CLIRAM",
  "CRWANDERLEY",
  "DIAGMAX-PR",
  "GOLD",
  "PRODIMAGEM",
  "RADMED",
  "TRANSDUSON",
  "ZANELLO",
  "CEMVALENCA",
  "RMPADUA",
  "RADI-IMAGEM"
];

// Lista de clientes NC1 (Cliente do tipo NC1)
const CLIENTES_NC1: string[] = [
  // Adicionar clientes NC1 conforme necessário
];

// Função para determinar o tipo de cliente
export function determinarTipoCliente(cliente: string): "CO" | "NC" | "NC1" {
  if (CLIENTES_NC1.includes(cliente)) return "NC1";
  if (CLIENTES_NC.includes(cliente)) return "NC";
  return "CO";
}

// Função para determinar o tipo de faturamento
export function determinarTipoFaturamento(
  cliente: string,
  tipoCliente?: "CO" | "NC" | "NC1"
): TipoFaturamento {
  const tipo = tipoCliente || determinarTipoCliente(cliente);
  
  if (tipo === "CO") {
    return "CO-FT"; // CO com faturamento (padrão)
  } else if (tipo === "NC") {
    return "NC-NF"; // NC não faturado (padrão)
  } else if (tipo === "NC1") {
    return "NC1-NF"; // NC1 não faturado (padrão)
  }
  
  return "CO-FT"; // Fallback
}

// Função para verificar se é cliente NC
export function isClienteNC(cliente: string): boolean {
  return CLIENTES_NC.includes(cliente);
}

// Função para verificar se é cliente NC1
export function isClienteNC1(cliente: string): boolean {
  return CLIENTES_NC1.includes(cliente);
}

// Função para obter todos os tipos de faturamento disponíveis
export function getTiposFaturamento(): TipoFaturamento[] {
  return ["CO-FT", "CO-NF", "NC-FT", "NC-NF", "NC1-NF"];
}