import { useState, useEffect } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useVolumetriaDataFiltered, VolumetriaFilters } from '@/hooks/useVolumetriaDataFiltered';
import { VolumetriaStats } from '@/components/volumetria/VolumetriaStats';
import { VolumetriaAdvancedFilters } from '@/components/volumetria/VolumetriaAdvancedFilters';
import { VolumetriaNoData } from '@/components/volumetria/VolumetriaNoData';
import { VolumetriaCharts } from '@/components/volumetria/VolumetriaCharts';
import { VolumetriaUploadStats } from '@/components/volumetria/VolumetriaUploadStats';
import { VolumetriaClientesComparison } from '@/components/volumetria/VolumetriaClientesComparison';
import { VolumetriaExamesNaoIdentificados } from '@/components/volumetria/VolumetriaExamesNaoIdentificados';
import { VolumetriaStatusPanel } from '@/components/VolumetriaStatusPanel';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { limparDadosVolumetria } from "@/lib/supabase";


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
  const [isClearing, setIsClearing] = useState(false);
  const { toast } = useToast();
  
  const { stats, clientes, modalidades, especialidades, loading, refreshData } = useVolumetriaDataFiltered(filters);

  // Função para limpar dados de volumetria
  const handleLimparDados = async () => {
    setIsClearing(true);
    try {
      const arquivosParaLimpar = [
        'volumetria_padrao',
        'volumetria_fora_padrao', 
        'volumetria_padrao_retroativo',
        'volumetria_fora_padrao_retroativo'
      ];

      console.log('Iniciando limpeza dos dados de volumetria...');
      
      const resultado = await limparDadosVolumetria(arquivosParaLimpar);
      
      toast({
        title: "Dados limpos com sucesso!",
        description: `${resultado.registros_removidos} registros de volumetria removidos`,
      });

      console.log('Limpeza concluída:', resultado);
      
      // Atualizar os dados após a limpeza
      refreshData();
    } catch (error) {
      console.error('Erro ao limpar dados:', error);
      toast({
        title: "Erro ao limpar dados",
        description: "Ocorreu um erro ao tentar limpar os dados de volumetria",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };
  
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Volumetria</h1>
          <p className="text-muted-foreground mt-1">
            Análise executiva completa de volumetria - 
            {stats.total_registros.toLocaleString()} registros | 
            {stats.total_clientes} clientes
          </p>
        </div>
        <Button 
          onClick={handleLimparDados} 
          disabled={isClearing}
          variant="destructive"
          className="flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          {isClearing ? "Limpando..." : "Limpar Dados"}
        </Button>
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