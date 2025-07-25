import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { FileText, Calendar, BarChart3, AlertCircle } from "lucide-react";

interface UploadStats {
  fileName: string;
  totalRecords: number;
  recordsWithValue: number;
  recordsZeroed: number;
  totalValue: number;
  period: string;
  category: 'padrão' | 'fora-padrão' | 'retroativo';
}

export function VolumetriaUploadStats() {
  const [stats, setStats] = useState<UploadStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        // Buscar dados usando o mesmo padrão do sistema (batches com ranges)
        let allData: any[] = [];
        let offset = 0;
        const limit = 1000;
        let hasMoreData = true;

        console.log('📊 Carregando todos os dados de volumetria...');

        while (hasMoreData) {
          const { data: batchData, error } = await supabase
            .from('volumetria_mobilemed')
            .select('arquivo_fonte, VALORES')
            .range(offset, offset + limit - 1);

          if (error) {
            console.error('❌ Erro ao buscar dados:', error);
            throw error;
          }

          if (!batchData || batchData.length === 0) {
            hasMoreData = false;
            break;
          }

          allData = [...allData, ...batchData];
          console.log(`📦 Lote ${Math.floor(offset/limit) + 1}: ${batchData.length} registros (total: ${allData.length})`);

          if (batchData.length < limit) {
            hasMoreData = false;
          } else {
            offset += limit;
          }

          // Limite de segurança para evitar loop infinito
          if (allData.length > 100000) {
            console.log('⚠️ Limite de segurança atingido (100k registros)');
            hasMoreData = false;
          }
        }

        console.log('📊 Total de dados carregados:', allData.length, 'registros');

        // Processar dados por arquivo_fonte
        const statsMap = new Map<string, {
          totalRecords: number;
          recordsWithValue: number;
          recordsZeroed: number;
          totalValue: number;
        }>();

        // Inicializar contadores
        const initStats = { totalRecords: 0, recordsWithValue: 0, recordsZeroed: 0, totalValue: 0 };
        statsMap.set('volumetria_padrao', { ...initStats });
        statsMap.set('volumetria_fora_padrao', { ...initStats });
        statsMap.set('volumetria_padrao_retroativo', { ...initStats });
        statsMap.set('volumetria_fora_padrao_retroativo', { ...initStats });

        // Processar dados
        allData.forEach(record => {
          const fonte = record.arquivo_fonte;
          const valor = record.VALORES || 0;
          
          if (statsMap.has(fonte)) {
            const stats = statsMap.get(fonte)!;
            stats.totalRecords++;
            
            if (valor > 0) {
              stats.recordsWithValue++;
              
              // Para arquivos "fora padrão", cada registro = 1 exame
              // Para arquivos "padrão", usa o valor do campo VALORES
              if (fonte.includes('fora_padrao')) {
                stats.totalValue += 1; // Conta 1 exame por registro
              } else {
                stats.totalValue += valor; // Usa o valor real do campo
              }
            } else {
              stats.recordsZeroed++;
            }
          }
        });

        // Converter para formato do componente
        const realStats: UploadStats[] = [
          {
            fileName: "Volumetria Padrão",
            totalRecords: statsMap.get('volumetria_padrao')?.totalRecords || 0,
            recordsWithValue: statsMap.get('volumetria_padrao')?.recordsWithValue || 0,
            recordsZeroed: statsMap.get('volumetria_padrao')?.recordsZeroed || 0,
            totalValue: statsMap.get('volumetria_padrao')?.totalValue || 0,
            period: "Período Atual",
            category: 'padrão'
          },
          {
            fileName: "Volumetria Fora Padrão", 
            totalRecords: statsMap.get('volumetria_fora_padrao')?.totalRecords || 0,
            recordsWithValue: statsMap.get('volumetria_fora_padrao')?.recordsWithValue || 0,
            recordsZeroed: statsMap.get('volumetria_fora_padrao')?.recordsZeroed || 0,
            totalValue: statsMap.get('volumetria_fora_padrao')?.totalValue || 0,
            period: "Período Atual",
            category: 'fora-padrão'
          },
          {
            fileName: "Volumetria Padrão Retroativo",
            totalRecords: statsMap.get('volumetria_padrao_retroativo')?.totalRecords || 0,
            recordsWithValue: statsMap.get('volumetria_padrao_retroativo')?.recordsWithValue || 0,
            recordsZeroed: statsMap.get('volumetria_padrao_retroativo')?.recordsZeroed || 0,
            totalValue: statsMap.get('volumetria_padrao_retroativo')?.totalValue || 0,
            period: "Período Retroativo",
            category: 'retroativo'
          },
          {
            fileName: "Volumetria Fora Padrão Retroativo",
            totalRecords: statsMap.get('volumetria_fora_padrao_retroativo')?.totalRecords || 0,
            recordsWithValue: statsMap.get('volumetria_fora_padrao_retroativo')?.recordsWithValue || 0,
            recordsZeroed: statsMap.get('volumetria_fora_padrao_retroativo')?.recordsZeroed || 0,
            totalValue: statsMap.get('volumetria_fora_padrao_retroativo')?.totalValue || 0,
            period: "Período Retroativo",
            category: 'fora-padrão'
          }
        ];

        console.log('📊 Estatísticas reais carregadas:', realStats);
        setStats(realStats);
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const getCategoryColor = (category: UploadStats['category']) => {
    switch (category) {
      case 'padrão':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'fora-padrão':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'retroativo':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const totalStats = stats.reduce((acc, stat) => ({
    totalRecords: acc.totalRecords + stat.totalRecords,
    recordsWithValue: acc.recordsWithValue + stat.recordsWithValue,
    totalValue: acc.totalValue + stat.totalValue
  }), { totalRecords: 0, recordsWithValue: 0, totalValue: 0 });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Carregando estatísticas...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Análise dos Uploads Realizados
        </CardTitle>
        <div className="grid grid-cols-3 gap-4 pt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{totalStats.totalRecords.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total de Registros</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{totalStats.recordsWithValue.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Com Valores</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{totalStats.totalValue.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total de Exames</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Arquivo</TableHead>
              <TableHead className="text-center">Registros</TableHead>
              <TableHead className="text-center">Com Valores</TableHead>
              <TableHead className="text-center">Zerados</TableHead>
              <TableHead className="text-center">Total Exames</TableHead>
              <TableHead className="text-center">Período</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((stat, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{stat.fileName}</div>
                      <Badge 
                        variant="outline" 
                        className={`mt-1 ${getCategoryColor(stat.category)}`}
                      >
                        {stat.category}
                      </Badge>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center font-mono">
                  {stat.totalRecords.toLocaleString()}
                </TableCell>
                <TableCell className="text-center font-mono text-green-600">
                  {stat.recordsWithValue.toLocaleString()}
                </TableCell>
                <TableCell className="text-center font-mono">
                  {stat.recordsZeroed > 0 ? (
                    <div className="flex items-center justify-center gap-1 text-orange-600">
                      <AlertCircle className="h-4 w-4" />
                      {stat.recordsZeroed.toLocaleString()}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-center font-mono text-blue-600">
                  {stat.totalValue.toLocaleString()}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {stat.period}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}