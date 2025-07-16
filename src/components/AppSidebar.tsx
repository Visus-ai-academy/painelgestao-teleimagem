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
  FileText
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
import { useUserPermissions, UserRole } from "@/hooks/useUserPermissions";

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
    requiredRoles: ['user', 'manager', 'admin']
  },
  { 
    title: "Volumetria", 
    url: "/volumetria", 
    icon: BarChart3,
    requiredRoles: ['user', 'manager', 'admin'],
    subItems: [
      { title: "Volume Diário", url: "/volumetria/diario", requiredRoles: ['user', 'manager', 'admin'] },
      { title: "Volume Mensal", url: "/volumetria/mensal", requiredRoles: ['user', 'manager', 'admin'] },
      { title: "Volume Anual", url: "/volumetria/anual", requiredRoles: ['user', 'manager', 'admin'] },
      { title: "Por Modalidade", url: "/volumetria/modalidade", requiredRoles: ['user', 'manager', 'admin'] },
    ]
  },
  { 
    title: "Operacional", 
    url: "/operacional", 
    icon: Activity,
    requiredRoles: ['manager', 'admin'],
    subItems: [
      { title: "Produção", url: "/operacional/producao", requiredRoles: ['manager', 'admin'] },
      { title: "Qualidade", url: "/operacional/qualidade", requiredRoles: ['manager', 'admin'] },
      { title: "Escala", url: "/operacional/escala", requiredRoles: ['manager', 'admin'] },
    ]
  },
  { 
    title: "Financeiro", 
    url: "/financeiro", 
    icon: DollarSign,
    requiredRoles: ['manager', 'admin'],
    subItems: [
      { title: "Faturamento", url: "/financeiro/faturamento", requiredRoles: ['manager', 'admin'] },
      { title: "Gerar Faturamento", url: "/financeiro/gerar-faturamento", requiredRoles: ['manager', 'admin'] },
      { title: "Régua de Cobrança", url: "/financeiro/regua-cobranca", requiredRoles: ['manager', 'admin'] },
      { title: "Pagamentos Médicos", url: "/financeiro/pagamentos", requiredRoles: ['admin'] },
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
    ]
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";
  const permissions = useUserPermissions();

  const isActiveRoute = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  // Filtrar itens do menu baseado nas permissões do usuário
  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    if (permissions.loading) return [];
    
    return items.filter(item => {
      // Verificar se o usuário tem permissão para o item principal
      const hasMainPermission = item.requiredRoles.some(role => permissions.roles.includes(role));
      if (!hasMainPermission) return false;

      // Filtrar subitens se existirem
      if (item.subItems) {
        item.subItems = item.subItems.filter(subItem => 
          subItem.requiredRoles.some(role => permissions.roles.includes(role))
        );
      }

      return true;
    });
  };

  const filteredMenuItems = filterMenuItems(menuItems);

  return (
    <Sidebar className={collapsed ? "w-16" : "w-64"}>
      <SidebarContent>
        <div className="p-6 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-bold text-lg text-gray-800">MedSystem</h2>
                <p className="text-sm text-gray-500">Dashboard</p>
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
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md">
                        <div className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </div>
                        <ChevronDown className="h-4 w-4" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-1 space-y-1">
                        {item.subItems?.map((subItem) => (
                          <NavLink
                            key={subItem.title}
                            to={subItem.url}
                            className={({ isActive }) =>
                              `block py-2 px-4 ml-6 text-sm rounded-md transition-colors ${
                                isActive
                                  ? "bg-blue-50 text-blue-700 font-medium"
                                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
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
                      `flex items-center gap-2 p-2 text-sm rounded-md transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
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