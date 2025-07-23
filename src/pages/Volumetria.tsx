import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { VolumetriaUpload } from '@/components/VolumetriaUpload';
import { useVolumetriaData } from '@/hooks/useVolumetriaData';
import { VolumetriaStats } from '@/components/volumetria/VolumetriaStats';
import { VolumetriaFilters } from '@/components/volumetria/VolumetriaFilters';
import { VolumetriaCharts } from '@/components/volumetria/VolumetriaCharts';

export default function Volumetria() {
  const [periodo, setPeriodo] = useState<string>("todos");
  const [cliente, setCliente] = useState<string>("todos");
  
  const { stats, clientes, modalidades, especialidades, listaClientes, loading, refreshData } = useVolumetriaData(periodo, cliente);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando dashboard completo...</p>
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

      {/* Controles */}
      <VolumetriaFilters 
        periodo={periodo}
        cliente={cliente}
        listaClientes={listaClientes}
        onPeriodoChange={setPeriodo}
        onClienteChange={setCliente}
      />

      {/* Métricas Principais */}
      <VolumetriaStats stats={stats} />

      {/* Gráficos */}
      <VolumetriaCharts 
        clientes={clientes}
        modalidades={modalidades}
        especialidades={especialidades}
      />

      {/* Upload Component */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload - Data Laudo</CardTitle>
          </CardHeader>
          <CardContent>
            <VolumetriaUpload 
              arquivoFonte="data_laudo" 
              onSuccess={refreshData} 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload - Data Exame</CardTitle>
          </CardHeader>
          <CardContent>
            <VolumetriaUpload 
              arquivoFonte="data_exame" 
              onSuccess={refreshData} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}