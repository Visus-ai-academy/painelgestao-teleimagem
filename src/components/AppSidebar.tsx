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
  Network
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
    title: "Contratos", 
    url: "/contratos", 
    icon: FileText,
    requiredRoles: ['manager', 'admin'],
    subItems: [
      { title: "Contratos Clientes", url: "/contratos/clientes", requiredRoles: ['manager', 'admin'] },
      { title: "Contratos Fornecedores", url: "/contratos/fornecedores", requiredRoles: ['admin'] },
    ]
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
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";
  const permissions = useUserPermissions();
  const { logoUrl } = useLogomarca();

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
      'contratos': ['admin', 'manager'],
      'configuracao': ['admin'],
      'volumetria': ['admin', 'manager', 'user'],
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
        <div className="p-6 border-b bg-gradient-subtle">
          <div className="flex items-center gap-2">
            <img 
              src={logoUrl} 
              alt="Teleimagem Logo" 
              className="h-8 w-auto object-contain"
            />
            {!collapsed && (
              <div>
                <h2 className="font-bold text-lg text-foreground">Painel de Gestão</h2>
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
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-left text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md btn-3d transition-all duration-300 ease-smooth">
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
                              `block py-2 px-4 ml-6 text-sm rounded-md transition-all duration-300 ease-smooth btn-3d ${
                                isActive
                                  ? "bg-gradient-primary text-primary-foreground font-medium shadow-3d-hover scale-105"
                                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-105"
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
                      `flex items-center gap-2 p-2 text-sm rounded-md transition-all duration-300 ease-smooth btn-3d ${
                        isActive
                          ? "bg-gradient-primary text-primary-foreground font-medium shadow-3d-hover scale-105"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:scale-105"
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
      </SidebarContent>
    </Sidebar>
  );
}