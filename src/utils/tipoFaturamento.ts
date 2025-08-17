// Tipos de Faturamento Definidos:
// CO-FT: CO com faturamento
// NC-FT: NC faturado
// NC-NF: NC não faturado
export type TipoFaturamento = "CO-FT" | "NC-FT" | "NC-NF";

// Determinação do Tipo de Cliente:
// CO (cliente do tipo CO)
// NC (Cliente do tipo NC)

// Lista de clientes NC (Cliente do tipo NC)
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
  "ZANELLO",
  "CEMVALENCA",
  "RMPADUA",
  "RADI-IMAGEM"
];

// Função para determinar o tipo de cliente
export function determinarTipoCliente(cliente: string): "CO" | "NC" {
  return CLIENTES_NC.includes(cliente) ? "NC" : "CO";
}

// Função para determinar o tipo de faturamento
export function determinarTipoFaturamento(
  cliente: string,
  tipoCliente?: "CO" | "NC"
): TipoFaturamento {
  const tipo = tipoCliente || determinarTipoCliente(cliente);
  
  if (tipo === "CO") {
    return "CO-FT"; // CO com faturamento
  } else {
    // Para clientes NC, determinar se é faturado ou não faturado
    // Por enquanto, todos os NC são não faturados por padrão
    return "NC-NF"; // NC não faturado
  }
}

// Função para verificar se é cliente NC
export function isClienteNC(cliente: string): boolean {
  return CLIENTES_NC.includes(cliente);
}

// Função para obter todos os tipos de faturamento disponíveis
export function getTiposFaturamento(): TipoFaturamento[] {
  return ["CO-FT", "NC-FT", "NC-NF"];
}