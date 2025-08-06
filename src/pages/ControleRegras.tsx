import { ControleRegrasNegocio } from '@/components/ControleRegrasNegocio';
import ListarRegrasExclusao from '@/components/ListarRegrasExclusao';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ControleRegras() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Controle de Regras</h1>
        <p className="text-muted-foreground mt-1">
          Gerenciamento completo de todas as regras implementadas no sistema
        </p>
      </div>
      
      <Tabs defaultValue="negocio" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="negocio">Regras de Negócio</TabsTrigger>
          <TabsTrigger value="exclusao">Regras de Exclusão</TabsTrigger>
        </TabsList>
        <TabsContent value="negocio" className="space-y-4">
          <ControleRegrasNegocio />
        </TabsContent>
        <TabsContent value="exclusao" className="space-y-4">
          <ListarRegrasExclusao />
        </TabsContent>
      </Tabs>
    </div>
  );
}