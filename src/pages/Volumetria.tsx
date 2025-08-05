import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VolumetriaStats } from '@/components/volumetria/VolumetriaStats';
import { VolumetriaAdvancedFilters } from '@/components/volumetria/VolumetriaAdvancedFilters';
import { VolumetriaNoData } from '@/components/volumetria/VolumetriaNoData';
import { VolumetriaCharts } from '@/components/volumetria/VolumetriaCharts';
import { VolumetriaDelayAnalysis } from '@/components/volumetria/VolumetriaDelayAnalysis';
import { VolumetriaExecutiveSummary } from '@/components/volumetria/VolumetriaExecutiveSummary';
import { VolumetriaMedicosAnalysis } from '@/components/volumetria/VolumetriaMedicosAnalysis';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVolumetria } from '@/contexts/VolumetriaContext';

interface VolumetriaFilters {
  ano: string;
  trimestre: string;
  mes: string;
  semana: string;
  dia: string;
  dataEspecifica?: Date | null;
  cliente: string;
  modalidade: string;
  especialidade: string;
  prioridade: string;
  medico: string;
}

interface ClienteData {
  nome: string;
  total_exames: number;
  total_registros: number;
  atrasados: number;
  percentual_atraso: number;
}

interface ModalidadeData {
  nome: string;
  total_exames: number;
  total_registros: number;
  percentual?: number;
}

interface EspecialidadeData {
  nome: string;
  total_exames: number;
  total_registros: number;
  percentual?: number;
}

// Função para obter filtros padrão - SEM FILTRO DE DATA
const getDefaultFilters = (): VolumetriaFilters => {
  return {
    ano: 'todos',
    trimestre: 'todos',
    mes: 'todos',
    semana: 'todos',
    dia: 'todos',
    dataEspecifica: null,
    cliente: 'todos',
    modalidade: 'todos',
    especialidade: 'todos',
    prioridade: 'todos',
    medico: 'todos'
  };
};

export default function Volumetria() {
  const [filters, setFilters] = useState<VolumetriaFilters>(getDefaultFilters());
  
  // Usar apenas dados do contexto centralizado
  const { data: contextData, refreshData, getFilteredData } = useVolumetria();
  
  // Logs de debug para identificar inconsistências
  console.log('🔥 [Volumetria] Dados completos do contexto:', contextData);
  console.log('📊 [Volumetria] Detalhes:', { 
    totalRegistros: contextData.detailedData?.length, 
    loading: contextData.loading,
    totalExames: contextData.dashboardStats.total_exames
  });
  console.log('📊 [Volumetria] Stats detalhadas:', contextData.stats);
  
  // Verificar se há filtros ativos
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'dataEspecifica') return value !== null;
    return value !== 'todos';
  });
  
  // Usar dados filtrados se há filtros ativos, senão usar dados completos do contexto
  const currentData = hasActiveFilters ? getFilteredData(filters) : contextData.detailedData;
  
  // Calcular estatísticas dinâmicas baseadas nos dados atuais
  const stats = hasActiveFilters ? {
    // Recalcular stats para dados filtrados
    total_exames: currentData.reduce((sum, item) => sum + (Number(item.VALORES) || 0), 0),
    total_registros: currentData.length,
    total_atrasados: currentData.filter(item => {
      if (!item.DATA_LAUDO || !item.HORA_LAUDO || !item.DATA_PRAZO || !item.HORA_PRAZO) return false;
      try {
        const dataLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
        const dataPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
        return dataLaudo > dataPrazo;
      } catch {
        return false;
      }
    }).length,
    percentual_atraso: currentData.length > 0 ? 
      (currentData.filter(item => {
        if (!item.DATA_LAUDO || !item.HORA_LAUDO || !item.DATA_PRAZO || !item.HORA_PRAZO) return false;
        try {
          const dataLaudo = new Date(`${item.DATA_LAUDO}T${item.HORA_LAUDO}`);
          const dataPrazo = new Date(`${item.DATA_PRAZO}T${item.HORA_PRAZO}`);
          return dataLaudo > dataPrazo;
        } catch {
          return false;
        }
      }).length / currentData.length) * 100 : 0,
    total_clientes: contextData.dashboardStats.total_clientes,
    total_clientes_volumetria: [...new Set(currentData.map(item => item.EMPRESA).filter(Boolean))].length,
    total_modalidades: [...new Set(currentData.map(item => item.MODALIDADE).filter(Boolean))].length,
    total_especialidades: [...new Set(currentData.map(item => item.ESPECIALIDADE).filter(Boolean))].length,
    total_medicos: [...new Set(currentData.map(item => item.MEDICO).filter(Boolean))].length,
    total_prioridades: [...new Set(currentData.map(item => item.PRIORIDADE).filter(Boolean))].length
  } : contextData.dashboardStats;
  
  const loading = contextData.loading;
  const hasNoData = stats.total_exames === 0;
  
  // Processar dados agregados para os componentes
  const clientesArray = Object.values(currentData.reduce((acc: Record<string, ClienteData>, item) => {
    const cliente = item.EMPRESA;
    if (!cliente) return acc;
    if (!acc[cliente]) {
      acc[cliente] = { nome: cliente, total_exames: 0, total_registros: 0, atrasados: 0, percentual_atraso: 0 };
    }
    acc[cliente].total_exames += Number(item.VALORES) || 0;
    acc[cliente].total_registros += 1;
    return acc;
  }, {})) as ClienteData[];
  
  const modalidadesArray = Object.values(currentData.reduce((acc: Record<string, ModalidadeData>, item) => {
    const modalidade = item.MODALIDADE;
    if (!modalidade) return acc;
    if (!acc[modalidade]) {
      acc[modalidade] = { nome: modalidade, total_exames: 0, total_registros: 0 };
    }
    acc[modalidade].total_exames += Number(item.VALORES) || 0;
    acc[modalidade].total_registros += 1;
    return acc;
  }, {})) as ModalidadeData[];
  
  const especialidadesArray = Object.values(currentData.reduce((acc: Record<string, EspecialidadeData>, item) => {
    const especialidade = item.ESPECIALIDADE;
    if (!especialidade) return acc;
    if (!acc[especialidade]) {
      acc[especialidade] = { nome: especialidade, total_exames: 0, total_registros: 0 };
    }
    acc[especialidade].total_exames += Number(item.VALORES) || 0;
    acc[especialidade].total_registros += 1;
    return acc;
  }, {})) as EspecialidadeData[];
  
  const categoriasArray = Object.values(currentData.reduce((acc: Record<string, ModalidadeData>, item) => {
    const categoria = item.CATEGORIA;
    if (!categoria) return acc;
    if (!acc[categoria]) {
      acc[categoria] = { nome: categoria, total_exames: 0, total_registros: 0 };
    }
    acc[categoria].total_exames += Number(item.VALORES) || 0;
    acc[categoria].total_registros += 1;
    return acc;
  }, {})) as ModalidadeData[];
  
  const prioridadesArray = Object.values(currentData.reduce((acc: Record<string, ModalidadeData>, item) => {
    const prioridade = item.PRIORIDADE;
    if (!prioridade) return acc;
    if (!acc[prioridade]) {
      acc[prioridade] = { nome: prioridade, total_exames: 0, total_registros: 0 };
    }
    acc[prioridade].total_exames += Number(item.VALORES) || 0;
    acc[prioridade].total_registros += 1;
    return acc;
  }, {})) as ModalidadeData[];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando dados de volumetria...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Volumetria</h1>
          <p className="text-muted-foreground mt-1">
            Análise executiva completa de volumetria - 
            {stats.total_exames.toLocaleString()} laudos | 
            {stats.total_clientes} clientes cadastrados | 
            {stats.total_clientes_volumetria} com dados{hasActiveFilters ? ' (filtrado)' : ''} |
            <span className="text-blue-600 font-medium"> Carregamento completo com paginação otimizada</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-muted-foreground">
            Última atualização: {new Date().toLocaleTimeString()}
          </span>
          <Button 
            onClick={() => {
              console.log('🔄 Refresh manual iniciado...');
              refreshData();
            }}
            variant="default" 
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar Dados
          </Button>
        </div>
      </div>

      {/* Filtros Avançados */}
      <VolumetriaAdvancedFilters 
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Verificar se há dados */}
      {hasNoData ? (
        <VolumetriaNoData 
          hasActiveFilters={hasActiveFilters}
          onClearFilters={() => setFilters(getDefaultFilters())}
        />
      ) : (
        <>
          {/* Métricas Principais */}
          <VolumetriaStats stats={stats} />

          {/* Dashboard Profissional com Tabs */}
          <Tabs defaultValue="executive" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="executive">Resumo Executivo</TabsTrigger>
              <TabsTrigger value="charts">Análise de Volume</TabsTrigger>
              <TabsTrigger value="medicos">Análise de Médicos</TabsTrigger>
              <TabsTrigger value="delays">Análise de Atrasos</TabsTrigger>
            </TabsList>

            <TabsContent value="executive" className="mt-6">
              <VolumetriaExecutiveSummary 
                data={{
                  stats,
                  clientes: [], // Processado internamente no componente usando contexto
                  modalidades: [], // Processado internamente no componente usando contexto
                  especialidades: [] // Processado internamente no componente usando contexto
                }}
              />
            </TabsContent>

            <TabsContent value="charts" className="mt-6">
              <VolumetriaCharts 
                clientes={clientesArray as any}
                modalidades={modalidadesArray as any}
                especialidades={especialidadesArray as any}
                categorias={categoriasArray as any}
                prioridades={prioridadesArray as any}
              />
            </TabsContent>

            <TabsContent value="medicos" className="mt-6">
              <VolumetriaMedicosAnalysis 
                medicos={[]}
                modalidades={[]}
                especialidades={[]}
                categorias={[]}
                prioridades={[]}
                totalExames={stats.total_exames}
              />
            </TabsContent>

            <TabsContent value="delays" className="mt-6">
              <VolumetriaDelayAnalysis 
                data={{
                  clientes: [],
                  modalidades: [],
                  especialidades: [],
                  categorias: [],
                  prioridades: [],
                  totalAtrasados: stats.total_atrasados,
                  percentualAtrasoGeral: stats.percentual_atraso,
                  atrasosComTempo: []
                }}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}