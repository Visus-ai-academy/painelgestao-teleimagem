import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { VolumetriaStats } from "@/components/volumetria/VolumetriaStats";
import { VolumetriaCharts } from "@/components/volumetria/VolumetriaCharts";
import { VolumetriaAdvancedFilters, VolumetriaFilters } from "@/components/volumetria/VolumetriaAdvancedFilters";
import { VolumetriaClientesAtrasados } from "@/components/volumetria/VolumetriaClientesAtrasados";
import { VolumetriaDelayAnalysis } from "@/components/volumetria/VolumetriaDelayAnalysis";
import { VolumetriaExecutiveSummary } from "@/components/volumetria/VolumetriaExecutiveSummary";
import { VolumetriaMedicosAnalysis } from "@/components/volumetria/VolumetriaMedicosAnalysis";
import { VolumetriaNoData } from "@/components/volumetria/VolumetriaNoData";
import { useVolumetria } from "@/contexts/VolumetriaContext";
import { BarChart3, Users, Clock, TrendingUp, FileText } from "lucide-react";

export default function Volumetria() {
  const [filters, setFilters] = useState<VolumetriaFilters>({
    ano: "todos",
    trimestre: "todos", 
    mes: "todos",
    semana: "todos",
    dia: "todos",
    dataEspecifica: null,
    cliente: "todos",
    tipoCliente: "todos",
    tipoFaturamento: "todos",
    modalidade: "todos",
    especialidade: "todos",
    categoria: "todos",
    prioridade: "todos",
    medico: "todos"
  });
  
  // Usar o contexto otimizado que já tem dados em cache
  const { data } = useVolumetria();
  
  // Extrair dados necessários do contexto
  const stats = data.dashboardStats;
  const loading = data.loading;
  const hasData = stats.total_exames > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-8">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Volumetria</h1>
          <p className="text-muted-foreground">
            Análise completa de volumetria de exames médicos
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <VolumetriaAdvancedFilters
              filters={filters}
              onFiltersChange={setFilters}
            />
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : hasData ? (
          <Tabs defaultValue="resumo" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="resumo" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Resumo Executivo
              </TabsTrigger>
              <TabsTrigger value="volume" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Análise Volume
              </TabsTrigger>
              <TabsTrigger value="medicos" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Análise Médicos
              </TabsTrigger>
              <TabsTrigger value="atrasos" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Análise Atrasos
              </TabsTrigger>
              <TabsTrigger value="clientes" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Clientes Atrasados
              </TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="space-y-6">
              <VolumetriaExecutiveSummary />
            </TabsContent>

            <TabsContent value="volume" className="space-y-6">
              <VolumetriaStats stats={{
                ...stats,
                total_clientes_volumetria: stats.total_clientes_volumetria
              }} />
              <VolumetriaCharts 
                clientes={[]}
                modalidades={[]}
                especialidades={[]}
                categorias={[]}
                prioridades={[]}
              />
            </TabsContent>

            <TabsContent value="medicos" className="space-y-6">
              <VolumetriaMedicosAnalysis 
                medicos={[]}
                modalidades={[]}
                especialidades={[]}
                categorias={[]}
                prioridades={[]}
                totalExames={stats.total_exames}
              />
            </TabsContent>

            <TabsContent value="atrasos" className="space-y-6">
              <VolumetriaDelayAnalysis 
                data={{
                  clientes: [],
                  modalidades: [],
                  especialidades: [],
                  categorias: [],
                  prioridades: [],
                  totalAtrasados: stats.total_atrasados,
                  percentualAtrasoGeral: stats.percentual_atraso
                }}
              />
            </TabsContent>

            <TabsContent value="clientes" className="space-y-6">
              <VolumetriaClientesAtrasados />
            </TabsContent>

          </Tabs>
        ) : (
          <VolumetriaNoData 
            hasActiveFilters={Object.values(filters).some(f => f !== "todos" && f !== null)}
            onClearFilters={() => {
              setFilters({
                ano: "todos",
                trimestre: "todos", 
                mes: "todos",
                semana: "todos",
                dia: "todos",
                dataEspecifica: null,
                cliente: "todos",
                tipoCliente: "todos",
                tipoFaturamento: "todos",
                modalidade: "todos",
                especialidade: "todos",
                categoria: "todos",
                prioridade: "todos",
                medico: "todos"
              });
            }}
          />
        )}

      </div>
    </div>
  );
}
