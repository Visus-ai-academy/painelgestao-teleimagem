import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VolumetriaUpload } from "@/components/VolumetriaUpload";
import { VolumetriaStats } from "@/components/volumetria/VolumetriaStats";
import { VolumetriaCharts } from "@/components/volumetria/VolumetriaCharts";
import { VolumetriaFilters } from "@/components/volumetria/VolumetriaFilters";
import { VolumetriaClientesAtrasados } from "@/components/volumetria/VolumetriaClientesAtrasados";
import { VolumetriaDelayAnalysis } from "@/components/volumetria/VolumetriaDelayAnalysis";
import { VolumetriaExecutiveSummary } from "@/components/volumetria/VolumetriaExecutiveSummary";
import { VolumetriaMedicosAnalysis } from "@/components/volumetria/VolumetriaMedicosAnalysis";
import { VolumetriaNoData } from "@/components/volumetria/VolumetriaNoData";
import { useVolumetriaData } from "@/hooks/useVolumetriaData";
import { Upload, BarChart3, Users, Clock, TrendingUp, FileText } from "lucide-react";

export default function Volumetria() {
  const [periodo, setPeriodo] = useState("mes_atual");
  const [cliente, setCliente] = useState("todos");
  
  const { stats, clientes, modalidades, especialidades, listaClientes, loading } = useVolumetriaData(periodo, cliente);

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
            <VolumetriaFilters
              periodo={periodo}
              cliente={cliente}
              listaClientes={listaClientes}
              onPeriodoChange={setPeriodo}
              onClienteChange={setCliente}
            />
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : hasData ? (
          <>
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
                  total_clientes_volumetria: stats.total_clientes
                }} />
                <VolumetriaCharts 
                  clientes={clientes.map(c => ({ ...c, total_registros: c.total_exames }))}
                  modalidades={modalidades.map(m => ({ ...m, total_registros: m.total_exames }))}
                  especialidades={especialidades.map(e => ({ ...e, total_registros: e.total_exames }))}
                  categorias={[]}
                  prioridades={[]}
                />
              </TabsContent>

              <TabsContent value="medicos" className="space-y-6">
                <VolumetriaMedicosAnalysis 
                  medicos={[]}
                  modalidades={modalidades.map(m => ({ ...m, total_registros: m.total_exames, total_medicos: 0 }))}
                  especialidades={especialidades.map(e => ({ ...e, total_registros: e.total_exames, total_medicos: 0 }))}
                  categorias={[]}
                  prioridades={[]}
                  totalExames={stats.total_exames}
                />
              </TabsContent>

              <TabsContent value="atrasos" className="space-y-6">
                <VolumetriaDelayAnalysis 
                  data={{
                    clientes: clientes.map(c => ({ 
                      nome: c.nome, 
                      total_exames: c.total_exames, 
                      atrasados: 0,
                      percentual_atraso: 0
                    })),
                    modalidades: modalidades.map(m => ({ 
                      nome: m.nome, 
                      total_exames: m.total_exames, 
                      atrasados: 0,
                      percentual_atraso: 0
                    })),
                    especialidades: especialidades.map(e => ({ 
                      nome: e.nome, 
                      total_exames: e.total_exames, 
                      atrasados: 0,
                      percentual_atraso: 0
                    })),
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

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Upload de Dados</CardTitle>
              </CardHeader>
              <CardContent>
                <VolumetriaUpload 
                  arquivoFonte="volumetria_padrao"
                />
              </CardContent>
            </Card>
          </>
        ) : (
          <VolumetriaNoData 
            hasActiveFilters={periodo !== "todos" || cliente !== "todos"}
            onClearFilters={() => {
              setPeriodo("todos");
              setCliente("todos");
            }}
          />
        )}

      </div>
    </div>
  );
}
