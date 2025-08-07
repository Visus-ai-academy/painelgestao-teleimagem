// Definição dos tipos de faturamento
export type TipoFaturamento = "CO-FT" | "NC-NF" | "NC-FT";

// Lista de clientes NC (não consolidados) - Regra F005
const CLIENTES_NC_ORIGINAL = [
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

// Lista de clientes NC adicionais - Regra F006
const CLIENTES_NC_ADICIONAIS = [
  "CEMVALENCA",
  "RMPADUA",
  "RADI-IMAGEM"
];

// Todos os clientes NC
const CLIENTES_NC = [...CLIENTES_NC_ORIGINAL, ...CLIENTES_NC_ADICIONAIS];

// Especialidades que geram faturamento para clientes NC (NC-FT)
const ESPECIALIDADES_NC_FATURADAS = ["CARDIO", "MEDICINA INTERNA", "NEUROBRAIN"];

// Médicos específicos que geram NC-FT para clientes NC adicionais - Regra F006
const MEDICOS_NC_FATURADOS = [
  "Dr. Antonio Gualberto Chianca Filho",
  "Dr. Daniel Chrispim",
  "Dr. Efraim Da Silva Ferreira",
  "Dr. Felipe Falcão de Sá",
  "Dr. Guilherme N. Schincariol",
  "Dr. Gustavo Andreis",
  "Dr. João Carlos Dantas do Amaral",
  "Dr. João Fernando Miranda Pompermayer",
  "Dr. Leonardo de Paula Ribeiro Figueiredo",
  "Dr. Raphael Sanfelice João",
  "Dr. Thiago P. Martins",
  "Dr. Virgílio Oliveira Barreto",
  "Dra. Adriana Giubilei Pimenta",
  "Dra. Aline Andrade Dorea",
  "Dra. Camila Amaral Campos",
  "Dra. Cynthia Mendes Vieira de Morais",
  "Dra. Fernanda Gama Barbosa",
  "Dra. Kenia Menezes Fernandes",
  "Dra. Lara M. Durante Bacelar",
  "Dr. Aguinaldo Cunha Zuppani",
  "Dr. Alex Gueiros de Barros",
  "Dr. Eduardo Caminha Nunes",
  "Dr. Márcio D'Andréa Rossi",
  "Dr. Rubens Pereira Moura Filho",
  "Dr. Wesley Walber da Silva",
  "Dra. Luna Azambuja Satte Alam",
  "Dra. Roberta Bertoldo Sabatini Treml",
  "Dra. Thais Nogueira D. Gastaldi",
  "Dra. Vanessa da Costa Maldonado"
];

// Função para determinar o tipo de faturamento
export function determinarTipoFaturamento(
  cliente: string,
  especialidade?: string,
  prioridade?: string,
  medico?: string
): TipoFaturamento {
  // Clientes CO (consolidados) - sempre CO-FT
  if (!CLIENTES_NC.includes(cliente)) {
    return "CO-FT";
  }

  // REGRA F005 - Clientes NC originais
  if (CLIENTES_NC_ORIGINAL.includes(cliente)) {
    const temEspecialidadeFaturada = especialidade && ESPECIALIDADES_NC_FATURADAS.includes(especialidade);
    const ehPlantao = prioridade === "PLANTÃO";

    if (temEspecialidadeFaturada || ehPlantao) {
      return "NC-FT";
    }
    return "NC-NF";
  }

  // REGRA F006 - Clientes NC adicionais (CEMVALENCA, RMPADUA, RADI-IMAGEM)
  if (CLIENTES_NC_ADICIONAIS.includes(cliente)) {
    const temEspecialidadeFaturada = especialidade && ESPECIALIDADES_NC_FATURADAS.includes(especialidade);
    const ehPlantao = prioridade === "PLANTÃO";
    const temMedicoFaturado = medico && MEDICOS_NC_FATURADOS.includes(medico);
    
    // Exceção especial para RADI-IMAGEM: incluir especialidade MAMA
    const temMamaRadiImagem = cliente === "RADI-IMAGEM" && especialidade === "MAMA";

    // NC-FT: especialidades específicas OU prioridade plantão OU médicos específicos OU MAMA para RADI-IMAGEM
    if (temEspecialidadeFaturada || ehPlantao || temMedicoFaturado || temMamaRadiImagem) {
      return "NC-FT";
    }
    return "NC-NF";
  }

  // Fallback (não deveria chegar aqui)
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