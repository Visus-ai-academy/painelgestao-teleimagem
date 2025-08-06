
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
import { VolumetriaRetroativoRules } from "@/components/volumetria/VolumetriaRetroativoRules";
import { useVolumetriaData } from "@/hooks/useVolumetriaData";
import { Upload, BarChart3, FileText, Settings } from "lucide-react";

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
          <TabsList className="grid w-full grid-cols-4">
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
            <TabsTrigger value="rules" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Regras
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
                  <VolumetriaClientesAtrasados 
                    clientes={clientes.map(c => ({ ...c, total_registros: c.total_exames }))} 
                  />
                  <VolumetriaDelayAnalysis 
                    total_exames={stats.total_exames}
                    total_atrasados={stats.total_atrasados}
                    percentual_atraso={stats.percentual_atraso}
                  />
                </div>
                <VolumetriaExecutiveSummary 
                  stats={{
                    ...stats,
                    total_clientes_volumetria: stats.total_clientes
                  }}
                  clientes={clientes.map(c => ({ ...c, total_registros: c.total_exames }))}
                  modalidades={modalidades.map(m => ({ ...m, total_registros: m.total_exames }))}
                  especialidades={especialidades.map(e => ({ ...e, total_registros: e.total_exames }))}
                />
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

          <TabsContent value="rules" className="space-y-6">
            <VolumetriaRetroativoRules />
            
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader>
                <CardTitle className="text-orange-700">⚠️ Problema Identificado - Regra de Datas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-orange-800 mb-2">Situação Atual:</h4>
                    <p className="text-sm text-orange-700">
                      Os arquivos 1, 2 e 5 (volumetria_padrao, volumetria_fora_padrao e volumetria_onco_padrao) 
                      não estão aplicando corretamente a regra de limite de data de laudo.
                    </p>
                  </div>
                  
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-red-800 mb-2">Problema Identificado:</h4>
                    <p className="text-sm text-red-700 mb-2">
                      Exames com DATA_LAUDO posterior ao dia 7 do mês subsequente estão sendo incluídos na volumetria.
                    </p>
                    <div className="text-xs text-red-600 font-mono bg-red-100 p-2 rounded">
                      Exemplo: Exame laudado em 15/07/2025 aparecendo no faturamento de junho/2025<br/>
                      (Período: até 07/07/2025)
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">Regra Necessária:</h4>
                    <p className="text-sm text-blue-700">
                      Para período de faturamento junho/2025:
                    </p>
                    <ul className="text-xs text-blue-600 mt-2 ml-4 list-disc">
                      <li>Período válido: 08/06/2025 a 07/07/2025</li>
                      <li>Excluir exames com DATA_LAUDO {">"} 07/07/2025</li>
                      <li>Aplicar apenas aos arquivos 1, 2 e 5 (não retroativos)</li>
                    </ul>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">Implementação Requerida:</h4>
                    <p className="text-sm text-green-700">
                      Necessário criar/atualizar as Edge Functions de processamento para aplicar 
                      filtro de DATA_LAUDO nos arquivos não-retroativos, similar ao que já existe 
                      para os arquivos retroativos.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
