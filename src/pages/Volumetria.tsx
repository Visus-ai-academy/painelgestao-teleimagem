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
import { BarChart3, Users, Clock, TrendingUp, FileText, Settings } from "lucide-react";
import { useVolumetriaDataFiltered } from "@/hooks/useVolumetriaDataFiltered";
import { ReprocessarTodasRegras } from "@/components/volumetria/ReprocessarTodasRegras";


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
  const { data, getFilteredData } = useVolumetria();
  const filtered = useVolumetriaDataFiltered(filters);
  
  // Extrair dados necessários
  const contextStats = data.dashboardStats;
  const loading = data.loading || filtered.loading;
  const hasData = (filtered.stats?.total_exames || 0) > 0;
  const filteredDetailed = useMemo(() => getFilteredData(filters), [getFilteredData, filters]);

  // Map filtered arrays to the DelayData shape expected by VolumetriaDelayAnalysis
  const atrasoClientesDelay = useMemo(() => (filtered.atrasoClientes || []).map(c => ({
    nome: c.nome,
    total_exames: c.total_exames,
    atrasados: c.atrasados,
    percentual_atraso: c.percentual_atraso,
  })), [filtered.atrasoClientes]);

  const atrasoModalidadesDelay = useMemo(() => (filtered.atrasoModalidades || []).map(m => ({
    nome: m.nome,
    total_exames: m.total_exames,
    atrasados: m.atrasados ?? 0,
    percentual_atraso: m.percentual_atraso ?? (m.total_exames > 0 ? ((m.atrasados ?? 0) / m.total_exames) * 100 : 0),
  })), [filtered.atrasoModalidades]);

  const atrasoEspecialidadesDelay = useMemo(() => (filtered.atrasoEspecialidades || []).map(e => ({
    nome: e.nome,
    total_exames: e.total_exames,
    atrasados: e.atrasados ?? 0,
    percentual_atraso: e.percentual_atraso ?? (e.total_exames > 0 ? ((e.atrasados ?? 0) / e.total_exames) * 100 : 0),
  })), [filtered.atrasoEspecialidades]);

  const atrasoPrioridadesDelay = useMemo(() => (filtered.atrasoPrioridades || []).map(p => ({
    nome: p.nome,
    total_exames: p.total_exames,
    atrasados: p.atrasados ?? 0,
    percentual_atraso: p.percentual_atraso ?? (p.total_exames > 0 ? ((p.atrasados ?? 0) / p.total_exames) * 100 : 0),
  })), [filtered.atrasoPrioridades]);

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
            <TabsList className="grid w-full grid-cols-6">
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
              <TabsTrigger value="processamento" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Processamento
              </TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="space-y-6">
              <VolumetriaExecutiveSummary
                override={{
                  clientes: filtered.clientes,
                  modalidades: filtered.modalidades,
                  especialidades: filtered.especialidades,
                  categorias: filtered.prioridades, // sem categorias dedicadas no hook
                  prioridades: filtered.prioridades,
                  medicos: filtered.medicos,
                  totalExames: filtered.stats.total_exames,
                  totalAtrasados: filtered.stats.total_atrasados,
                  percentualAtraso: filtered.stats.percentual_atraso,
                  loading
                }}
              />
            </TabsContent>

            <TabsContent value="volume" className="space-y-6">
              <VolumetriaStats stats={filtered.stats} />
              <VolumetriaCharts 
                clientes={filtered.clientes}
                modalidades={filtered.modalidades}
                especialidades={filtered.especialidades}
                categorias={[]}
                prioridades={filtered.prioridades}
              />
            </TabsContent>

            <TabsContent value="medicos" className="space-y-6">
              <VolumetriaMedicosAnalysis 
                medicos={filtered.medicos}
                modalidades={filtered.modalidades as any}
                especialidades={filtered.especialidades as any}
                categorias={[] as any}
                prioridades={filtered.prioridades as any}
                totalExames={filtered.stats.total_exames}
              />
            </TabsContent>

            <TabsContent value="atrasos" className="space-y-6">
              <VolumetriaDelayAnalysis 
                data={{
                  clientes: atrasoClientesDelay,
                  modalidades: atrasoModalidadesDelay,
                  especialidades: atrasoEspecialidadesDelay,
                  categorias: [],
                  prioridades: atrasoPrioridadesDelay,
                  totalAtrasados: filtered.stats.total_atrasados,
                  percentualAtrasoGeral: filtered.stats.percentual_atraso,
                  atrasosComTempo: filtered.atrasosComTempo
                }}
              />
            </TabsContent>

            <TabsContent value="clientes" className="space-y-6">
              <VolumetriaClientesAtrasados />
            </TabsContent>

            <TabsContent value="processamento" className="space-y-6">
              <ReprocessarTodasRegras />
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
