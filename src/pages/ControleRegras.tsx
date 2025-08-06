import { ControleRegrasNegocio } from '@/components/ControleRegrasNegocio';

export default function ControleRegras() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Controle de Regras</h1>
        <p className="text-muted-foreground mt-1">
          Gerenciamento completo de todas as regras implementadas no sistema
        </p>
      </div>
      
      <ControleRegrasNegocio />
    </div>
  );
}