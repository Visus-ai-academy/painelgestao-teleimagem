import { useEffect, useState } from "react";
import { CityLightBeams } from "@/components/CityLightBeams";
import { CircularLight } from "@/components/CircularLight";
import { HandMovement } from "@/components/HandMovement";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Zap, BarChart3, Users, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import smartCityBg from "@/assets/smart-city-background.png";

export default function TechWelcome() {
  const [isVisible, setIsVisible] = useState(false);
  const [fallingButton, setFallingButton] = useState<string | null>(null);
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

  const handleButtonClick = (action: typeof quickActions[0]) => {
    setFallingButton(action.path);
    
    // Animate for 1.5 seconds then navigate
    setTimeout(() => {
      setFallingButton(null);
      navigate(action.path);
    }, 1500);
  };

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
      
      {/* Circular Light Animation over the circle */}
      <CircularLight size={350} />
      
      {/* Hand Movement Animation */}
      <HandMovement width={300} height={200} />
      
      
      {/* Content */}
      <div className="relative z-10 min-h-screen p-6 animate-fade-in">
        {/* Logo/Title Area - Positioned specifically in the circle above the hand */}
        <div className="absolute left-[36%] top-[35%] transform -translate-x-1/2 -translate-y-1/2 text-center">
          <div className={`transform transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h1 className="text-6xl font-bold text-white mb-6 font-orbitron tracking-wider drop-shadow-2xl">
              TeleImagem
            </h1>
            <p className="text-2xl text-cyan-100 mb-4 font-orbitron font-light tracking-wide drop-shadow-lg">
              Sistema de Gestão
            </p>
            <p className="text-lg text-blue-100 font-orbitron font-light drop-shadow-lg">
              Bem-vindo ao centro de comando
            </p>
          </div>
        </div>
      </div>


      {/* CTA Button - Bottom center */}
      <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-20">
        <Button 
          onClick={() => navigate("/dashboard")}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group font-orbitron"
        >
          Entrar no Sistema
          <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>

      {/* Floating Elements */}
      <div className="absolute top-20 left-20 w-32 h-32 border border-cyan-400/20 rounded-full animate-pulse" />
      <div className="absolute bottom-20 right-20 w-24 h-24 border border-purple-400/20 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-10 w-16 h-16 border border-blue-400/20 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
    </div>
  );
}