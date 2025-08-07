import { ControleRegrasNegocio } from '@/components/ControleRegrasNegocio';

export default function ControleRegras() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Controle de Regras de Negócio</h1>
        <p className="text-muted-foreground mt-1">
          Gerenciamento de regras de negócio e proteção temporal de dados
        </p>
      </div>
      
      <ControleRegrasNegocio />
    </div>
  );
}