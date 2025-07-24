import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, AlertTriangle, CheckCircle, Clock, Users } from "lucide-react";

interface Regra {
  id: string;
  nome: string;
  categoria: 'temporal' | 'dados' | 'cliente' | 'validacao';
  criterio: string;
  status: 'ativa' | 'inativa' | 'pendente';
  implementadaEm: string;
  observacoes?: string;
}

const regrasImplementadas: Regra[] = [
  {
    id: 'r001',
    nome: 'Proteção Temporal de Dados',
    categoria: 'temporal',
    criterio: 'Impede edição de dados com mais de 5 dias do mês anterior. Bloqueia inserção de dados futuros.',
    status: 'ativa',
    implementadaEm: '2024-01-15',
    observacoes: 'Configurável via tabela configuracao_protecao'
  },
  {
    id: 'r002',
    nome: 'Validação de Atraso de Laudos',
    categoria: 'dados',
    criterio: 'Identifica exames com atraso quando DATA_LAUDO > DATA_PRAZO. Calcula percentual de atraso.',
    status: 'ativa',
    implementadaEm: '2024-01-10'
  },
  {
    id: 'r003',
    nome: 'Filtro por Período',
    categoria: 'dados',
    criterio: 'Permite filtrar dados por períodos pré-definidos (Hoje, Ontem, Última Semana, etc.) ou período customizado.',
    status: 'ativa',
    implementadaEm: '2024-01-08'
  },
  {
    id: 'r004',
    nome: 'Segmentação por Cliente',
    categoria: 'cliente',
    criterio: 'Filtra dados por cliente específico ou exibe todos. Lista clientes únicos disponíveis.',
    status: 'ativa',
    implementadaEm: '2024-01-05'
  },
  {
    id: 'r005',
    nome: 'Agregação por Modalidade',
    categoria: 'dados',
    criterio: 'Agrupa exames por modalidade, calcula totais e percentuais para análise comparativa.',
    status: 'ativa',
    implementadaEm: '2024-01-03'
  },
  {
    id: 'r006',
    nome: 'Agregação por Especialidade',
    categoria: 'dados',
    criterio: 'Agrupa exames por especialidade médica, calcula estatísticas de volume.',
    status: 'ativa',
    implementadaEm: '2024-01-03'
  },
  {
    id: 'r007',
    nome: 'Comparação entre Arquivos',
    categoria: 'validacao',
    criterio: 'Identifica clientes presentes em um arquivo mas ausentes em outro para validação de consistência.',
    status: 'ativa',
    implementadaEm: '2024-01-20'
  },
  {
    id: 'r008',
    nome: 'Cache de Performance',
    categoria: 'dados',
    criterio: 'Utiliza cache para otimizar consultas grandes, refresh automático a cada 5 minutos.',
    status: 'ativa',
    implementadaEm: '2024-01-12'
  }
];

const getCategoryIcon = (categoria: Regra['categoria']) => {
  switch (categoria) {
    case 'temporal':
      return <Clock className="h-4 w-4" />;
    case 'dados':
      return <Settings className="h-4 w-4" />;
    case 'cliente':
      return <Users className="h-4 w-4" />;
    case 'validacao':
      return <CheckCircle className="h-4 w-4" />;
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

const getCategoryColor = (categoria: Regra['categoria']) => {
  switch (categoria) {
    case 'temporal':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'dados':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'cliente':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'validacao':
      return 'bg-teal-100 text-teal-800 border-teal-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export function VolumetriaRegras() {
  const categoriasEstatisticas = regrasImplementadas.reduce((acc, regra) => {
    acc[regra.categoria] = (acc[regra.categoria] || 0) + 1;
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
          Regras de Negócio Implementadas
        </CardTitle>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>Total: {regrasImplementadas.length} regras</span>
          <Separator orientation="vertical" className="h-4" />
          <span>Ativas: {statusEstatisticas.ativa || 0}</span>
          <span>Inativas: {statusEstatisticas.inativa || 0}</span>
          <span>Pendentes: {statusEstatisticas.pendente || 0}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {regrasImplementadas.map((regra) => (
          <div key={regra.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {getCategoryIcon(regra.categoria)}
                <h4 className="font-medium">{regra.nome}</h4>
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
            <strong>Próximas implementações:</strong> Validação de integridade de dados, Regras de alerta automático, Filtros avançados por período customizado
          </p>
        </div>
      </CardContent>
    </Card>
  );
}