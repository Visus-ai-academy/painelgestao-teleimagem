import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";
import { ControlePeriodoVolumetria } from '@/components/ControlePeriodoVolumetria';

interface VolumetriaFiltersProps {
  periodo: string;
  cliente: string;
  listaClientes: string[];
  onPeriodoChange: (periodo: string) => void;
  onClienteChange: (cliente: string) => void;
}

export function VolumetriaFilters({ 
  periodo, 
  cliente, 
  listaClientes, 
  onPeriodoChange, 
  onClienteChange 
}: VolumetriaFiltersProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ControlePeriodoVolumetria 
        periodo={periodo} 
        onPeriodoChange={onPeriodoChange}
        showStatus={true}
        showDetails={true}
      />
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Filtro por Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={cliente} onValueChange={onClienteChange}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {cliente === "todos" ? "Todos os Clientes" : cliente}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-[300px] overflow-auto">
              <SelectItem value="todos">Todos os Clientes</SelectItem>
              {listaClientes.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground mt-2">
            {listaClientes.length} clientes disponíveis
          </div>
        </CardContent>
      </Card>
    </div>
  );
}