import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Upload,
  BarChart3,
  Settings,
  Activity
} from "lucide-react";
import { VolumetriaUpload } from "@/components/VolumetriaUpload";
import { VolumetriaPeriodoSelector } from "@/components/volumetria/VolumetriaPeriodoSelector";
import { VolumetriaUploadStats } from '@/components/volumetria/VolumetriaUploadStats';
import { VolumetriaExamesNaoIdentificados } from '@/components/volumetria/VolumetriaExamesNaoIdentificados';
import { VolumetriaStatusPanel } from '@/components/VolumetriaStatusPanel';
import { StatusRegraProcessamento } from '@/components/volumetria/StatusRegraProcessamento';
import { AnaliseRegistrosExcluidos } from '@/components/AnaliseRegistrosExcluidos';
import { MonitoramentoExclusoes } from '@/components/MonitoramentoExclusoes';
import { VolumetriaProvider } from "@/contexts/VolumetriaContext";
import { useToast } from "@/hooks/use-toast";

// Período atual - onde estão os dados carregados (junho/2025)
const PERIODO_ATUAL = "2025-06";

export default function DadosVolumetria() {
  const [refreshUploadStatus, setRefreshUploadStatus] = useState(0);
  const [periodoFaturamentoVolumetria, setPeriodoFaturamentoVolumetria] = useState<{ ano: number; mes: number } | null>(null);
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dados para Volumetria</h1>
        <p className="text-gray-600 mt-1">Upload e processamento dos dados MobileMed com regras automáticas v002, v003, v031</p>
      </div>

      <VolumetriaProvider>
        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload de Dados
            </TabsTrigger>
            <TabsTrigger value="monitoramento" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Monitoramento
            </TabsTrigger>
            <TabsTrigger value="status-regras" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Status das Regras
            </TabsTrigger>
            <TabsTrigger value="registros-excluidos" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Registros Excluídos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
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
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <VolumetriaUpload
                  arquivoFonte="volumetria_padrao"
                  disabled={!periodoFaturamentoVolumetria}
                  periodoFaturamento={periodoFaturamentoVolumetria || undefined}
                  onSuccess={() => {
                    toast({
                      title: "Upload Concluído",
                      description: "Dados de volumetria padrão processados com sucesso!",
                    });
                    setRefreshUploadStatus(prev => prev + 1);
                  }}
                />
              </div>

              <div>
                <VolumetriaUpload
                  arquivoFonte="volumetria_fora_padrao"
                  disabled={!periodoFaturamentoVolumetria}
                  periodoFaturamento={periodoFaturamentoVolumetria || undefined}
                  onSuccess={() => {
                    toast({
                      title: "Upload Concluído",
                      description: "Dados de volumetria fora do padrão processados com sucesso!",
                    });
                    setRefreshUploadStatus(prev => prev + 1);
                  }}
                />
              </div>

              <div>
                <VolumetriaUpload
                  arquivoFonte="volumetria_padrao_retroativo"
                  disabled={!periodoFaturamentoVolumetria}
                  periodoFaturamento={periodoFaturamentoVolumetria || undefined}
                  onSuccess={() => {
                    toast({
                      title: "Upload Concluído",
                      description: "Dados de volumetria padrão retroativa processados com sucesso!",
                    });
                    setRefreshUploadStatus(prev => prev + 1);
                  }}
                />
              </div>

              <div>
                <VolumetriaUpload
                  arquivoFonte="volumetria_fora_padrao_retroativo"
                  disabled={!periodoFaturamentoVolumetria}
                  periodoFaturamento={periodoFaturamentoVolumetria || undefined}
                  onSuccess={() => {
                    toast({
                      title: "Upload Concluído",
                      description: "Dados de volumetria fora do padrão retroativa processados com sucesso!",
                    });
                    setRefreshUploadStatus(prev => prev + 1);
                  }}
                />
              </div>
            </div>

            {/* Status dos Uploads */}
            <Card>
              <CardHeader>
                <CardTitle>Status dos Uploads</CardTitle>
              </CardHeader>
              <CardContent>
                <VolumetriaStatusPanel />
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

            {/* Exames Não Identificados */}
            <Card>
              <CardHeader>
                <CardTitle>Exames Não Identificados</CardTitle>
                <CardDescription>
                  Análise de exames que não foram identificados no processamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <VolumetriaExamesNaoIdentificados />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoramento">
            <MonitoramentoExclusoes titulo="Monitoramento em Tempo Real - Regras v002, v003, v031" />
          </TabsContent>

          <TabsContent value="status-regras">
            <StatusRegraProcessamento />
          </TabsContent>
          
          <TabsContent value="registros-excluidos">
            <AnaliseRegistrosExcluidos />
          </TabsContent>
        </Tabs>
      </VolumetriaProvider>
    </div>
  );
}