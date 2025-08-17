import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Zap,
  BarChart3
} from "lucide-react";
import { VolumetriaUpload } from "@/components/VolumetriaUpload";
import { VolumetriaPeriodoSelector } from "@/components/volumetria/VolumetriaPeriodoSelector";
import { VolumetriaUploadStats } from '@/components/volumetria/VolumetriaUploadStats';
import { VolumetriaClientesComparison } from '@/components/volumetria/VolumetriaClientesComparison';
import { VolumetriaExamesNaoIdentificados } from '@/components/volumetria/VolumetriaExamesNaoIdentificados';
import { VolumetriaStatusPanel } from '@/components/VolumetriaStatusPanel';
import { DeParaPrioridadeUpload } from '@/components/DePara/DeParaPrioridadeUpload';
import { VolumetriaProvider } from "@/contexts/VolumetriaContext";

// Período atual - onde estão os dados carregados (junho/2025)
const PERIODO_ATUAL = "2025-06";

export default function DadosVolumetria() {
  const [activeTab, setActiveTab] = useState("dados-mobilemed");
  const [refreshUploadStatus, setRefreshUploadStatus] = useState(0);
  const [periodoFaturamentoVolumetria, setPeriodoFaturamentoVolumetria] = useState<{ ano: number; mes: number } | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dados para Volumetria</h1>
        <p className="text-gray-600 mt-1">Upload e processamento dos dados MobileMed para geração da volumetria</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dados-mobilemed" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Dados MobileMed
          </TabsTrigger>
          <TabsTrigger value="comparativo" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Comparativo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados-mobilemed" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    <CardTitle>Upload de Dados MobileMed</CardTitle>
                  </div>
                </div>
                <CardDescription>
                  Faça upload dos arquivos de volumetria do sistema MobileMed. Estes dados serão processados para gerar a volumetria do período.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <VolumetriaProvider>
                  <div className="space-y-6">
                    {/* Seletor de Período */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-semibold text-blue-800 mb-2">Período de Processamento</h3>
                      <VolumetriaPeriodoSelector
                        periodoSelecionado={periodoFaturamentoVolumetria}
                        onPeriodoSelected={setPeriodoFaturamentoVolumetria}
                        onClearPeriodo={() => setPeriodoFaturamentoVolumetria(null)}
                      />
                    </div>

                    {/* Upload de Dados */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Upload de Volumetria</h3>
                        <VolumetriaUpload 
                          arquivoFonte="volumetria_padrao"
                          onSuccess={() => setRefreshUploadStatus(prev => prev + 1)}
                          periodoFaturamento={periodoFaturamentoVolumetria}
                        />
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Status dos Uploads</h3>
                        <VolumetriaStatusPanel />
                      </div>
                    </div>

                    {/* Upload De-Para Prioridade */}
                    <Card>
                      <CardHeader>
                        <CardTitle>De-Para Prioridade</CardTitle>
                        <CardDescription>
                          Upload do arquivo de mapeamento de prioridades para processamento da volumetria
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <DeParaPrioridadeUpload />
                      </CardContent>
                    </Card>

                    {/* Estatísticas dos Uploads */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Estatísticas dos Uploads</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <VolumetriaUploadStats />
                      </CardContent>
                    </Card>
                  </div>
                </VolumetriaProvider>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="comparativo" className="space-y-6">
          <VolumetriaProvider>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Comparativo de Volumetria
                  </CardTitle>
                  <CardDescription>
                    Compare dados de volumetria entre diferentes períodos e clientes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Comparativo por Clientes */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Comparativo por Clientes</h3>
                    <VolumetriaClientesComparison />
                  </div>

                  {/* Exames Não Identificados */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Exames Não Identificados</h3>
                    <VolumetriaExamesNaoIdentificados />
                  </div>
                </CardContent>
              </Card>
            </div>
          </VolumetriaProvider>
        </TabsContent>
      </Tabs>
    </div>
  );
}