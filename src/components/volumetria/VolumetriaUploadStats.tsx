import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Calendar, BarChart3, AlertCircle } from "lucide-react";
import { useVolumetria } from "@/contexts/VolumetriaContext";

// FORÇA CACHE BUST
const CACHE_BUSTER = Date.now();

// Dados estruturados
interface UploadStats {
  fileName: string;
  totalRecords: number;
  recordsWithValue: number;
  recordsZeroed: number;
  totalValue: number;
  period: string;
}

export function VolumetriaUploadStats() {
  const { data, refreshData } = useVolumetria();

  // FORÇAR EXECUÇÃO SEMPRE QUE COMPONENTE RENDERIZAR
  console.log('🔥 RENDERIZAÇÃO VolumetriaUploadStats - CACHE BUSTER:', CACHE_BUSTER);
  console.log('📊 Estado atual completo:', data);
  console.log('📊 Loading:', data.loading);
  console.log('📊 Stats keys:', Object.keys(data.stats));
  
  // Forçar uma atualização na primeira renderização para garantir que os dados sejam carregados
  useEffect(() => {
    console.log('🔄 VolumetriaUploadStats useEffect EXECUTADO - Cache buster:', CACHE_BUSTER);
    console.log('📊 Data no useEffect:', data);
    
    // Forçar refresh imediato E com delay
    console.log('🚀 Executando refresh IMEDIATO...');
    refreshData();
    
    setTimeout(() => {
      console.log('🚀 Executando refresh com DELAY...');
      refreshData();
    }, 1000);
  }, [CACHE_BUSTER]); // Dependência do cache buster força execução sempre

  // Converter dados do contexto para o formato de stats
  const stats: UploadStats[] = [
    {
      fileName: "Volumetria Padrão",
      totalRecords: data.stats.volumetria_padrao.totalRecords,
      recordsWithValue: data.stats.volumetria_padrao.recordsWithValue,
      recordsZeroed: data.stats.volumetria_padrao.recordsZeroed,
      totalValue: data.stats.volumetria_padrao.totalValue,
      period: data.lastUploads.volumetria_padrao ? 
        new Date(data.lastUploads.volumetria_padrao.created_at).toLocaleDateString('pt-BR') : 
        "Nenhum upload"
    },
    {
      fileName: "Volumetria Fora Padrão", 
      totalRecords: data.stats.volumetria_fora_padrao.totalRecords,
      recordsWithValue: data.stats.volumetria_fora_padrao.recordsWithValue,
      recordsZeroed: data.stats.volumetria_fora_padrao.recordsZeroed,
      totalValue: data.stats.volumetria_fora_padrao.totalValue,
      period: data.lastUploads.volumetria_fora_padrao ?
        new Date(data.lastUploads.volumetria_fora_padrao.created_at).toLocaleDateString('pt-BR') :
        "Nenhum upload"
    },
    {
      fileName: "Volumetria Padrão Retroativo",
      totalRecords: data.stats.volumetria_padrao_retroativo.totalRecords,
      recordsWithValue: data.stats.volumetria_padrao_retroativo.recordsWithValue,
      recordsZeroed: data.stats.volumetria_padrao_retroativo.recordsZeroed,
      totalValue: data.stats.volumetria_padrao_retroativo.totalValue,
      period: data.lastUploads.volumetria_padrao_retroativo ?
        new Date(data.lastUploads.volumetria_padrao_retroativo.created_at).toLocaleDateString('pt-BR') :
        "Nenhum upload"
    },
    {
      fileName: "Volumetria Fora Padrão Retroativo",
      totalRecords: data.stats.volumetria_fora_padrao_retroativo.totalRecords,
      recordsWithValue: data.stats.volumetria_fora_padrao_retroativo.recordsWithValue,
      recordsZeroed: data.stats.volumetria_fora_padrao_retroativo.recordsZeroed,
      totalValue: data.stats.volumetria_fora_padrao_retroativo.totalValue,
      period: data.lastUploads.volumetria_fora_padrao_retroativo ?
        new Date(data.lastUploads.volumetria_fora_padrao_retroativo.created_at).toLocaleDateString('pt-BR') :
        "Nenhum upload"
    },
    {
      fileName: "Volumetria Onco Padrão",
      totalRecords: data.stats.volumetria_onco_padrao.totalRecords,
      recordsWithValue: data.stats.volumetria_onco_padrao.recordsWithValue,
      recordsZeroed: data.stats.volumetria_onco_padrao.recordsZeroed,
      totalValue: data.stats.volumetria_onco_padrao.totalValue,
      period: data.lastUploads.volumetria_onco_padrao ?
        new Date(data.lastUploads.volumetria_onco_padrao.created_at).toLocaleDateString('pt-BR') :
        "Nenhum upload"
    }
  ];

  const totalStats = stats.reduce((acc, stat) => {
    console.log(`🔍 SOMA INDIVIDUAL - ${stat.fileName}:`);
    console.log(`  - totalRecords: ${stat.totalRecords}`);
    console.log(`  - recordsWithValue: ${stat.recordsWithValue}`);
    console.log(`  - recordsZeroed: ${stat.recordsZeroed}`);
    console.log(`  - totalValue: ${stat.totalValue}`);
    
    const newAcc = {
      totalRecords: acc.totalRecords + stat.totalRecords,
      recordsWithValue: acc.recordsWithValue + stat.recordsWithValue,
      recordsZeroed: acc.recordsZeroed + stat.recordsZeroed,
      totalValue: acc.totalValue + stat.totalValue,
    };
    
    console.log(`  - Acumulado até agora: totalValue = ${newAcc.totalValue}, zerados = ${newAcc.recordsZeroed}`);
    return newAcc;
  }, { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 });
  
  console.log(`🔍 RESULTADO FINAL DA SOMA: ${totalStats.totalValue} exames`);
  console.log(`🔍 STATS ORIGINAIS DO CONTEXTO:`, data.stats);


  if (data.loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Análise dos Uploads Realizados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Carregando estatísticas...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Análise dos Uploads Realizados
        </CardTitle>
        {/* Resumo no Header */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-900">{totalStats.totalRecords.toLocaleString()}</div>
              <div className="text-sm text-blue-700">Total de Registros</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-900">{totalStats.recordsWithValue.toLocaleString()}</div>
              <div className="text-sm text-green-700">Com Valores</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-900">{stats.reduce((acc, stat) => acc + stat.recordsZeroed, 0).toLocaleString()}</div>
              <div className="text-sm text-red-700">Total de Zerados</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-900">{totalStats.totalValue.toLocaleString()}</div>
              <div className="text-sm text-orange-700">Total de Exames</div>
            </div>
          </div>
          {/* Indicador de última atualização */}
          <div className="mt-2 text-xs text-center text-muted-foreground">
            Última atualização: {new Date().toLocaleTimeString('pt-BR')}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Tabela Detalhada */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Arquivo
                </div>
              </TableHead>
              <TableHead className="text-center">Registros</TableHead>
              <TableHead className="text-center">Zerados</TableHead>
              <TableHead className="text-center">Total de Exames</TableHead>
              <TableHead className="text-center">
                <div className="flex items-center gap-1 justify-center">
                  <Calendar className="h-4 w-4" />
                  Período
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((stat, index) => (
              <TableRow key={index}>
                 <TableCell className="font-medium">
                   <span>{stat.fileName}</span>
                 </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col">
                    <span className="font-semibold text-blue-600">{stat.totalRecords}</span>
                    <span className="text-xs text-green-600">{stat.recordsWithValue} com valores</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {stat.recordsZeroed > 0 ? (
                    <div className="flex items-center justify-center gap-1">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <span className="text-yellow-600 font-medium">{stat.recordsZeroed}</span>
                    </div>
                  ) : (
                    <span className="text-green-600">0</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <BarChart3 className="h-4 w-4 text-orange-500" />
                    <span className="font-semibold text-orange-600">{stat.totalValue}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">
                  {stat.period}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}