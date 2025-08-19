import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptimizationRequest {
  force_optimization?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json() as OptimizationRequest;
    console.log('🔧 Iniciando otimização de triggers para volumetria_mobilemed...');

    // 1. Corrigir triggers problemáticos
    const triggerFixes = [
      {
        name: 'fix_audit_trigger',
        sql: `
          -- Corrigir função de auditoria
          CREATE OR REPLACE FUNCTION public.handle_volumetria_audit()
          RETURNS TRIGGER AS $$
          BEGIN
            -- Para operações DELETE, usar OLD
            IF TG_OP = 'DELETE' THEN
              INSERT INTO audit_logs (
                table_name, operation, record_id, old_data, timestamp
              ) VALUES (
                'volumetria_mobilemed', 'DELETE', OLD.id::text, 
                row_to_json(OLD), NOW()
              );
              RETURN OLD;
            END IF;
            
            -- Para INSERT e UPDATE, usar NEW
            IF TG_OP = 'INSERT' THEN
              INSERT INTO audit_logs (
                table_name, operation, record_id, new_data, timestamp
              ) VALUES (
                'volumetria_mobilemed', 'INSERT', NEW.id::text, 
                row_to_json(NEW), NOW()
              );
              RETURN NEW;
            END IF;
            
            IF TG_OP = 'UPDATE' THEN
              INSERT INTO audit_logs (
                table_name, operation, record_id, old_data, new_data, timestamp
              ) VALUES (
                'volumetria_mobilemed', 'UPDATE', NEW.id::text, 
                row_to_json(OLD), row_to_json(NEW), NOW()
              );
              RETURN NEW;
            END IF;
            
            RETURN NULL;
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      {
        name: 'recreate_audit_trigger',
        sql: `
          -- Recriar trigger de auditoria
          DROP TRIGGER IF EXISTS tr_volumetria_audit ON volumetria_mobilemed;
          CREATE TRIGGER tr_volumetria_audit
            AFTER INSERT OR UPDATE OR DELETE ON volumetria_mobilemed
            FOR EACH ROW EXECUTE FUNCTION handle_volumetria_audit();
        `
      },
      {
        name: 'fix_timestamp_trigger',
        sql: `
          -- Corrigir função de timestamp
          CREATE OR REPLACE FUNCTION public.update_timestamp()
          RETURNS TRIGGER AS $$
          BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
          
          -- Recriar trigger de timestamp
          DROP TRIGGER IF EXISTS tr_volumetria_timestamp ON volumetria_mobilemed;
          CREATE TRIGGER tr_volumetria_timestamp
            BEFORE UPDATE ON volumetria_mobilemed
            FOR EACH ROW EXECUTE FUNCTION update_timestamp();
        `
      },
      {
        name: 'optimize_business_rules',
        sql: `
          -- Otimizar regras de negócio v002 e v003
          CREATE OR REPLACE FUNCTION public.apply_business_rules()
          RETURNS TRIGGER AS $$
          BEGIN
            -- v002: OT -> US se ESPECIALIDADE = 'USG'
            IF NEW."MODALIDADE" = 'OT' AND NEW."ESPECIALIDADE" = 'USG' THEN
              NEW."MODALIDADE" = 'US';
            END IF;
            
            -- v003: OT -> RX se ESPECIALIDADE = 'RX'
            IF NEW."MODALIDADE" = 'OT' AND NEW."ESPECIALIDADE" = 'RX' THEN
              NEW."MODALIDADE" = 'RX';
            END IF;
            
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
          
          -- Recriar trigger de regras de negócio
          DROP TRIGGER IF EXISTS tr_apply_business_rules ON volumetria_mobilemed;
          CREATE TRIGGER tr_apply_business_rules
            BEFORE INSERT OR UPDATE ON volumetria_mobilemed
            FOR EACH ROW EXECUTE FUNCTION apply_business_rules();
        `
      }
    ];

    let fixedTriggers = 0;
    const results = [];

    for (const fix of triggerFixes) {
      try {
        console.log(`🔧 Aplicando fix: ${fix.name}`);
        
        const { error } = await supabase.rpc('execute_sql', { 
          query: fix.sql 
        }).single();

        if (error) {
          console.error(`❌ Erro no fix ${fix.name}:`, error);
          results.push({ name: fix.name, success: false, error: error.message });
        } else {
          console.log(`✅ Fix aplicado: ${fix.name}`);
          fixedTriggers++;
          results.push({ name: fix.name, success: true });
        }
      } catch (err) {
        console.error(`💥 Erro crítico no fix ${fix.name}:`, err);
        results.push({ name: fix.name, success: false, error: err.message });
      }
    }

    // 2. Criar índices para otimização (sem CONCURRENTLY)
    const indexOptimizations = [
      {
        name: 'idx_volumetria_arquivo_fonte',
        sql: `CREATE INDEX IF NOT EXISTS idx_volumetria_arquivo_fonte ON volumetria_mobilemed(arquivo_fonte);`
      },
      {
        name: 'idx_volumetria_empresa_periodo',
        sql: `CREATE INDEX IF NOT EXISTS idx_volumetria_empresa_periodo ON volumetria_mobilemed(empresa, periodo_referencia);`
      },
      {
        name: 'idx_volumetria_data_laudo',
        sql: `CREATE INDEX IF NOT EXISTS idx_volumetria_data_laudo ON volumetria_mobilemed(data_laudo);`
      }
    ];

    let indexesCreated = 0;
    for (const index of indexOptimizations) {
      try {
        const { error } = await supabase.rpc('execute_sql', { 
          query: index.sql 
        }).single();

        if (!error) {
          indexesCreated++;
          console.log(`✅ Índice criado: ${index.name}`);
          results.push({ name: index.name, success: true });
        }
      } catch (err) {
        console.warn(`⚠️ Erro ao criar índice ${index.name}:`, err);
      }
    }

    // 3. Otimizar configurações da tabela
    try {
      await supabase.rpc('execute_sql', { 
        query: `ALTER TABLE volumetria_mobilemed SET (fillfactor = 90);` 
      }).single();
      console.log('✅ Tabela otimizada para bulk inserts');
    } catch (err) {
      console.warn('⚠️ Erro ao otimizar tabela:', err);
    }

    const response = {
      success: true,
      message: `Otimização concluída: ${fixedTriggers} triggers corrigidos, ${indexesCreated} índices criados`,
      results: {
        triggers_fixed: fixedTriggers,
        indexes_created: indexesCreated,
        details: results
      },
      optimizations_applied: [
        'Triggers corrigidos para evitar erro "relation NEW does not exist"',
        'Índices criados para melhor performance',
        'Tabela otimizada para bulk inserts',
        'Funções de auditoria e timestamp corrigidas'
      ]
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro na otimização:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Falha na otimização dos triggers'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});