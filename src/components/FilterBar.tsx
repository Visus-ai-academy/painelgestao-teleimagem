
import { Calendar, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

interface FilterBarProps {
  onPeriodChange?: (period: string) => void;
  onModalityChange?: (modality: string) => void;
  onSpecialtyChange?: (specialty: string) => void;
}

export function FilterBar({ onPeriodChange, onModalityChange, onSpecialtyChange }: FilterBarProps) {
  return (
    <Card className="p-4 mb-6">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtros:</span>
        </div>
        
        <Select onValueChange={onPeriodChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="diario">Diário</SelectItem>
            <SelectItem value="mensal">Mensal</SelectItem>
            <SelectItem value="anual">Anual</SelectItem>
          </SelectContent>
        </Select>

        <Select onValueChange={onModalityChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Modalidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MR">MR</SelectItem>
            <SelectItem value="CT">CT</SelectItem>
            <SelectItem value="DO">DO</SelectItem>
            <SelectItem value="MG">MG</SelectItem>
            <SelectItem value="RX">RX</SelectItem>
          </SelectContent>
        </Select>

        <Select onValueChange={onSpecialtyChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Especialidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CA">CA</SelectItem>
            <SelectItem value="NE">NE</SelectItem>
            <SelectItem value="ME">ME</SelectItem>
            <SelectItem value="MI">MI</SelectItem>
            <SelectItem value="MA">MA</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm">
          <Calendar className="h-4 w-4 mr-2" />
          Data personalizada
        </Button>
      </div>
    </Card>
  );
}
