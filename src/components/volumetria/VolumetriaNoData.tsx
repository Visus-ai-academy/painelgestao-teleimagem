import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VolumetriaNoDataProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function VolumetriaNoData({ hasActiveFilters, onClearFilters }: VolumetriaNoDataProps) {
  return (
    <Card className="text-center py-12">
      <CardContent>
        <div className="flex flex-col items-center space-y-4">
          <AlertCircle className="h-16 w-16 text-muted-foreground" />
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">
              {hasActiveFilters ? "Nenhum dado encontrado" : "Dados não disponíveis"}
            </h3>
            <p className="text-muted-foreground max-w-md">
              {hasActiveFilters 
                ? "Não foram encontrados registros para os filtros aplicados. Tente ajustar os filtros ou limpar as seleções."
                : "Não há dados de volumetria disponíveis no momento. Verifique se os dados foram carregados corretamente."
              }
            </p>
          </div>
          {hasActiveFilters && (
            <Button 
              onClick={onClearFilters}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Limpar Filtros
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}