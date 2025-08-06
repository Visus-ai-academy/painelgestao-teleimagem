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
import { useVolumetriaProcessedData } from '@/hooks/useVolumetriaProcessedData';

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
  
  // USAR DADOS PROCESSADOS CENTRALIZADOS
  const { data: contextData, refreshData } = useVolumetria();
  const processedData = useVolumetriaProcessedData();
  
  // Verificar se CEDI_RJ está no resultado processado para validação
  const cediProcessado = processedData.clientes.find(c => c.nome === 'CEDI_RJ');
  if (cediProcessado && cediProcessado.total_exames > 1000) {
    console.log('✅ [Volumetria] CEDI_RJ dados corretos carregados');
  }
  
  // Verificar se há filtros ativos
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'dataEspecifica') return value !== null;
    return value !== 'todos';
  });
  
  // USAR DADOS PROCESSADOS EM VEZ DE REPROCESSAR
  const stats = contextData.dashboardStats;
  const loading = processedData.loading;
  const hasNoData = stats.total_exames === 0;

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
              console.log('🔥🔥🔥 USUÁRIO CLICOU EM REFRESH - FORÇANDO CARREGAMENTO TOTAL 🔥🔥🔥');
              console.log('🎯 META: Carregar todos os 35.337 registros definitivos do banco');
              console.log('⚡ Invalidando cache e forçando reload completo...');
              refreshData();
            }}
            variant="default" 
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            🔥 Forçar Dados Completos (35k+)
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
          <VolumetriaStats 
            stats={stats} 
            totalAtrasadosCorreto={processedData.totalAtrasados}
            percentualAtrasoCorreto={processedData.percentualAtraso}
          />

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
                clientes={processedData.clientes as any}
                modalidades={processedData.modalidades as any}
                especialidades={processedData.especialidades as any}
                categorias={processedData.categorias as any}
                prioridades={processedData.prioridades as any}
              />
            </TabsContent>

            <TabsContent value="medicos" className="mt-6">
              <VolumetriaMedicosAnalysis 
                medicos={processedData.medicos as any}
                modalidades={processedData.modalidades as any}
                especialidades={processedData.especialidades as any}
                categorias={processedData.categorias as any}
                prioridades={processedData.prioridades as any}
                totalExames={stats.total_exames}
              />
            </TabsContent>

            <TabsContent value="delays" className="mt-6">
              <VolumetriaDelayAnalysis 
                data={{
                  clientes: processedData.clientes as any,
                  modalidades: processedData.modalidades as any,
                  especialidades: processedData.especialidades as any,
                  categorias: processedData.categorias as any,
                  prioridades: processedData.prioridades as any,
                  totalAtrasados: processedData.totalAtrasados,
                  percentualAtrasoGeral: processedData.percentualAtraso,
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