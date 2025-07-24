import { 
  BarChart3, 
  Settings, 
  Home, 
  TrendingUp, 
  DollarSign, 
  Users2,
  Activity,
  Target,
  Award,
  ChevronDown,
  FileText,
  Network,
  AlertTriangle,
  Upload,
  User,
  KeyRound,
  LogOut
} from "lucide-react";

import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useUserPermissions, useHasMenuPermission, UserRole } from "@/hooks/useUserPermissions";
import { useLogomarca } from "@/hooks/useLogomarca";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { CircularLight } from "@/components/CircularLight";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  requiredRoles: UserRole[];
  subItems?: SubMenuItem[];
}

interface SubMenuItem {
  title: string;
  url: string;
  requiredRoles: UserRole[];
}

const menuItems: MenuItem[] = [
  { 
    title: "Dashboard", 
    url: "/", 
    icon: Home,
    requiredRoles: ['user', 'manager', 'admin'],
    subItems: [
      { title: "Faturamento", url: "/financeiro/faturamento", requiredRoles: ['manager', 'admin'] },
      { title: "Volumetria", url: "/volumetria", requiredRoles: ['user', 'manager', 'admin'] },
      { title: "Qualidade", url: "/operacional/qualidade", requiredRoles: ['manager', 'admin'] },
    ]
  },
  { 
    title: "Operacional", 
    url: "/operacional", 
    icon: Activity,
    requiredRoles: ['manager', 'admin'],
    subItems: [
      { title: "Escala", url: "/operacional/escala", requiredRoles: ['manager', 'admin'] },
    ]
  },
  { 
    title: "Financeiro", 
    url: "/financeiro", 
    icon: DollarSign,
    requiredRoles: ['manager', 'admin'],
    subItems: [
      { title: "Gerar Faturamento", url: "/financeiro/gerar-faturamento", requiredRoles: ['manager', 'admin'] },
      { title: "Pagamento Médico", url: "/financeiro/pagamentos", requiredRoles: ['admin'] },
      { title: "Régua de Cobrança", url: "/financeiro/regua-cobranca", requiredRoles: ['manager', 'admin'] },
      { title: "Fluxo de Caixa", url: "/financeiro/fluxo-caixa", requiredRoles: ['admin'] },
      { title: "DRE", url: "/financeiro/dre", requiredRoles: ['admin'] },
    ]
  },
  { 
    title: "People", 
    url: "/people", 
    icon: Users2,
    requiredRoles: ['manager', 'admin'],
    subItems: [
      { title: "Colaboradores", url: "/people/colaboradores", requiredRoles: ['manager', 'admin'] },
      { title: "Plano de Carreira", url: "/people/carreira", requiredRoles: ['admin'] },
      { title: "Desenvolvimento", url: "/people/desenvolvimento", requiredRoles: ['admin'] },
      { title: "Bonificação", url: "/people/bonificacao", requiredRoles: ['admin'] },
    ]
  },
  { 
    title: "Clientes", 
    url: "/clientes", 
    icon: Users2,
    requiredRoles: ['manager', 'admin'],
    subItems: [
      { title: "Cadastro de Clientes", url: "/clientes/cadastro", requiredRoles: ['manager', 'admin'] },
      { title: "Contratos Clientes", url: "/contratos/clientes", requiredRoles: ['manager', 'admin'] },
    ]
  },
  { 
    title: "Contratos Fornecedores", 
    url: "/contratos/fornecedores", 
    icon: FileText,
    requiredRoles: ['admin'],
  },
  { 
    title: "Configuração", 
    url: "/configuracao", 
    icon: Settings,
    requiredRoles: ['admin'],
    subItems: [
      { title: "Configuração de Faturamento", url: "/configuracao/faturamento", requiredRoles: ['admin'] },
      { title: "Gerenciar Usuários", url: "/configuracao/usuarios", requiredRoles: ['admin'] },
      { title: "Listas do Sistema", url: "/configuracao/listas", requiredRoles: ['admin'] },
      { title: "Logomarca", url: "/configuracao/logomarca", requiredRoles: ['admin'] },
      { title: "Estrutura de Vendas", url: "/estrutura-vendas", requiredRoles: ['admin'] },
      { title: "Configuração Importação", url: "/configuracao-importacao", requiredRoles: ['admin'] },
      { title: "Arquitetura do Projeto", url: "/arquitetura", requiredRoles: ['admin'] },
    ]
  },
  { 
    title: "Controle de Regras", 
    url: "/controle-regras", 
    icon: Target,
    requiredRoles: ['admin'],
  },
  { 
    title: "Relatório de Implementações", 
    url: "/relatorio-implementacoes", 
    icon: FileText,
    requiredRoles: ['admin'],
  },
  { 
    title: "Pendências", 
    url: "/pendencias", 
    icon: AlertTriangle,
    requiredRoles: ['manager', 'admin'],
  },
  { 
    title: "Upload de Dados", 
    url: "/upload-dados", 
    icon: Upload,
    requiredRoles: ['manager', 'admin'],
  },
  { 
    title: "Meu Perfil", 
    url: "/meu-perfil", 
    icon: User,
    requiredRoles: ['user', 'manager', 'admin'],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";
  const permissions = useUserPermissions();
  const { logoUrl } = useLogomarca();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const isActiveRoute = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  // Verificar permissão para cada menu
  const getMenuPermission = (url: string) => {
    const menuKey = url === '/' ? 'dashboard' : url.substring(1).replace(/\//g, '-');
    
    if (permissions.loading) return false;
    
    // Se é admin, tem acesso a tudo
    if (permissions.isAdmin) return true;
    
    // Verificar se há permissão customizada para este menu
    if (menuKey in permissions.menuPermissions) {
      return permissions.menuPermissions[menuKey];
    }
    
    // Permissões padrão baseadas em roles (fallback)
    const defaultPermissions: Record<string, UserRole[]> = {
      'dashboard': ['admin', 'manager', 'user'],
      'operacional': ['admin', 'manager'],
      'financeiro': ['admin', 'manager'],
      'people': ['admin', 'manager'],
      'clientes': ['admin', 'manager'],
      'contratos-fornecedores': ['admin'],
      'configuracao': ['admin'],
      'volumetria': ['admin', 'manager', 'user'],
      'meu-perfil': ['admin', 'manager', 'user'],
    };
    
    const allowedRoles = defaultPermissions[menuKey] || [];
    return permissions.roles.some(role => allowedRoles.includes(role));
  };

  // Filtrar itens do menu baseado nas permissões do usuário
  const filteredMenuItems = menuItems.filter(item => {
    return getMenuPermission(item.url);
  });

  return (
    <Sidebar className={collapsed ? "w-16" : "w-64"}>
      <SidebarContent>
        <div className="relative p-6 border-b bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-hidden min-h-[100px]">
          {/* Efeito de globo animado para o sidebar */}
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            {/* Círculo principal do globo */}
            <div 
              className="w-20 h-20 rounded-full border-2 border-cyan-400/40 relative"
              style={{
                background: `
                  radial-gradient(circle at 30% 30%, 
                    rgba(100, 200, 255, 0.2) 0%,
                    rgba(0, 150, 255, 0.1) 40%,
                    rgba(0, 100, 200, 0.05) 70%,
                    transparent 100%
                  )
                `,
                animation: 'spin 20s linear infinite'
              }}
            >
              {/* Pontos de conexão simulando o globo */}
              <div className="absolute top-2 left-3 w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
              <div className="absolute top-4 right-4 w-1 h-1 bg-blue-300 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
              <div className="absolute bottom-3 left-4 w-1 h-1 bg-cyan-300 rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
              <div className="absolute bottom-4 right-3 w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
              <div className="absolute top-6 left-6 w-1 h-1 bg-cyan-500 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>
              
              {/* Linhas de conexão */}
              <div className="absolute top-3 left-4 w-8 h-px bg-gradient-to-r from-cyan-400/60 to-transparent transform rotate-45"></div>
              <div className="absolute bottom-5 right-5 w-6 h-px bg-gradient-to-l from-blue-400/60 to-transparent transform -rotate-45"></div>
            </div>
          </div>
          
          {/* Texto sobre o globo */}
          <div className="relative z-10 flex items-center justify-center">
            {!collapsed && (
              <div className="text-center">
                <h2 className="font-bold text-lg text-white font-orbitron tracking-wider drop-shadow-lg">
                  Teleimagem
                </h2>
                <p className="text-sm text-cyan-100 font-orbitron font-light tracking-wide">
                  Sistema de Gestão
                </p>
              </div>
            )}
            {collapsed && (
              <div className="text-center">
                <h2 className="font-bold text-sm text-white font-orbitron tracking-wider drop-shadow-lg">
                  TI
                </h2>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2 flex-1">
          {permissions.loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Carregando menu...
            </div>
          ) : (
            filteredMenuItems.map((item) => {
              if (item.subItems && !collapsed) {
                return (
                  <div key={item.title} className="px-3 py-2">
                    <Collapsible defaultOpen={isActiveRoute(item.url)}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-left text-sm font-medium text-sidebar-foreground hover:bg-gradient-to-r hover:from-cyan-600/10 hover:to-slate-600/10 hover:text-cyan-600 rounded-md transition-all duration-300 ease-smooth">
                        <div className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </div>
                        <ChevronDown className="h-4 w-4 transition-transform duration-300" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1 space-y-1">
                        {item.subItems?.map((subItem) => (
                          <NavLink
                            key={subItem.title}
                            to={subItem.url}
                            className={({ isActive }) =>
                              `block py-2 px-4 ml-6 text-sm rounded-md transition-all duration-300 ease-smooth ${
                                isActive
                                  ? "bg-gradient-to-r from-cyan-600 to-slate-600 text-white font-medium shadow-lg"
                                  : "text-sidebar-foreground hover:bg-gradient-to-r hover:from-cyan-600/10 hover:to-slate-600/10 hover:text-cyan-600"
                              }`
                            }
                          >
                            {subItem.title}
                          </NavLink>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              }

              return (
                <div key={item.title} className="px-3 py-1">
                  <NavLink
                    to={item.url}
                    className={({ isActive }) =>
                      `flex items-center gap-2 p-2 text-sm rounded-md transition-all duration-300 ease-smooth ${
                        isActive
                          ? "bg-gradient-to-r from-cyan-600 to-slate-600 text-white font-medium shadow-lg"
                          : "text-sidebar-foreground hover:bg-gradient-to-r hover:from-cyan-600/10 hover:to-slate-600/10 hover:text-cyan-600"
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.title}</span>}
                  </NavLink>
                </div>
              );
            })
          )}
        </div>

        {/* Footer com informações do usuário e logout */}
        <div className="p-3 border-t border-border bg-gradient-to-r from-slate-50 to-cyan-50 dark:from-slate-900 dark:to-cyan-950">
          {!collapsed && user && (
            <div className="mb-3 p-2 rounded-md bg-white/50 dark:bg-slate-800/50 border border-cyan-200/50 dark:border-cyan-700/50">
              <div className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                {user.email}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Sistema Ativo
              </div>
            </div>
          )}
          
          <Button
            onClick={handleLogout}
            variant="outline"
            size={collapsed ? "icon" : "sm"}
            className={`w-full bg-gradient-to-r from-cyan-600 to-slate-600 hover:from-cyan-700 hover:to-slate-700 text-white border-cyan-400/20 shadow-lg hover:shadow-xl transition-all duration-300 ${
              collapsed ? "h-10 w-10" : ""
            }`}
          >
            <LogOut className={`h-4 w-4 ${collapsed ? "" : "mr-2"}`} />
            {!collapsed && "Sair do Sistema"}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}