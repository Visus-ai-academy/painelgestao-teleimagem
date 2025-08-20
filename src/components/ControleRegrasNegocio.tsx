import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings, AlertTriangle, CheckCircle, Clock, Users, ChevronDown, ChevronRight, Trash2, Calculator, FileText, DollarSign, ClipboardList, BarChart3, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Regra {
  id: string;
  nome: string;
  modulo: 'volumetria' | 'faturamento' | 'clientes' | 'precos' | 'repasses' | 'exames' | 'medicos' | 'escalas' | 'sistema' | 'seguranca';
  categoria: 'temporal' | 'dados' | 'validacao' | 'calculo' | 'acesso' | 'integracao' | 'automacao' | 'exclusao';
  criterio: string;
  status: 'ativa' | 'inativa' | 'pendente';
  implementadaEm: string;
  observacoes?: string;
  ordem_execucao: number;
  tipo_regra: 'exclusao' | 'negocio';
}

interface RegraExclusaoBanco {
  id: string;
  nome_regra?: string;
  descricao?: string;
  criterios?: any;
  prioridade?: number;
  acao?: string;
  motivo_exclusao?: string;
  aplicar_legado?: boolean;
  aplicar_incremental?: boolean;
  ativo?: boolean;
  created_at?: string;
  // Campos adicionais que podem existir na tabela
  [key: string]: any;
}

export function ControleRegrasNegocio() {
  const [regrasExclusao, setRegrasExclusao] = useState<RegraExclusaoBanco[]>([]);
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Regras de negócio implementadas nas edge functions e banco
  const regrasNegocio: Regra[] = [
    // VOLUMETRIA - Ordem de execução
    {
      id: 'v001',
      nome: 'Proteção Temporal de Dados',
      modulo: 'volumetria',
      categoria: 'temporal',
      criterio: 'Impede edição de dados com mais de 5 dias do mês anterior. Bloqueia inserção de dados futuros. Inclui botão de "fechar faturamento" que bloqueia novos dados após fechamento.',
      status: 'ativa',
      implementadaEm: '2024-01-15',
      observacoes: 'Implementado via RLS policies can_edit_data(), can_insert_data() + controle de fechamento por período',
      ordem_execucao: 1,
      tipo_regra: 'negocio'
    },
    {
      id: 'v002',
      nome: 'Exclusão por DATA_LAUDO fora do período',
      modulo: 'volumetria',
      categoria: 'exclusao',
      criterio: 'Remove registros com DATA_LAUDO fora do período de faturamento (dia 8 do mês até dia 7 do mês seguinte). Aplicada SOMENTE nos arquivos: volumetria_padrao_retroativo e volumetria_fora_padrao_retroativo.',
      status: 'ativa',
      implementadaEm: '2024-07-01',
      observacoes: 'Edge function: aplicar-exclusoes-periodo (apenas arquivos retroativos)',
      ordem_execucao: 2,
      tipo_regra: 'exclusao'
    },
    {
      id: 'v003',
      nome: 'Exclusão por DATA_REALIZACAO >= período',
      modulo: 'volumetria',
      categoria: 'exclusao',
      criterio: 'Remove registros retroativos com DATA_REALIZACAO >= 01 do mês especificado.',
      status: 'ativa',
      implementadaEm: '2024-07-01',
      observacoes: 'Edge function: aplicar-exclusoes-periodo',
      ordem_execucao: 3,
      tipo_regra: 'exclusao'
    },
    {
      id: 'v031',
      nome: 'Filtro de período atual para arquivos não-retroativos',
      modulo: 'volumetria',
      categoria: 'exclusao',
      criterio: 'Remove registros com DATA_REALIZACAO fora do mês de referência (01 ao último dia) e DATA_LAUDO fora do período permitido (01 do mês de referencia até 07 do mês subsequente ao mes de referencia). Aplicada SOMENTE nos arquivos: volumetria_padrao, volumetria_fora_padrao e volumetria_onco_padrao.',
      status: 'ativa',
      implementadaEm: '2024-07-01',
      observacoes: 'Edge function: aplicar-exclusoes-periodo (válida apenas para arquivos não-retroativos)',
      ordem_execucao: 1,
      tipo_regra: 'exclusao'
    },
    {
      id: 'v013',
      nome: 'Validação de Formato Excel',
      modulo: 'volumetria',
      categoria: 'validacao',
      criterio: 'Valida estrutura dos arquivos Excel antes do processamento, verifica colunas obrigatórias.',
      status: 'ativa',
      implementadaEm: '2024-01-20',
      ordem_execucao: 4,
      tipo_regra: 'negocio'
    },
    {
      id: 'v022',
      nome: 'Validação e Limpeza de Caracteres Especiais',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Remove caracteres especiais inválidos, espaços extras e normaliza encoding de texto (UTF-8).',
      status: 'ativa',
      implementadaEm: '2024-01-26',
      ordem_execucao: 5,
      tipo_regra: 'negocio'
    },
    {
      id: 'v026',
      nome: 'Mapeamento De Para - Valores por Estudo',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Utiliza arquivo de referência (ESTUDO_DESCRICAO, VALORES) para preencher valores zerados.',
      status: 'ativa',
      implementadaEm: '2024-01-28',
      observacoes: 'Edge function: processar-valores-de-para + RPC aplicar_valores_de_para',
      ordem_execucao: 6,
      tipo_regra: 'negocio'
    },
    {
      id: 'v027',
      nome: 'Aplicação de Regras de Quebra de Exames',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Aplica regras configuradas para quebrar exames compostos em exames individuais.',
      status: 'ativa',
      implementadaEm: '2024-01-30',
      observacoes: 'Edge function: processar-quebra-exames, tabela regras_quebra_exames',
      ordem_execucao: 7,
      tipo_regra: 'negocio'
    },
    {
      id: 'v028',
      nome: 'Processamento de Categorias de Exames',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Processa e categoriza exames com base na tabela de categorias configuradas.',
      status: 'ativa',
      implementadaEm: '2024-02-01',
      observacoes: 'Edge function: processar-categorias-exame, tabela categorias_exame',
      ordem_execucao: 8,
      tipo_regra: 'negocio'
    },
    {
      id: 'v029',
      nome: 'Tratamento de Exames Fora do Padrão',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Identifica e trata exames que não seguem o padrão estabelecido.',
      status: 'ativa',
      implementadaEm: '2024-02-02',
      observacoes: 'Componente: ExamesForaPadraoUpload.tsx',
      ordem_execucao: 9,
      tipo_regra: 'negocio'
    },
    {
      id: 'v030',
      nome: 'Correção de Modalidade para Exames RX',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Todos os exames na coluna ESTUDO_DESCRICAO que começam com "RX " têm a modalidade alterada para "RX". Aplica-se aos arquivos de upload 1,2,3,4,5.',
      status: 'ativa',
      implementadaEm: '2025-01-07',
      observacoes: 'Regra aplicada durante processamento dos dados de volumetria',
      ordem_execucao: 10,
      tipo_regra: 'negocio'
    },
    {
      id: 'v014',
      nome: 'Mapeamento Dinâmico de Campos',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Utiliza tabela field_mappings para mapear colunas do arquivo para campos do banco de dados.',
      status: 'ativa',
      implementadaEm: '2024-01-18',
      ordem_execucao: 11,
      tipo_regra: 'negocio'
    },
    {
      id: 'v016',
      nome: 'Processamento em Lotes',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Processa uploads em lotes de 1000 registros para otimizar performance.',
      status: 'ativa',
      implementadaEm: '2024-01-15',
      ordem_execucao: 12,
      tipo_regra: 'negocio'
    },
    {
      id: 'v008',
      nome: 'Cache de Performance',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Utiliza cache para otimizar consultas grandes, refresh automático a cada 5 minutos.',
      status: 'ativa',
      implementadaEm: '2024-01-12',
      ordem_execucao: 13,
      tipo_regra: 'negocio'
    },
    {
      id: 'v015',
      nome: 'Normalização Nome Cliente',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Aplica limpeza e normalização de nomes de clientes: remove sufixos como "- TELE", "-CT", "-MR", "_PLANTÃO", "_RMX" e mapeia variações como CEDI-* para CEDIDIAG.',
      status: 'ativa',
      implementadaEm: '2024-02-15',
      observacoes: 'Trigger: trigger_limpar_nome_cliente, Função: limpar_nome_cliente()',
      ordem_execucao: 14,
      tipo_regra: 'negocio'
    },
    {
      id: 'v017',
      nome: 'Normalização Nome Médico',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Remove códigos entre parênteses (E1, E2, E3), prefixos DR/DRA, pontos finais e limpa espaços extras dos nomes de médicos.',
      status: 'ativa',
      implementadaEm: '2024-02-16',
      observacoes: 'Trigger: trigger_normalizar_medico, Função: normalizar_medico()',
      ordem_execucao: 15,
      tipo_regra: 'negocio'
    },
    {
      id: 'v018',
      nome: 'De-Para Prioridades',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Aplica mapeamento de prioridades usando tabela de_para_prioridade para padronizar valores de prioridade.',
      status: 'ativa',
      implementadaEm: '2024-02-17',
      observacoes: 'Trigger: aplicar_prioridades_de_para, Tabela: de_para_prioridade',
      ordem_execucao: 16,
      tipo_regra: 'negocio'
    },
    {
      id: 'v019',
      nome: 'Aplicação Valor Onco',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Aplica valores específicos para exames oncológicos baseado em regras especiais para a categoria "onco".',
      status: 'ativa',
      implementadaEm: '2024-02-18',
      observacoes: 'Trigger: aplicar_valor_onco, aplicado apenas para arquivo volumetria_onco_padrao',
      ordem_execucao: 17,
      tipo_regra: 'negocio'
    },
    {
      id: 'v020',
      nome: 'Regras de Exclusão Dinâmica',
      modulo: 'volumetria',
      categoria: 'exclusao',
      criterio: 'Aplica regras de exclusão configuradas dinamicamente baseadas em critérios JSON (empresa, modalidade, especialidade, categoria, médico).',
      status: 'ativa',
      implementadaEm: '2024-02-19',
      observacoes: 'Trigger: aplicar_regras_exclusao_dinamicas, Tabela: regras_exclusao_faturamento',
      ordem_execucao: 18,
      tipo_regra: 'exclusao'
    },
    {
      id: 'v021',
      nome: 'Validação Cliente Volumetria',
      modulo: 'volumetria',
      categoria: 'validacao',
      criterio: 'Valida se cliente existe no cadastro e está ativo antes de processar dados de volumetria.',
      status: 'ativa',
      implementadaEm: '2024-02-20',
      observacoes: 'Edge function: aplicar-validacao-cliente, RPC: aplicar_validacao_cliente_volumetria',
      ordem_execucao: 19,
      tipo_regra: 'negocio'
    },
    {
      id: 'v023',
      nome: 'Aplicação Especialidade Automática',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Define especialidade automaticamente baseado em regras de negócio quando não informada no arquivo.',
      status: 'ativa',
      implementadaEm: '2024-02-21',
      observacoes: 'Trigger: aplicar_especialidade_automatica',
      ordem_execucao: 20,
      tipo_regra: 'negocio'
    },
    {
      id: 'v024',
      nome: 'Definição Data Referência',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Define data de referência baseada no período de processamento selecionado para garantir consistência temporal dos dados.',
      status: 'ativa',
      implementadaEm: '2024-02-22',
      observacoes: 'Edge function: set-data-referencia-volumetria',
      ordem_execucao: 21,
      tipo_regra: 'negocio'
    },
    {
      id: 'v032',
      nome: 'Exclusão de Clientes Específicos',
      modulo: 'volumetria',
      categoria: 'exclusao',
      criterio: 'Exclui registros de clientes específicos: RADIOCOR_LOCAL, CLINICADIA_TC, CLINICA RADIOCOR, CLIRAM_LOCAL.',
      status: 'ativa',
      implementadaEm: '2024-03-15',
      observacoes: 'Edge function: aplicar-exclusao-clientes-especificos',
      ordem_execucao: 22,
      tipo_regra: 'exclusao'
    },
    {
      id: 'v033',
      nome: 'Substituição de Especialidade/Categoria por Cadastro de Exames',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Para exames com especialidades "Cardio com Score", "Corpo" ou "Onco Medicina Interna", substitui a especialidade e categoria pelos valores cadastrados na tabela cadastro_exames baseado no nome do exame.',
      status: 'ativa',
      implementadaEm: '2025-01-18',
      observacoes: 'Aplica-se aos arquivos 1,2,3,4 durante o processamento - Edge function: aplicar-substituicao-especialidade-categoria',
      ordem_execucao: 23,
      tipo_regra: 'negocio'
    },
    {
      id: 'v034',
      nome: 'ColunasxMusculoxNeuro com Normalização Avançada',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Todos os exames com especialidade "Colunas" são alterados para "Músculo Esquelético", exceto para médicos específicos (43 médicos) que são alterados para "Neuro". Aplica categoria conforme cadastro de exames. Inclui normalização avançada de nomes: remove "Dr." e "Dra.", considera nomes abreviados (ex: "Francisca R" identifica "Francisca Rocélia Silva de Freitas").',
      status: 'ativa',
      implementadaEm: '2024-08-20',
      observacoes: 'Edge function: aplicar-regra-colunas-musculo-neuro. Normalização inteligente: compara nome completo vs abreviado, verifica iniciais e correspondência por posição. Lista de 43 médicos pré-configurada.',
      ordem_execucao: 24,
      tipo_regra: 'negocio'
    },

    // FATURAMENTO - Ordem de execução
    {
      id: 'f004',
      nome: 'Cálculo de Valores Contratuais',
      modulo: 'faturamento',
      categoria: 'calculo',
      criterio: 'Aplica tabela de preços e configurações contratuais para calcular valores.',
      status: 'ativa',
      implementadaEm: '2024-01-28',
      ordem_execucao: 1,
      tipo_regra: 'negocio'
    },
    {
      id: 'f007',
      nome: 'Seleção de Faixa de Volumetria (Preço por Volume)',
      modulo: 'faturamento',
      categoria: 'calculo',
      criterio: 'Seleciona a faixa de preço conforme volume total e arranjo Modalidade + Especialidade + Categoria (+ Prioridade opcional): filtra precos_servicos por esses campos; escolhe a faixa onde volume_inicial <= volume_total <= volume_final (limites nulos permitem faixa aberta); prioriza match exato de prioridade e, em empate, a maior volume_inicial; aplica valor_urgencia quando Prioridade = Urgência/Plantão ou quando considera_prioridade_plantao estiver ativa; caso contrário usa valor_base.',
      status: 'ativa',
      implementadaEm: '2025-08-11',
      observacoes: 'Implementada na função SQL public.calcular_preco_exame (Postgres).',
      ordem_execucao: 1,
      tipo_regra: 'negocio'
    },
    {
      id: 'f001',
      nome: 'Geração Automática de Faturas',
      modulo: 'faturamento',
      categoria: 'automacao',
      criterio: 'Gera faturas automaticamente baseado nos exames realizados e valores contratuais.',
      status: 'ativa',
      implementadaEm: '2024-01-25',
      ordem_execucao: 2,
      tipo_regra: 'negocio'
    },
    {
      id: 'f002',
      nome: 'Integração OMIE',
      modulo: 'faturamento',
      categoria: 'integracao',
      criterio: 'Sincroniza dados de faturamento com sistema OMIE para controle fiscal.',
      status: 'ativa',
      implementadaEm: '2024-01-20',
      ordem_execucao: 3,
      tipo_regra: 'negocio'
    },
    {
      id: 'f005',
      nome: 'Tipificação de Faturamento - Clientes NC Originais',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Define tipificação para 10 clientes NC originais: CDICARDIO, CDIGOIAS, CISP, CLIRAM, CRWANDERLEY, DIAGMAX-PR, GOLD, PRODIMAGEM, TRANSDUSON, ZANELLO. NC-FT para especialidade CARDIO, ou prioridade PLANTÃO, ou quando ESTUDO_DESCRICAO for "ANGIOTC VENOSA TORAX CARDIOLOGIA" ou "RM CRANIO NEUROBRAIN".',
      status: 'ativa',
      implementadaEm: '2025-01-07',
      observacoes: 'Implementado em utils/tipoFaturamento.ts - aplica automaticamente na volumetria e faturamento',
      ordem_execucao: 4,
      tipo_regra: 'negocio'
    },
    {
      id: 'f006',
      nome: 'Tipificação de Faturamento - Clientes NC Adicionais',
      modulo: 'volumetria',
      categoria: 'dados',
      criterio: 'Define tipificação para 3 clientes NC adicionais: CEMVALENCA, RMPADUA, RADI-IMAGEM. NC-FT para: especialidades CARDIO/MEDICINA INTERNA/NEUROBRAIN, prioridade PLANTÃO, 29 médicos específicos, ou especialidade MAMA (apenas RADI-IMAGEM).',
      status: 'ativa',
      implementadaEm: '2025-01-07',
      observacoes: 'Extensão da regra F005 com critérios adicionais por médico e especialidade MAMA para RADI-IMAGEM',
      ordem_execucao: 5,
      tipo_regra: 'negocio'
    },

    // CLIENTES - Ordem de execução
    {
      id: 'c001',
      nome: 'Validação de CNPJ',
      modulo: 'clientes',
      categoria: 'validacao',
      criterio: 'Valida formato e autenticidade do CNPJ do cliente antes do cadastro.',
      status: 'ativa',
      implementadaEm: '2024-01-18',
      ordem_execucao: 1,
      tipo_regra: 'negocio'
    },
    {
      id: 'c002',
      nome: 'Validação de Contratos',
      modulo: 'clientes',
      categoria: 'validacao',
      criterio: 'Verifica vigência de contratos e configurações antes de permitir faturamento.',
      status: 'ativa',
      implementadaEm: '2024-01-22',
      ordem_execucao: 2,
      tipo_regra: 'negocio'
    },

    // PREÇOS - Ordem de execução
    {
      id: 'p001',
      nome: 'Aplicação de Tabela Padrão',
      modulo: 'precos',
      categoria: 'calculo',
      criterio: 'Aplica tabela de preços padrão quando não há configuração específica.',
      status: 'ativa',
      implementadaEm: '2024-01-20',
      ordem_execucao: 1,
      tipo_regra: 'negocio'
    },
    {
      id: 'p002',
      nome: 'Aplicação de Descontos/Acréscimos',
      modulo: 'precos',
      categoria: 'calculo',
      criterio: 'Aplica percentuais de desconto ou acréscimo conforme contrato.',
      status: 'ativa',
      implementadaEm: '2024-01-22',
      ordem_execucao: 2,
      tipo_regra: 'negocio'
    },

    // REPASSES - Ordem de execução
    {
      id: 'r001',
      nome: 'Cálculo de Repasse Médico',
      modulo: 'repasses',
      categoria: 'calculo',
      criterio: 'Calcula valores de repasse baseado na tabela de percentuais por médico.',
      status: 'ativa',
      implementadaEm: '2024-01-25',
      ordem_execucao: 1,
      tipo_regra: 'negocio'
    },

    // EXAMES - Ordem de execução
    {
      id: 'ex001',
      nome: 'Validação de Modalidade',
      modulo: 'exames',
      categoria: 'validacao',
      criterio: 'Valida se a modalidade do exame existe no cadastro.',
      status: 'ativa',
      implementadaEm: '2024-01-20',
      ordem_execucao: 1,
      tipo_regra: 'negocio'
    },
    {
      id: 'ex002',
      nome: 'Validação de Especialidade',
      modulo: 'exames',
      categoria: 'validacao',
      criterio: 'Valida se a especialidade do exame existe no cadastro.',
      status: 'ativa',
      implementadaEm: '2024-01-20',
      ordem_execucao: 2,
      tipo_regra: 'negocio'
    },

    // MÉDICOS - Ordem de execução
    {
      id: 'm001',
      nome: 'Validação de CRM',
      modulo: 'medicos',
      categoria: 'validacao',
      criterio: 'Valida formato do CRM e especialidade médica cadastrada.',
      status: 'ativa',
      implementadaEm: '2024-01-15',
      ordem_execucao: 1,
      tipo_regra: 'negocio'
    },

    // ESCALAS - Ordem de execução
    {
      id: 'e001',
      nome: 'Proteção Temporal Escalas',
      modulo: 'escalas',
      categoria: 'temporal',
      criterio: 'Aplicação das mesmas regras temporais de volumetria para escalas médicas.',
      status: 'ativa',
      implementadaEm: '2024-01-15',
      ordem_execucao: 1,
      tipo_regra: 'negocio'
    },

    // SEGURANÇA - Ordem de execução
    {
      id: 's001',
      nome: 'Controle de Acesso por Perfil',
      modulo: 'seguranca',
      categoria: 'acesso',
      criterio: 'Define permissões específicas baseadas no perfil do usuário.',
      status: 'ativa',
      implementadaEm: '2024-01-10',
      ordem_execucao: 1,
      tipo_regra: 'negocio'
    },
    {
      id: 's002',
      nome: 'Auditoria de Operações',
      modulo: 'seguranca',
      categoria: 'acesso',
      criterio: 'Registra todas as operações críticas com identificação do usuário.',
      status: 'ativa',
      implementadaEm: '2024-01-08',
      ordem_execucao: 2,
      tipo_regra: 'negocio'
    },

    // SISTEMA - Regras básicas do sistema
    {
      id: 'sys001',
      nome: 'Controle de Acesso e Permissões',
      modulo: 'sistema',
      categoria: 'acesso',
      criterio: 'Sistema de roles e permissões para controlar acesso às funcionalidades.',
      status: 'ativa',
      implementadaEm: '2024-01-10',
      ordem_execucao: 1,
      tipo_regra: 'negocio'
    }
  ];

  const buscarRegrasExclusao = async () => {
    try {
      const { data, error } = await supabase
        .from('regras_exclusao_faturamento')
        .select('*')
        .order('prioridade', { ascending: true });

      if (error) {
        console.error('Erro ao buscar regras de exclusão:', error);
        return;
      }

      setRegrasExclusao(data || []);
    } catch (error) {
      console.error('Erro ao conectar com o banco:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buscarRegrasExclusao();
  }, []);

  // Converter regras de exclusão do banco para o formato padrão
  const regrasExclusaoFormatadas: Regra[] = regrasExclusao.map((regra, index) => ({
    id: `exc_${regra.id}`,
    nome: regra.nome_regra || 'Regra sem nome',
    modulo: determinarModulo(regra.nome_regra || ''),
    categoria: 'exclusao' as const,
    criterio: regra.descricao || 'Sem descrição',
    status: (regra.ativo !== false) ? 'ativa' as const : 'inativa' as const,
    implementadaEm: regra.created_at || new Date().toISOString(),
    observacoes: regra.prioridade || regra.acao || regra.motivo_exclusao 
      ? `${regra.prioridade ? `Prioridade: ${regra.prioridade}` : ''} ${regra.acao ? `| Ação: ${regra.acao}` : ''} ${regra.motivo_exclusao ? `| ${regra.motivo_exclusao}` : ''}`.replace(/^\s*\|\s*/, '') 
      : undefined,
    ordem_execucao: regra.prioridade || index + 1,
    tipo_regra: 'exclusao' as const
  }));

  // Todas as regras juntas
  const todasRegras = [...regrasNegocio, ...regrasExclusaoFormatadas];

  // Agrupar por módulo
  const regrasAgrupadas = todasRegras.reduce((acc, regra) => {
    if (!acc[regra.modulo]) {
      acc[regra.modulo] = [];
    }
    acc[regra.modulo].push(regra);
    return acc;
  }, {} as Record<string, Regra[]>);

  // Ordenar regras dentro de cada grupo por ordem de execução
  Object.keys(regrasAgrupadas).forEach(modulo => {
    regrasAgrupadas[modulo].sort((a, b) => a.ordem_execucao - b.ordem_execucao);
  });

  const toggleGrupo = (modulo: string) => {
    setGruposAbertos(prev => ({
      ...prev,
      [modulo]: !prev[modulo]
    }));
  };

  function determinarModulo(nomeRegra: string): Regra['modulo'] {
    const nome = nomeRegra.toLowerCase();
    if (nome.includes('volumetria') || nome.includes('volume') || nome.includes('upload')) return 'volumetria';
    if (nome.includes('faturamento') || nome.includes('fatura') || nome.includes('valor')) return 'faturamento';
    if (nome.includes('cliente')) return 'clientes';
    if (nome.includes('preço') || nome.includes('preco')) return 'precos';
    if (nome.includes('repasse')) return 'repasses';
    if (nome.includes('exame')) return 'exames';
    if (nome.includes('medico') || nome.includes('médico')) return 'medicos';
    if (nome.includes('escala')) return 'escalas';
    if (nome.includes('segurança') || nome.includes('seguranca')) return 'seguranca';
    if (nome.includes('sistema') || nome.includes('proteção') || nome.includes('temporal') || nome.includes('exclusão') || nome.includes('alerta')) return 'sistema';
  }

  const getModuleIcon = (modulo: Regra['modulo']) => {
    switch (modulo) {
      case 'volumetria': return <BarChart3 className="h-4 w-4" />;
      case 'faturamento': return <DollarSign className="h-4 w-4" />;
      case 'clientes': return <Users className="h-4 w-4" />;
      case 'precos': return <Calculator className="h-4 w-4" />;
      case 'repasses': return <FileText className="h-4 w-4" />;
      case 'exames': return <Stethoscope className="h-4 w-4" />;
      case 'medicos': return <Users className="h-4 w-4" />;
      case 'escalas': return <Clock className="h-4 w-4" />;
      case 'seguranca': return <CheckCircle className="h-4 w-4" />;
      case 'sistema': return <Settings className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const getModuleColor = (modulo: Regra['modulo']) => {
    switch (modulo) {
      case 'volumetria': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'faturamento': return 'bg-green-100 text-green-800 border-green-200';
      case 'clientes': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'precos': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'repasses': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'exames': return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'medicos': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'escalas': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'seguranca': return 'bg-red-100 text-red-800 border-red-200';
      case 'sistema': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTipoColor = (tipo: 'exclusao' | 'negocio') => {
    return tipo === 'exclusao' 
      ? 'bg-red-100 text-red-800 border-red-200'
      : 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const getStatusColor = (status: Regra['status']) => {
    switch (status) {
      case 'ativa': return 'bg-green-100 text-green-800 border-green-200';
      case 'inativa': return 'bg-red-100 text-red-800 border-red-200';
      case 'pendente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const contarRegras = (regras: Regra[]) => {
    const ativas = regras.filter(r => r.status === 'ativa').length;
    const exclusoes = regras.filter(r => r.tipo_regra === 'exclusao').length;
    return { total: regras.length, ativas, exclusoes };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando regras...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Controle de Regras - Sistema Completo
        </CardTitle>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>Total: {todasRegras.length} regras</span>
          <Separator orientation="vertical" className="h-4" />
          <span>Negócio: {regrasNegocio.length}</span>
          <span>Exclusão: {regrasExclusaoFormatadas.length}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(regrasAgrupadas).map(([modulo, regras]) => {
          const stats = contarRegras(regras);
          const isAberto = gruposAbertos[modulo];
          
          return (
            <Collapsible key={modulo} open={isAberto} onOpenChange={() => toggleGrupo(modulo)}>
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getModuleIcon(modulo as Regra['modulo'])}
                        {isAberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <h3 className="font-semibold capitalize">{modulo}</h3>
                        <Badge variant="outline" className={getModuleColor(modulo as Regra['modulo'])}>
                          {stats.total} regras
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                          {stats.ativas} ativas
                        </Badge>
                        {stats.exclusoes > 0 && (
                          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                            {stats.exclusoes} exclusões
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-2 space-y-2">
                {regras.map((regra) => (
                  <Card key={regra.id} className="ml-4">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">#{regra.ordem_execucao}</span>
                          <h4 className="font-medium">{regra.nome}</h4>
                          <Badge variant="outline" className={getTipoColor(regra.tipo_regra)}>
                            {regra.tipo_regra === 'exclusao' ? (
                              <><Trash2 className="h-3 w-3 mr-1" />Exclusão</>
                            ) : (
                              'Negócio'
                            )}
                          </Badge>
                        </div>
                        <Badge variant="outline" className={getStatusColor(regra.status)}>
                          {regra.status}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        <strong>ID:</strong> {regra.id}
                      </div>
                      
                      <div className="text-sm">
                        <strong>Critério:</strong> {regra.criterio}
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        <strong>Implementada em:</strong> {new Date(regra.implementadaEm).toLocaleDateString('pt-BR')}
                      </div>
                      
                      {regra.observacoes && (
                        <div className="text-sm bg-yellow-50 p-2 rounded border border-yellow-200">
                          <div className="flex items-center gap-1 text-yellow-800">
                            <AlertTriangle className="h-3 w-3" />
                            <strong>Observações:</strong>
                          </div>
                          <div className="text-yellow-700">{regra.observacoes}</div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}