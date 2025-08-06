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
import { VolumetriaNoData } from "@/components/volumetria/VolumetriaNoData";
import { useVolumetriaData } from "@/hooks/useVolumetriaData";
import { Upload, BarChart3, FileText } from "lucide-react";

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

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Relatórios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <VolumetriaClientesAtrasados />
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
                </div>
                <VolumetriaExecutiveSummary />
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
          </TabsContent>

          <TabsContent value="upload">
            <VolumetriaUpload 
              arquivoFonte="volumetria_padrao"
            />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Relatórios Disponíveis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Esta seção está em desenvolvimento. Em breve você poderá gerar relatórios personalizados.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
