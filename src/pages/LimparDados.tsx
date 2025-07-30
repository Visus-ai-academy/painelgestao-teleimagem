import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { limparDadosVolumetria } from "@/lib/supabase";

export default function LimparDados() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLimparDados = async () => {
    setIsLoading(true);
    try {
      const arquivosParaLimpar = [
        'volumetria_padrao',
        'volumetria_fora_padrao', 
        'volumetria_padrao_retroativo',
        'volumetria_fora_padrao_retroativo'
      ];

      console.log('Iniciando limpeza dos arquivos:', arquivosParaLimpar);
      
      const resultado = await limparDadosVolumetria(arquivosParaLimpar);
      
      toast({
        title: "Dados limpos com sucesso!",
        description: `${resultado.registros_removidos} registros removidos`,
      });

      console.log('Limpeza concluída:', resultado);
    } catch (error) {
      console.error('Erro na limpeza:', error);
      toast({
        title: "Erro na limpeza",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Executar automaticamente ao carregar a página
  useEffect(() => {
    handleLimparDados();
  }, []);

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Limpeza de Dados de Volumetria</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Limpando dados duplicados das bases de volumetria:
          </p>
          <ul className="list-disc list-inside mb-6 space-y-1">
            <li>volumetria_padrao: 137.005 registros, 153.810 exames</li>
            <li>volumetria_fora_padrao: 218 registros, 219 exames</li>
            <li>volumetria_padrao_retroativo: 12.780 registros, 14.184 exames</li>
            <li>volumetria_fora_padrao_retroativo: 4 registros, 0 exames</li>
          </ul>
          
          <Button 
            onClick={handleLimparDados} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Limpando..." : "Limpar Dados Duplicados"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}