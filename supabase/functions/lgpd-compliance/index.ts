import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LGPDRequest {
  operation: 'consent' | 'withdraw' | 'data_portability' | 'deletion' | 'rectification';
  user_email?: string;
  user_id?: string;
  consent_data?: {
    type: string;
    purpose: string;
    legal_basis: string;
    expires_at?: string;
  };
  ip_address?: string;
  user_agent?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      operation, 
      user_email, 
      user_id, 
      consent_data, 
      ip_address, 
      user_agent 
    }: LGPDRequest = await req.json();

    console.log(`Operação LGPD: ${operation} para ${user_email || user_id}`);

    let result: any = {};

    switch (operation) {
      case 'consent':
        result = await recordConsent(supabase, user_email!, user_id, consent_data!, ip_address, user_agent);
        break;
      case 'withdraw':
        result = await withdrawConsent(supabase, user_email!, user_id, consent_data!.type);
        break;
      case 'data_portability':
        result = await exportUserData(supabase, user_email!, user_id);
        break;
      case 'deletion':
        result = await deleteUserData(supabase, user_email!, user_id);
        break;
      case 'rectification':
        result = await rectifyUserData(supabase, user_email!, user_id);
        break;
      default:
        throw new Error('Operação LGPD não suportada');
    }

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Erro na compliance LGPD:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

async function recordConsent(
  supabase: any,
  email: string,
  userId: string | undefined,
  consentData: any,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  try {
    const { error } = await supabase
      .from('lgpd_consent')
      .insert({
        user_id: userId,
        email: email,
        consent_type: consentData.type,
        purpose: consentData.purpose,
        granted: true,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: consentData.expires_at,
        legal_basis: consentData.legal_basis
      });

    if (error) {
      throw new Error(`Erro ao registrar consentimento: ${error.message}`);
    }

    // Log da operação
    await supabase.rpc('log_audit_event', {
      p_table_name: 'lgpd_consent',
      p_operation: 'INSERT',
      p_record_id: email,
      p_new_data: JSON.stringify({
        type: consentData.type,
        purpose: consentData.purpose,
        granted: true
      }),
      p_severity: 'info'
    });

    return {
      success: true,
      message: 'Consentimento registrado com sucesso',
      consent_type: consentData.type
    };

  } catch (error: any) {
    throw new Error(`Erro ao registrar consentimento: ${error.message}`);
  }
}

async function withdrawConsent(
  supabase: any,
  email: string,
  userId: string | undefined,
  consentType: string
): Promise<any> {
  try {
    const { error } = await supabase
      .from('lgpd_consent')
      .update({
        granted: false,
        withdrawn_at: new Date().toISOString()
      })
      .eq('email', email)
      .eq('consent_type', consentType)
      .eq('granted', true);

    if (error) {
      throw new Error(`Erro ao retirar consentimento: ${error.message}`);
    }

    // Log da operação
    await supabase.rpc('log_audit_event', {
      p_table_name: 'lgpd_consent',
      p_operation: 'UPDATE',
      p_record_id: email,
      p_new_data: JSON.stringify({
        type: consentType,
        granted: false,
        withdrawn_at: new Date().toISOString()
      }),
      p_severity: 'warning'
    });

    return {
      success: true,
      message: 'Consentimento retirado com sucesso',
      consent_type: consentType
    };

  } catch (error: any) {
    throw new Error(`Erro ao retirar consentimento: ${error.message}`);
  }
}

async function exportUserData(
  supabase: any,
  email: string,
  userId: string | undefined
): Promise<any> {
  try {
    console.log(`Exportando dados para ${email}`);

    const userData: Record<string, any> = {
      export_date: new Date().toISOString(),
      user_email: email,
      user_id: userId
    };

    // Buscar dados do perfil
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      userData.profile = profile;
    }

    // Buscar consentimentos
    const { data: consents } = await supabase
      .from('lgpd_consent')
      .select('*')
      .eq('email', email);
    
    userData.consents = consents;

    // Buscar dados relacionados se o usuário for médico
    if (userId) {
      const { data: medicoData } = await supabase
        .from('medicos')
        .select('*')
        .eq('user_id', userId);
      
      if (medicoData && medicoData.length > 0) {
        userData.medico = medicoData[0];
        
        // Buscar exames do médico
        const { data: exames } = await supabase
          .from('exames')
          .select('*')
          .eq('medico_id', medicoData[0].id);
        
        userData.exames = exames;
      }
    }

    // Log da operação
    await supabase.rpc('log_audit_event', {
      p_table_name: 'user_data_export',
      p_operation: 'EXPORT',
      p_record_id: email,
      p_new_data: JSON.stringify({ exported_tables: Object.keys(userData) }),
      p_severity: 'info'
    });

    return {
      success: true,
      message: 'Dados exportados com sucesso',
      data: userData
    };

  } catch (error: any) {
    throw new Error(`Erro ao exportar dados: ${error.message}`);
  }
}

async function deleteUserData(
  supabase: any,
  email: string,
  userId: string | undefined
): Promise<any> {
  try {
    console.log(`Deletando dados para ${email}`);

    const deletedTables: string[] = [];

    // Verificar se há consentimento para deletar os dados
    const { data: validConsent } = await supabase
      .from('lgpd_consent')
      .select('*')
      .eq('email', email)
      .eq('consent_type', 'data_deletion')
      .eq('granted', true)
      .single();

    if (!validConsent) {
      throw new Error('Consentimento para deleção de dados não encontrado');
    }

    // Buscar dados do médico para deletar relacionados
    if (userId) {
      const { data: medicoData } = await supabase
        .from('medicos')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (medicoData) {
        // Deletar exames do médico (apenas se permitido por retenção legal)
        const { error: examesError } = await supabase
          .from('exames')
          .delete()
          .eq('medico_id', medicoData.id);

        if (!examesError) deletedTables.push('exames');

        // Deletar dados do médico
        const { error: medicoError } = await supabase
          .from('medicos')
          .delete()
          .eq('user_id', userId);

        if (!medicoError) deletedTables.push('medicos');
      }

      // Deletar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (!profileError) deletedTables.push('profiles');

      // Deletar roles
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (!rolesError) deletedTables.push('user_roles');
    }

    // Marcar consentimentos como processados
    await supabase
      .from('lgpd_consent')
      .update({ 
        granted: false, 
        withdrawn_at: new Date().toISOString() 
      })
      .eq('email', email);

    // Log da operação
    await supabase.rpc('log_audit_event', {
      p_table_name: 'user_data_deletion',
      p_operation: 'DELETE',
      p_record_id: email,
      p_new_data: JSON.stringify({ deleted_tables: deletedTables }),
      p_severity: 'warning'
    });

    return {
      success: true,
      message: 'Dados deletados conforme solicitado',
      deleted_tables: deletedTables
    };

  } catch (error: any) {
    throw new Error(`Erro ao deletar dados: ${error.message}`);
  }
}

async function rectifyUserData(
  supabase: any,
  email: string,
  userId: string | undefined
): Promise<any> {
  try {
    // Esta função seria implementada para permitir correção de dados
    // Por enquanto, apenas registra a solicitação
    
    await supabase.rpc('log_audit_event', {
      p_table_name: 'user_data_rectification',
      p_operation: 'REQUEST',
      p_record_id: email,
      p_new_data: JSON.stringify({ status: 'requested' }),
      p_severity: 'info'
    });

    return {
      success: true,
      message: 'Solicitação de retificação registrada. Nossa equipe entrará em contato.',
      next_steps: 'Um representante entrará em contato em até 48 horas úteis'
    };

  } catch (error: any) {
    throw new Error(`Erro ao processar retificação: ${error.message}`);
  }
}