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

// Especialidades que geram faturamento para clientes NC (NC-FT)
const ESPECIALIDADES_NC_FATURADAS = ["CARDIO", "MEDICINA INTERNA", "NEUROBRAIN"];

// Função para determinar o tipo de faturamento
export function determinarTipoFaturamento(
  cliente: string,
  especialidade?: string,
  prioridade?: string
): TipoFaturamento {
  // Clientes CO (consolidados) - sempre CO-FT
  if (!CLIENTES_NC.includes(cliente)) {
    return "CO-FT";
  }

  // Para clientes NC, verificar especialidade e prioridade
  const temEspecialidadeFaturada = especialidade && ESPECIALIDADES_NC_FATURADAS.includes(especialidade);
  const ehPlantao = prioridade === "PLANTÃO";

  // NC-FT: Clientes NC com especialidades específicas OU prioridade plantão
  if (temEspecialidadeFaturada || ehPlantao) {
    return "NC-FT";
  }

  // NC-NF: Todos os demais exames de clientes NC
  return "NC-NF";
}

// Função para verificar se é cliente NC
export function isClienteNC(cliente: string): boolean {
  return CLIENTES_NC.includes(cliente);
}

// Função para obter todos os tipos de faturamento disponíveis
export function getTiposFaturamento(): TipoFaturamento[] {
  return ["CO-FT", "NC-FT", "NC-NF"];
}