
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
  ChevronDown
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

const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { 
    title: "Volumetria", 
    url: "/volumetria", 
    icon: BarChart3,
    subItems: [
      { title: "Volume Diário", url: "/volumetria/diario" },
      { title: "Volume Mensal", url: "/volumetria/mensal" },
      { title: "Volume Anual", url: "/volumetria/anual" },
      { title: "Por Modalidade", url: "/volumetria/modalidade" },
    ]
  },
  { 
    title: "Operacional", 
    url: "/operacional", 
    icon: Activity,
    subItems: [
      { title: "Produção", url: "/operacional/producao" },
      { title: "Qualidade", url: "/operacional/qualidade" },
      { title: "Escala", url: "/operacional/escala" },
    ]
  },
  { 
    title: "Financeiro", 
    url: "/financeiro", 
    icon: DollarSign,
    subItems: [
      { title: "Faturamento", url: "/financeiro/faturamento" },
      { title: "Pagamentos Médicos", url: "/financeiro/pagamentos" },
      { title: "Fluxo de Caixa", url: "/financeiro/fluxo-caixa" },
      { title: "DRE", url: "/financeiro/dre" },
    ]
  },
  { 
    title: "People", 
    url: "/people", 
    icon: Users2,
    subItems: [
      { title: "Plano de Carreira", url: "/people/carreira" },
      { title: "Desenvolvimento", url: "/people/desenvolvimento" },
      { title: "Bonificação", url: "/people/bonificacao" },
    ]
  },
];

export function AppSidebar() {
  const { collapsed } = useSidebar();
  const location = useLocation();

  const isActiveRoute = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

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

        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                if (item.subItems && !collapsed) {
                  return (
                    <Collapsible key={item.title} defaultOpen={isActiveRoute(item.url)}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton className="w-full">
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                            <ChevronDown className="ml-auto h-4 w-4" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.subItems.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton asChild>
                                  <NavLink 
                                    to={subItem.url}
                                    className={({ isActive }) =>
                                      isActive ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-gray-50"
                                    }
                                  >
                                    {subItem.title}
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink 
                        to={item.url}
                        className={({ isActive }) =>
                          isActive ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-gray-50"
                        }
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
