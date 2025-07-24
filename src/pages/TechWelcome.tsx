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
      <div className="relative z-10 min-h-screen p-6 animate-fade-in flex items-center justify-center">
        {/* Logo/Title Area - Centered in the circle */}
        <div className="text-center">
          <div className={`transform transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h1 className="text-6xl font-bold text-white mb-6 font-orbitron tracking-wider">
              TeleImagem
            </h1>
            <p className="text-2xl text-slate-200 mb-4 font-orbitron font-light tracking-wide">
              Sistema de Gestão
            </p>
            <p className="text-lg text-slate-300 font-orbitron font-light">
              Bem-vindo ao seu centro de comando digital
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions Grid - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pb-8 px-6">
        <div className={`max-w-6xl mx-auto transform transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Card 
                  key={action.path}
                  className={`bg-slate-800/70 border-slate-600 hover:bg-slate-700/70 transition-all duration-300 cursor-pointer transform hover:scale-105 hover:shadow-xl backdrop-blur-md ${isVisible ? 'animate-fade-in' : ''}`}
                  style={{ animationDelay: `${index * 200}ms` }}
                  onClick={() => navigate(action.path)}
                >
                  <CardContent className="p-4 text-center">
                    <Icon className={`w-6 h-6 mx-auto mb-3 ${action.color}`} />
                    <h3 className="text-white font-semibold mb-1 text-sm font-orbitron">{action.title}</h3>
                    <p className="text-slate-400 text-xs">{action.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* CTA Button */}
          <div className="text-center">
            <Button 
              onClick={() => navigate("/dashboard")}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group font-orbitron"
            >
              Entrar no Sistema
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
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