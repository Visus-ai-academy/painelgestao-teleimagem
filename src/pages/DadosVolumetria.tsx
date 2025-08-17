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
import { VolumetriaExamesNaoIdentificados } from '@/components/volumetria/VolumetriaExamesNaoIdentificados';
import { VolumetriaStatusPanel } from '@/components/VolumetriaStatusPanel';
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
        <p className="text-gray-600 mt-1">Upload e processamento dos dados MobileMed para geração da volumetria</p>
      </div>

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
        </div>
      </VolumetriaProvider>
    </div>
  );
}