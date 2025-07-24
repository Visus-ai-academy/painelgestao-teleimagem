import { useEffect, useState } from "react";
import { CityLightBeams } from "@/components/CityLightBeams";
import smartCityBg from "@/assets/smart-city-background.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Zap, BarChart3, Users, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TechWelcome() {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const quickActions = [
    {
      title: "Dashboard Executivo", 
      description: "Visão geral dos indicadores",
      icon: BarChart3,
      path: "/dashboard",
      color: "text-blue-400"
    },
    {
      title: "Volumetria",
      description: "Análise de dados volumétricos", 
      icon: Zap,
      path: "/volumetria",
      color: "text-green-400"
    },
    {
      title: "Gestão de Pessoas",
      description: "Médicos e colaboradores",
      icon: Users,
      path: "/people", 
      color: "text-purple-400"
    },
    {
      title: "Configurações",
      description: "Ajustes do sistema",
      icon: Settings,
      path: "/configuracao/usuarios",
      color: "text-orange-400"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80"
        style={{
          backgroundImage: `url(/lovable-uploads/f85b584a-daae-4d31-843b-9be596609285.png)`
        }}
      />
      
      {/* Animated Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse" />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen p-6 animate-fade-in flex flex-col">
        {/* Logo/Title Area - Top Section */}
        <div className="text-center pt-20">
          <div className={`transform transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h1 className="text-5xl font-bold text-white mb-4">
              TeleImagem
            </h1>
            <p className="text-xl text-slate-300 mb-2">
              Sistema de Gestão
            </p>
            <p className="text-sm text-slate-400">
              Bem-vindo ao seu centro de comando digital
            </p>
          </div>
        </div>

        {/* Spacer to push content to bottom */}
        <div className="flex-1"></div>

        {/* Quick Actions Grid - Bottom Section */}
        <div className="pb-20">
          <div className={`max-w-4xl mx-auto text-center transform transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <Card 
                    key={action.path}
                    className={`bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 transition-all duration-300 cursor-pointer transform hover:scale-105 hover:shadow-xl backdrop-blur-sm ${isVisible ? 'animate-fade-in' : ''}`}
                    style={{ animationDelay: `${index * 200}ms` }}
                    onClick={() => navigate(action.path)}
                  >
                    <CardContent className="p-6 text-center">
                      <Icon className={`w-8 h-8 mx-auto mb-4 ${action.color}`} />
                      <h3 className="text-white font-semibold mb-2">{action.title}</h3>
                      <p className="text-slate-400 text-sm">{action.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* CTA Button */}
            <div className="space-y-4">
              <Button 
                onClick={() => navigate("/dashboard")}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
              >
                Entrar no Sistema
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <p className="text-slate-400 text-sm">
                Acesse todas as funcionalidades do sistema
              </p>
            </div>

            {/* Tech Animation Indicators */}
            <div className="mt-8 flex justify-center space-x-2">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i}
                  className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Elements */}
      <div className="absolute top-20 left-20 w-32 h-32 border border-cyan-400/20 rounded-full animate-pulse" />
      <div className="absolute bottom-20 right-20 w-24 h-24 border border-purple-400/20 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-10 w-16 h-16 border border-blue-400/20 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
    </div>
  );
}