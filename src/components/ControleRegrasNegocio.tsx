import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, AlertTriangle, CheckCircle, Clock, Users } from "lucide-react";

interface Regra {
  id: string;
  nome: string;
  modulo: 'volumetria' | 'faturamento' | 'clientes' | 'medicos' | 'escalas' | 'sistema' | 'seguranca';
  categoria: 'temporal' | 'dados' | 'validacao' | 'calculo' | 'acesso' | 'integracao' | 'automacao';
  criterio: string;
  status: 'ativa' | 'inativa' | 'pendente';
  implementadaEm: string;
  observacoes?: string;
}

const regrasImplementadas: Regra[] = [
  // VOLUMETRIA
  {
    id: 'v001',
    nome: 'Proteção Temporal de Dados',
    modulo: 'volumetria',
    categoria: 'temporal',
    criterio: 'Impede edição de dados com mais de 5 dias do mês anterior. Bloqueia inserção de dados futuros.',
    status: 'ativa',
    implementadaEm: '2024-01-15',
    observacoes: 'Configurável via tabela configuracao_protecao'
  },
  {
    id: 'v002',
    nome: 'Validação de Atraso de Laudos',
    modulo: 'volumetria',
    categoria: 'validacao',
    criterio: 'Identifica exames com atraso quando DATA_LAUDO > DATA_PRAZO. Calcula percentual de atraso.',
    status: 'ativa',
    implementadaEm: '2024-01-10'
  },
  {
    id: 'v003',
    nome: 'Filtro por Período',
    modulo: 'volumetria',
    categoria: 'dados',
    criterio: 'Permite filtrar dados por períodos pré-definidos (Hoje, Ontem, Última Semana, etc.) ou período customizado.',
    status: 'ativa',
    implementadaEm: '2024-01-08'
  },
  {
    id: 'v004',
    nome: 'Segmentação por Cliente',
    modulo: 'volumetria',
    categoria: 'dados',
    criterio: 'Filtra dados por cliente específico ou exibe todos. Lista clientes únicos disponíveis.',
    status: 'ativa',
    implementadaEm: '2024-01-05'
  },
  {
    id: 'v005',
    nome: 'Agregação por Modalidade',
    modulo: 'volumetria',
    categoria: 'dados',
    criterio: 'Agrupa exames por modalidade, calcula totais e percentuais para análise comparativa.',
    status: 'ativa',
    implementadaEm: '2024-01-03'
  },
  {
    id: 'v006',
    nome: 'Agregação por Especialidade',
    modulo: 'volumetria',
    categoria: 'dados',
    criterio: 'Agrupa exames por especialidade médica, calcula estatísticas de volume.',
    status: 'ativa',
    implementadaEm: '2024-01-03'
  },
  {
    id: 'v007',
    nome: 'Comparação entre Arquivos',
    modulo: 'volumetria',
    categoria: 'validacao',
    criterio: 'Identifica clientes presentes em um arquivo mas ausentes em outro para validação de consistência.',
    status: 'ativa',
    implementadaEm: '2024-01-20'
  },
  {
    id: 'v008',
    nome: 'Cache de Performance',
    modulo: 'volumetria',
    categoria: 'dados',
    criterio: 'Utiliza cache para otimizar consultas grandes, refresh automático a cada 5 minutos.',
    status: 'ativa',
    implementadaEm: '2024-01-12'
  },
  {
    id: 'v009',
    nome: 'Tratamento de Arquivo 1 - Data de Exame',
    modulo: 'volumetria',
    categoria: 'dados',
    criterio: 'Processa dados do primeiro arquivo de upload, extrai DATA_REALIZACAO e converte para formato padrão.',
    status: 'ativa',
    implementadaEm: '2024-01-25'
  },
  {
    id: 'v010',
    nome: 'Tratamento de Arquivo 2 - Data de Laudo',
    modulo: 'volumetria',
    categoria: 'dados',
    criterio: 'Processa dados do segundo arquivo de upload, extrai DATA_LAUDO e DATA_PRAZO para análise de prazo.',
    status: 'ativa',
    implementadaEm: '2024-01-25'
  },
  {
    id: 'v011',
    nome: 'Tratamento de Arquivo 3 - Valores e Prioridades',
    modulo: 'volumetria',
    categoria: 'dados',
    criterio: 'Processa dados do terceiro arquivo, extrai VALORES e PRIORIDADE para cálculos financeiros.',
    status: 'ativa',
    implementadaEm: '2024-01-25'
  },
  {
    id: 'v012',
    nome: 'Tratamento de Arquivo 4 - Dados Complementares',
    modulo: 'volumetria',
    categoria: 'dados',
    criterio: 'Processa dados do quarto arquivo, extrai informações complementares como MEDICO, ESPECIALIDADE e STATUS.',
    status: 'ativa',
    implementadaEm: '2024-01-25'
  },
  {
    id: 'v013',
    nome: 'Validação de Formato Excel',
    modulo: 'volumetria',
    categoria: 'validacao',
    criterio: 'Valida estrutura dos arquivos Excel antes do processamento, verifica colunas obrigatórias.',
    status: 'ativa',
    implementadaEm: '2024-01-20'
  },
  {
    id: 'v014',
    nome: 'Mapeamento Dinâmico de Campos',
    modulo: 'volumetria',
    categoria: 'dados',
    criterio: 'Utiliza tabela field_mappings para mapear colunas do arquivo para campos do banco de dados.',
    status: 'ativa',
    implementadaEm: '2024-01-18'
  },
  {
    id: 'v015',
    nome: 'Limpeza de Dados Duplicados',
    modulo: 'volumetria',
    categoria: 'dados',
    criterio: 'Remove dados duplicados baseado em ACCESSION_NUMBER antes da inserção no banco.',
    status: 'ativa',
    implementadaEm: '2024-01-22'
  },
  {
    id: 'v016',
    nome: 'Processamento em Lotes',
    modulo: 'volumetria',
    categoria: 'dados',
    criterio: 'Processa uploads em lotes de 1000 registros para otimizar performance e evitar timeouts.',
    status: 'ativa',
    implementadaEm: '2024-01-15'
  },
  {
    id: 'v017',
    nome: 'Log de Upload e Auditoria',
    modulo: 'volumetria',
    categoria: 'dados',
    criterio: 'Registra todos os uploads na tabela upload_logs com status, erros e estatísticas de processamento.',
    status: 'ativa',
    implementadaEm: '2024-01-10'
  },
  
  // FATURAMENTO
  {
    id: 'f001',
    nome: 'Geração Automática de Faturas',
    modulo: 'faturamento',
    categoria: 'automacao',
    criterio: 'Gera faturas automaticamente baseado nos exames realizados e valores contratuais.',
    status: 'ativa',
    implementadaEm: '2024-01-25'
  },
  {
    id: 'f002',
    nome: 'Integração OMIE',
    modulo: 'faturamento',
    categoria: 'integracao',
    criterio: 'Sincroniza dados de faturamento com sistema OMIE para controle fiscal.',
    status: 'ativa',
    implementadaEm: '2024-01-20'
  },
  
  // CLIENTES
  {
    id: 'c001',
    nome: 'Validação de CNPJ',
    modulo: 'clientes',
    categoria: 'validacao',
    criterio: 'Valida formato e autenticidade do CNPJ do cliente antes do cadastro.',
    status: 'ativa',
    implementadaEm: '2024-01-18'
  },
  
  // MÉDICOS
  {
    id: 'm001',
    nome: 'Validação de CRM',
    modulo: 'medicos',
    categoria: 'validacao',
    criterio: 'Valida formato do CRM e especialidade médica cadastrada.',
    status: 'ativa',
    implementadaEm: '2024-01-15'
  },
  
  // ESCALAS
  {
    id: 'e001',
    nome: 'Proteção Temporal Escalas',
    modulo: 'escalas',
    categoria: 'temporal',
    criterio: 'Aplicação das mesmas regras temporais de volumetria para escalas médicas.',
    status: 'ativa',
    implementadaEm: '2024-01-15'
  },
  
  // SEGURANÇA
  {
    id: 's001',
    nome: 'Controle de Acesso por Perfil',
    modulo: 'seguranca',
    categoria: 'acesso',
    criterio: 'Define permissões específicas baseadas no perfil do usuário (admin, manager, médico).',
    status: 'ativa',
    implementadaEm: '2024-01-10'
  },
  {
    id: 's002',
    nome: 'Auditoria de Operações',
    modulo: 'seguranca',
    categoria: 'acesso',
    criterio: 'Registra todas as operações críticas com identificação do usuário, timestamp e dados alterados.',
    status: 'ativa',
    implementadaEm: '2024-01-08'
  }
];

const getModuleIcon = (modulo: Regra['modulo']) => {
  switch (modulo) {
    case 'volumetria':
      return <Settings className="h-4 w-4" />;
    case 'faturamento':
      return <Users className="h-4 w-4" />;
    case 'clientes':
      return <Users className="h-4 w-4" />;
    case 'medicos':
      return <Users className="h-4 w-4" />;
    case 'escalas':
      return <Clock className="h-4 w-4" />;
    case 'sistema':
      return <Settings className="h-4 w-4" />;
    case 'seguranca':
      return <CheckCircle className="h-4 w-4" />;
    default:
      return <Settings className="h-4 w-4" />;
  }
};

const getCategoryIcon = (categoria: Regra['categoria']) => {
  switch (categoria) {
    case 'temporal':
      return <Clock className="h-4 w-4" />;
    case 'dados':
      return <Settings className="h-4 w-4" />;
    case 'validacao':
      return <CheckCircle className="h-4 w-4" />;
    case 'calculo':
      return <Settings className="h-4 w-4" />;
    case 'acesso':
      return <Users className="h-4 w-4" />;
    case 'integracao':
      return <Settings className="h-4 w-4" />;
    case 'automacao':
      return <Settings className="h-4 w-4" />;
    default:
      return <Settings className="h-4 w-4" />;
  }
};

const getStatusColor = (status: Regra['status']) => {
  switch (status) {
    case 'ativa':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'inativa':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'pendente':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getModuleColor = (modulo: Regra['modulo']) => {
  switch (modulo) {
    case 'volumetria':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'faturamento':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'clientes':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medicos':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'escalas':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'sistema':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'seguranca':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getCategoryColor = (categoria: Regra['categoria']) => {
  switch (categoria) {
    case 'temporal':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'dados':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'validacao':
      return 'bg-teal-100 text-teal-800 border-teal-200';
    case 'calculo':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'acesso':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'integracao':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'automacao':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export function ControleRegrasNegocio() {
  const modulosEstatisticas = regrasImplementadas.reduce((acc, regra) => {
    acc[regra.modulo] = (acc[regra.modulo] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusEstatisticas = regrasImplementadas.reduce((acc, regra) => {
    acc[regra.status] = (acc[regra.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Controle de Regras de Negócio - Sistema Completo
        </CardTitle>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>Total: {regrasImplementadas.length} regras</span>
          <Separator orientation="vertical" className="h-4" />
          <span>Volumetria: {modulosEstatisticas.volumetria || 0}</span>
          <span>Faturamento: {modulosEstatisticas.faturamento || 0}</span>
          <span>Clientes: {modulosEstatisticas.clientes || 0}</span>
          <span>Médicos: {modulosEstatisticas.medicos || 0}</span>
          <span>Escalas: {modulosEstatisticas.escalas || 0}</span>
          <span>Segurança: {modulosEstatisticas.seguranca || 0}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {regrasImplementadas.map((regra) => (
          <div key={regra.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {getModuleIcon(regra.modulo)}
                <h4 className="font-medium">{regra.nome}</h4>
                <Badge 
                  variant="outline" 
                  className={getModuleColor(regra.modulo)}
                >
                  {regra.modulo}
                </Badge>
                <Badge 
                  variant="outline" 
                  className={getCategoryColor(regra.categoria)}
                >
                  {regra.categoria}
                </Badge>
              </div>
              <Badge 
                variant="outline" 
                className={getStatusColor(regra.status)}
              >
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
          </div>
        ))}
        
        <Separator />
        
        <div className="text-sm text-muted-foreground">
          <p className="flex items-center gap-1">
            <Settings className="h-3 w-3" />
            <strong>Próximas implementações:</strong> Regras de cobrança automática, Validação de dados duplicados, Alertas automáticos por e-mail, Integração com APIs externas
          </p>
        </div>
      </CardContent>
    </Card>
  );
}