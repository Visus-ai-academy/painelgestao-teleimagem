import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Upload,
  Settings,
  Activity,
  FileBarChart
} from "lucide-react";
import { VolumetriaUpload } from "@/components/VolumetriaUpload";
import { VolumetriaPeriodoSelector } from "@/components/volumetria/VolumetriaPeriodoSelector";
import { VolumetriaUploadStats } from '@/components/volumetria/VolumetriaUploadStats';
import { VolumetriaExamesNaoIdentificados } from '@/components/volumetria/VolumetriaExamesNaoIdentificados';
import { VolumetriaStatusPanel } from '@/components/VolumetriaStatusPanel';

import { AutoRegrasMaster } from '@/components/AutoRegrasMaster';
import { TesteRegras27 } from '@/components/TesteRegras27';
import { AplicarAgrupamentoClientes } from '@/components/AplicarAgrupamentoClientes';
import { CorrigirExamesForaPadrao } from '@/components/CorrigirExamesForaPadrao';

import { SystemDateTime } from '@/components/SystemDateTime';
import { LimparUploadTravado } from '@/components/LimparUploadTravado';
import { FinalizarUploadsTravados } from '@/components/FinalizarUploadsTravados';
import { AplicarTipificacaoGeral } from "@/components/AplicarTipificacaoGeral";
import { IndicadorTipificacao } from '@/components/IndicadorTipificacao';
import { DemonstrativoVolumetriaPorCliente } from '@/components/DemonstrativoVolumetriaPorCliente';
import { VolumetriaProvider } from "@/contexts/VolumetriaContext";
import { useToast } from "@/hooks/use-toast";
import { useUploadStatus } from "@/hooks/useUploadStatus";
import { useAutoRegras } from "@/hooks/useAutoRegras";

export default function DadosVolumetria() {
  const [refreshUploadStatus, setRefreshUploadStatus] = useState(0);
  const [periodoFaturamentoVolumetria, setPeriodoFaturamentoVolumetria] = useState<{ ano: number; mes: number } | null>(null);
  const [refreshTipificacao, setRefreshTipificacao] = useState(0);
  const { toast } = useToast();
  const { status: uploadStatus, refresh: refreshUploadData } = useUploadStatus([
    'volumetria_padrao', 
    'volumetria_fora_padrao', 
    'volumetria_padrao_retroativo', 
    'volumetria_fora_padrao_retroativo',
    'volumetria_onco_padrao'
  ]);
  
  // Hook para monitoramento automático de regras quando upload for concluído
  useAutoRegras();

  // Período formatado para uso nos componentes (ex: "2025-10")
  const periodoFormatado = periodoFaturamentoVolumetria 
    ? `${periodoFaturamentoVolumetria.ano}-${String(periodoFaturamentoVolumetria.mes).padStart(2, '0')}` 
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dados para Volumetria</h1>
        <p className="text-gray-600 mt-1">Upload e processamento dos dados MobileMed com regras automáticas v002, v003, v031</p>
      </div>

      {/* Data e Hora do Sistema */}
      <SystemDateTime />
      

      <VolumetriaProvider>
        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload de Dados
            </TabsTrigger>
            <TabsTrigger 
              value="sistema-regras" 
              className="flex items-center gap-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white text-orange-600 font-semibold"
            >
              <Settings className="h-4 w-4" />
              Sistema de Regras
            </TabsTrigger>
            <TabsTrigger value="demonstrativo" className="flex items-center gap-2">
              <FileBarChart className="h-4 w-4" />
              Demonstrativo
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
              <CardContent className="space-y-4">
                <VolumetriaStatusPanel />
                
                {/* Finalizar uploads travados */}
                <FinalizarUploadsTravados />
                
                {/* Detectar e resetar uploads travados */}
                {uploadStatus.processingUploads > 0 && uploadStatus.progressPercentage < 50 && (
                  <LimparUploadTravado
                    uploadId="57f5e609-a624-4712-999d-cf87f1b4762c"
                    fileName="relatorio_exames_especialidade_junho_padrao.xlsx"
                    onSuccess={() => {
                      refreshUploadData();
                      setRefreshUploadStatus(prev => prev + 1);
                      toast({
                        title: "Upload Resetado",
                        description: "Você pode fazer o upload do arquivo novamente.",
                      });
                    }}
                  />
                )}
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

          <TabsContent value="demonstrativo" className="space-y-6">
            <DemonstrativoVolumetriaPorCliente 
              periodo={periodoFormatado || ''} 
            />
          </TabsContent>

          <TabsContent value="sistema-regras" className="space-y-6">
            {/* Alerta de Sequência de Processamento */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Activity className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-800 mb-2">Sequência de Aplicação das Regras</h3>
                  <p className="text-amber-700 text-sm mb-3">
                    Para garantir o processamento correto dos dados, execute as regras na seguinte ordem:
                  </p>
                  <ol className="list-decimal list-inside text-amber-700 text-sm space-y-1">
                    <li><strong>Corrigir Exames Fora do Padrão</strong> - Vincula exames não identificados ao cadastro</li>
                    <li><strong>Executar 28 Regras Completas</strong> - Aplica normalização, categorias, especialidades e modalidades</li>
                    <li><strong>Aplicar Agrupamento de Clientes</strong> - Distribui exames para clientes derivados (ex: CEMVALENCA_RX)</li>
                    <li><strong>Aplicar Tipificação Geral</strong> - Define tipo de faturamento (CO-FT, NC-FT, etc.) - <span className="font-bold">SEMPRE POR ÚLTIMO</span></li>
                  </ol>
                  <p className="text-amber-600 text-xs mt-2 italic">
                    Nota: Exames com modalidade "US" são excluídos automaticamente durante o upload.
                  </p>
                </div>
              </div>
            </div>
            
            {/* 1. Corrigir Exames Fora do Padrão */}
            <CorrigirExamesForaPadrao />
            
            {/* 2. Executar 28 Regras Completas - PASSANDO PERÍODO */}
            <TesteRegras27 periodoReferencia={periodoFormatado} />
            
            {/* 3. Aplicar Agrupamento aos Dados Existentes - PASSANDO PERÍODO */}
            <AplicarAgrupamentoClientes periodoReferencia={periodoFormatado} />
            
            {/* 4. Tipificação Geral - SEMPRE POR ÚLTIMO */}
            <AplicarTipificacaoGeral
              onCorrecaoConcluida={() => setRefreshTipificacao(prev => prev + 1)}
            />
            
            {/* Status de Tipificação em Tempo Real */}
            <IndicadorTipificacao
              key={refreshTipificacao}
              periodoReferencia={periodoFormatado || ''}
            />
            
            {/* Sistema de Regras Original (Legacy) */}
            <AutoRegrasMaster />
          </TabsContent>
          
        </Tabs>
      </VolumetriaProvider>
    </div>
  );
}
