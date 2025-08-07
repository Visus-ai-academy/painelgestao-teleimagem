import { ControleRegrasNegocio } from '@/components/ControleRegrasNegocio';
import { ControleFechamentoFaturamento } from '@/components/ControleFechamentoFaturamento';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ControleRegras() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Controle de Regras de Negócio</h1>
        <p className="text-muted-foreground mt-1">
          Gerenciamento de regras de negócio e proteção temporal de dados
        </p>
      </div>
      
      <Tabs defaultValue="regras" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="regras">Regras de Negócio</TabsTrigger>
          <TabsTrigger value="fechamento">Fechamento de Período</TabsTrigger>
        </TabsList>
        
        <TabsContent value="regras" className="space-y-4">
          <ControleRegrasNegocio />
        </TabsContent>
        
        <TabsContent value="fechamento" className="space-y-4">
          <ControleFechamentoFaturamento />
        </TabsContent>
      </Tabs>
    </div>
  );
}