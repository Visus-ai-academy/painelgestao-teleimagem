import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useVolumetriaDataFiltered, VolumetriaFilters } from '@/hooks/useVolumetriaDataFiltered';
import { VolumetriaStats } from '@/components/volumetria/VolumetriaStats';
import { VolumetriaAdvancedFilters } from '@/components/volumetria/VolumetriaAdvancedFilters';
import { VolumetriaNoData } from '@/components/volumetria/VolumetriaNoData';
import { VolumetriaCharts } from '@/components/volumetria/VolumetriaCharts';
import { VolumetriaUploadStats } from '@/components/volumetria/VolumetriaUploadStats';
import { VolumetriaClientesComparison } from '@/components/volumetria/VolumetriaClientesComparison';
import { VolumetriaExamesNaoIdentificados } from '@/components/volumetria/VolumetriaExamesNaoIdentificados';


// Função para obter filtros padrão para o mês atual
const getDefaultFilters = (): VolumetriaFilters => {
  const now = new Date();
  const currentYear = now.getFullYear().toString();
  const currentMonth = (now.getMonth() + 1).toString();
  
  return {
    ano: currentYear,
    trimestre: 'todos',
    mes: currentMonth,
    semana: 'todos',
    dia: 'todos',
    dataEspecifica: null,
    cliente: 'todos',
    modalidade: 'todos',
    especialidade: 'todos',
    categoria: 'todos',
    prioridade: 'todos',
    medico: 'todos'
  };
};

export default function Volumetria() {
  const [filters, setFilters] = useState<VolumetriaFilters>(getDefaultFilters());
  
  const { stats, clientes, modalidades, especialidades, loading, refreshData } = useVolumetriaDataFiltered(filters);
  
  // Forçar refresh após mudanças no código
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshData();
    }, 500);
    return () => clearTimeout(timer);
  }, [refreshData]);
  
  const hasActiveFilters = Object.values(filters).some(value => value !== 'todos');
  const hasNoData = stats.total_registros === 0;

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
      <div>
        <h1 className="text-3xl font-bold">Dashboard Volumetria</h1>
        <p className="text-muted-foreground mt-1">
          Análise executiva completa de volumetria - 
          {stats.total_registros.toLocaleString()} registros | 
          {stats.total_clientes} clientes
        </p>
      </div>

      {/* Estatísticas dos Uploads */}
      <VolumetriaUploadStats />

      {/* Exames Não Identificados no De Para */}
      <VolumetriaExamesNaoIdentificados />

      {/* Comparação de Clientes */}
      <VolumetriaClientesComparison />

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

          {/* Gráficos */}
          <VolumetriaCharts 
            clientes={clientes}
            modalidades={modalidades}
            especialidades={especialidades}
          />
        </>
      )}

    
    </div>
  );
}