import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Download, 
  FileSpreadsheet, 
  Search,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ExameSemPreco {
  cliente: string;
  modalidade: string;
  especialidade: string;
  categoria: string;
  prioridade: string;
  valor_unitario: number;
  quantidade_total: number;
  tem_preco_cadastrado: boolean;
}

export function ExamesValoresZerados() {
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState("2025-06");
  const [examesSemPreco, setExamesSemPreco] = useState<ExameSemPreco[]>([]);
  const { toast } = useToast();

  const buscarExamesZerados = async () => {
    if (!periodo) {
      toast({
        title: "Período obrigatório",
        description: "Selecione um período para analisar",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 Analisando exames com valores zerados para período:', periodo);

      // 1. Buscar todas as combinações únicas da volumetria com valores zerados
      const { data: volumetriaZerada, error: errorVolumetria } = await supabase
        .from('volumetria_mobilemed')
        .select(`
          "EMPRESA",
          "MODALIDADE",
          "ESPECIALIDADE", 
          "CATEGORIA",
          "PRIORIDADE",
          "VALORES"
        `)
        .eq('periodo_referencia', periodo)
        .not('"EMPRESA"', 'is', null)
        .not('"MODALIDADE"', 'is', null)
        .not('"ESPECIALIDADE"', 'is', null);

      if (errorVolumetria) {
        throw errorVolumetria;
      }

      if (!volumetriaZerada || volumetriaZerada.length === 0) {
        toast({
          title: "Nenhum dado encontrado",
          description: `Não há dados de volumetria para o período ${periodo}`,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      console.log(`📊 ${volumetriaZerada.length} registros encontrados na volumetria`);

      // 2. Agrupar e contar por combinação única
      const combinacoesMap = new Map<string, ExameSemPreco>();
      
      volumetriaZerada.forEach(item => {
        const categoria = item.CATEGORIA || 'SC';
        const prioridade = item.PRIORIDADE || 'ROTINA';
        const chave = `${item.EMPRESA}-${item.MODALIDADE}-${item.ESPECIALIDADE}-${categoria}-${prioridade}`;
        
        if (combinacoesMap.has(chave)) {
          combinacoesMap.get(chave)!.quantidade_total += Number(item.VALORES || 1);
        } else {
          combinacoesMap.set(chave, {
            cliente: item.EMPRESA,
            modalidade: item.MODALIDADE,
            especialidade: item.ESPECIALIDADE,
            categoria: categoria,
            prioridade: prioridade,
            valor_unitario: 0, // Será calculado depois
            quantidade_total: Number(item.VALORES || 1),
            tem_preco_cadastrado: false // Será verificado depois
          });
        }
      });

      const combinacoesUnicas = Array.from(combinacoesMap.values());
      console.log(`📋 ${combinacoesUnicas.length} combinações únicas encontradas`);

      // 3. Para cada combinação, verificar se existe preço cadastrado e calcular o valor
      const resultados: ExameSemPreco[] = [];
      
      for (const combinacao of combinacoesUnicas) {
        try {
          // Buscar cliente_id
          const { data: clienteData } = await supabase
            .from('clientes')
            .select('id')
            .or(`nome.eq.${combinacao.cliente},nome_fantasia.eq.${combinacao.cliente},nome_mobilemed.eq.${combinacao.cliente}`)
            .limit(1);

          if (clienteData && clienteData.length > 0) {
            const clienteId = clienteData[0].id;
            
            // Calcular preço usando a função RPC
            const { data: precoCalculado } = await supabase.rpc('calcular_preco_exame', {
              p_cliente_id: clienteId,
              p_modalidade: combinacao.modalidade,
              p_especialidade: combinacao.especialidade,
              p_prioridade: combinacao.prioridade,
              p_categoria: combinacao.categoria,
              p_volume_total: combinacao.quantidade_total,
              p_is_plantao: (combinacao.prioridade || '').toUpperCase().includes('PLANT')
            });

            combinacao.valor_unitario = precoCalculado || 0;
            combinacao.tem_preco_cadastrado = precoCalculado && precoCalculado > 0;

            // Só incluir se NÃO tem preço cadastrado (valor zerado)
            if (!combinacao.tem_preco_cadastrado || combinacao.valor_unitario === 0) {
              resultados.push(combinacao);
            }
          } else {
            // Cliente não encontrado no cadastro
            combinacao.tem_preco_cadastrado = false;
            resultados.push(combinacao);
          }
        } catch (error) {
          console.error(`Erro ao verificar preço para ${combinacao.cliente}:`, error);
          // Em caso de erro, incluir na lista
          combinacao.tem_preco_cadastrado = false;
          resultados.push(combinacao);
        }
      }

      console.log(`❌ ${resultados.length} combinações SEM preço cadastrado encontradas`);
      
      // Ordenar por cliente, depois por modalidade
      resultados.sort((a, b) => {
        if (a.cliente !== b.cliente) {
          return a.cliente.localeCompare(b.cliente);
        }
        return a.modalidade.localeCompare(b.modalidade);
      });

      setExamesSemPreco(resultados);

      toast({
        title: "Análise concluída",
        description: `${resultados.length} combinações sem preços cadastrados encontradas`,
        variant: resultados.length > 0 ? "default" : "destructive"
      });

    } catch (error: any) {
      console.error('Erro ao analisar exames:', error);
      toast({
        title: "Erro na análise",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportarExcel = () => {
    if (examesSemPreco.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Execute a análise primeiro",
        variant: "destructive"
      });
      return;
    }

    // Criar dados para CSV/Excel
    const csvData = [
      ['Cliente', 'Modalidade', 'Especialidade', 'Categoria', 'Prioridade', 'Valor Unit.', 'Quantidade Total', 'Status'],
      ...examesSemPreco.map(item => [
        item.cliente,
        item.modalidade,
        item.especialidade,
        item.categoria,
        item.prioridade,
        item.valor_unitario.toFixed(2),
        item.quantidade_total.toString(),
        item.tem_preco_cadastrado ? 'Com preço' : 'SEM PREÇO'
      ])
    ];

    // Converter para CSV
    const csvContent = csvData.map(row => 
      row.map(cell => `"${cell}"`).join(';')
    ).join('\n');

    // Download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `exames_sem_preco_${periodo}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Arquivo exportado",
      description: `Lista de exames sem preço exportada (${examesSemPreco.length} registros)`,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Análise de Exames com Valores Zerados
          </CardTitle>
          <CardDescription>
            Identifica exames na volumetria que não possuem preços cadastrados na tabela de preços
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="periodo">Período para Análise</Label>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025-06">Junho/2025</SelectItem>
                  <SelectItem value="2025-05">Maio/2025</SelectItem>
                  <SelectItem value="2025-04">Abril/2025</SelectItem>
                  <SelectItem value="2025-03">Março/2025</SelectItem>
                  <SelectItem value="2025-02">Fevereiro/2025</SelectItem>
                  <SelectItem value="2025-01">Janeiro/2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={buscarExamesZerados}
              disabled={loading || !periodo}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Search className="mr-2 h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Analisar Exames
                </>
              )}
            </Button>
            
            <Button 
              onClick={exportarExcel}
              disabled={examesSemPreco.length === 0}
              variant="outline"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {examesSemPreco.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Exames sem Preços Cadastrados
            </CardTitle>
            <CardDescription>
              {examesSemPreco.length} combinações encontradas sem preços na tabela de preços
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left">Cliente</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Modalidade</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Especialidade</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Categoria</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Prioridade</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">Valor Unit.</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">Qtd Total</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {examesSemPreco.map((exame, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-4 py-2">{exame.cliente}</td>
                      <td className="border border-gray-300 px-4 py-2">{exame.modalidade}</td>
                      <td className="border border-gray-300 px-4 py-2">{exame.especialidade}</td>
                      <td className="border border-gray-300 px-4 py-2">{exame.categoria}</td>
                      <td className="border border-gray-300 px-4 py-2">{exame.prioridade}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        R$ {exame.valor_unitario.toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-right">
                        {exame.quantidade_total}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {exame.tem_preco_cadastrado ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Com preço
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            SEM PREÇO
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <h4 className="font-semibold text-yellow-800 mb-2">Instruções:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Os exames listados possuem volumetria mas não têm preços cadastrados</li>
                <li>• Verifique se os preços precisam ser cadastrados na tabela de preços</li>
                <li>• Use o botão "Exportar Excel" para obter a lista completa</li>
                <li>• Após cadastrar os preços, gere novamente os demonstrativos</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}