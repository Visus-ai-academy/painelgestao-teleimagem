import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVolumetriaDataFiltered, VolumetriaFilters } from '@/hooks/useVolumetriaDataFiltered';
import { VolumetriaStats } from '@/components/volumetria/VolumetriaStats';
import { VolumetriaAdvancedFilters } from '@/components/volumetria/VolumetriaAdvancedFilters';
import { VolumetriaNoData } from '@/components/volumetria/VolumetriaNoData';
import { VolumetriaCharts } from '@/components/volumetria/VolumetriaCharts';
import { VolumetriaDelayAnalysis } from '@/components/volumetria/VolumetriaDelayAnalysis';
import { VolumetriaExecutiveSummary } from '@/components/volumetria/VolumetriaExecutiveSummary';
import { VolumetriaMedicosAnalysis } from '@/components/volumetria/VolumetriaMedicosAnalysis';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


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
  
  const { 
    stats, 
    clientes, 
    modalidades, 
    especialidades, 
    prioridades,
    medicos,
    atrasoClientes,
    atrasoModalidades,
    atrasoEspecialidades,
    atrasoPrioridades,
    atrasosComTempo,
    loading, 
    refreshData
  } = useVolumetriaDataFiltered(filters);
  
  // Forçar refresh após mudanças no código
  useEffect(() => {
    console.log('🔄 [VOLUMETRIA PAGE] Forçando refresh dos dados...');
    const timer = setTimeout(() => {
      refreshData();
    }, 500);
    return () => clearTimeout(timer);
  }, [refreshData]);

  // Auto-refresh removido - atualização apenas via realtime e ações manuais
  
  const hasActiveFilters = Object.values(filters).some(value => value !== 'todos');
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
            {stats.total_clientes_volumetria} com dados no período
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
                  clientes,
                  modalidades,
                  especialidades
                }}
              />
            </TabsContent>

             <TabsContent value="charts" className="mt-6">
               <VolumetriaCharts 
                 clientes={clientes}
                 modalidades={modalidades}
                 especialidades={especialidades}
                 categorias={[]}
                 prioridades={prioridades}
               />
             </TabsContent>

             <TabsContent value="medicos" className="mt-6">
               <VolumetriaMedicosAnalysis 
                 medicos={medicos}
                 modalidades={modalidades}
                 especialidades={especialidades}
                 categorias={[]}
                 prioridades={prioridades}
                 totalExames={stats.total_exames}
               />
             </TabsContent>

             <TabsContent value="delays" className="mt-6">
               <VolumetriaDelayAnalysis 
                 data={{
                   clientes: atrasoClientes,
                   modalidades: atrasoModalidades.map(m => ({...m, atrasados: m.atrasados || 0, percentual_atraso: m.percentual_atraso || 0})),
                   especialidades: atrasoEspecialidades.map(e => ({...e, atrasados: e.atrasados || 0, percentual_atraso: e.percentual_atraso || 0})),
                   categorias: [],
                   prioridades: atrasoPrioridades.map(p => ({...p, atrasados: p.atrasados || 0, percentual_atraso: p.percentual_atraso || 0})),
                   totalAtrasados: stats.total_atrasados,
                   percentualAtrasoGeral: stats.percentual_atraso,
                   atrasosComTempo: atrasosComTempo
                 }}
               />
             </TabsContent>
          </Tabs>
        </>
      )}

    
    </div>
  );
}