import { useEffect, useState } from "react";
import { CityLightBeams } from "@/components/CityLightBeams";
import { CircularLight } from "@/components/CircularLight";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Zap, BarChart3, Users, Settings, Lock, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import smartCityBg from "@/assets/smart-city-background.png";

export default function TechWelcome() {
  const [isVisible, setIsVisible] = useState(false);
  const [fallingButton, setFallingButton] = useState<string | null>(null);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, user } = useAuth();

  useEffect(() => {
    setIsVisible(true);
    // If user is already logged in, redirect to dashboard
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleAccessCommand = () => {
    setShowLoginForm(!showLoginForm);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error("Erro ao fazer login: " + error.message);
      } else {
        toast.success("Login realizado com sucesso!");
        navigate("/dashboard");
      }
    } catch (error) {
      toast.error("Erro inesperado ao fazer login");
    } finally {
      setIsLoading(false);
    }
  };

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
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80 md:opacity-80"
        style={{
          backgroundImage: `url(/lovable-uploads/f85b584a-daae-4d31-843b-9be596609285.png)`
        }}
      />
      
      {/* Animated Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse" />
      
      {/* Circular Light Animation - Hidden on mobile */}
      <div className="hidden md:block">
        <CircularLight size={350} />
      </div>
      
      {/* Content */}
      <div className="relative z-10 min-h-screen p-4 md:p-6 animate-fade-in">
        {/* Header with access button - Responsive positioning */}
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-30">
          <Button 
            onClick={handleAccessCommand}
            className="bg-gradient-to-r from-cyan-600 to-slate-600 hover:from-cyan-700 hover:to-slate-700 text-white px-3 py-2 md:px-6 md:py-2 text-xs md:text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group font-orbitron border border-cyan-400/20"
          >
            <span className="hidden sm:inline">Acessar Sistema de Gestão</span>
            <span className="sm:hidden">Acessar Sistema</span>
            <Lock className="ml-1 md:ml-2 w-3 h-3 md:w-4 md:h-4 group-hover:scale-110 transition-transform" />
          </Button>
        </div>

        {/* Login Form - Responsive positioning */}
        {showLoginForm && (
          <div className="absolute top-16 right-4 left-4 md:top-20 md:right-6 md:left-auto z-30 animate-fade-in">
            <Card className="w-full md:w-80 bg-slate-900/95 backdrop-blur-sm border-cyan-500/20 shadow-2xl">
              <CardContent className="p-4 md:p-6">
                <div className="text-center mb-4 md:mb-6">
                  <Lock className="h-6 w-6 md:h-8 md:w-8 mx-auto mb-2 text-cyan-400" />
                  <h3 className="text-base md:text-lg font-semibold text-white font-orbitron">Acesso Seguro</h3>
                  <p className="text-xs md:text-sm text-cyan-100/80">Entre com suas credenciais</p>
                </div>
                
                <form onSubmit={handleLogin} className="space-y-3 md:space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-cyan-100 font-orbitron text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-cyan-400" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-slate-800/50 border-cyan-500/30 text-white placeholder:text-cyan-100/50 focus:border-cyan-400"
                        placeholder="seu@email.com"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-cyan-100 font-orbitron text-sm">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-cyan-400" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-slate-800/50 border-cyan-500/30 text-white placeholder:text-cyan-100/50 focus:border-cyan-400"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold py-2 font-orbitron disabled:opacity-50"
                  >
                    {isLoading ? "Autenticando..." : "Acessar Sistema"}
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Logo/Title Area - Responsive positioning and sizing */}
        <div className="absolute left-1/2 top-1/2 md:left-[36%] md:top-[35%] transform -translate-x-1/2 -translate-y-1/2 text-center px-4">
          <div className={`transform transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h1 className="text-3xl md:text-6xl font-bold text-white mb-4 md:mb-6 font-orbitron tracking-wider drop-shadow-2xl">
              TeleImagem
            </h1>
            <p className="text-lg md:text-2xl text-cyan-100 mb-2 md:mb-4 font-orbitron font-light tracking-wide drop-shadow-lg">
              Sistema de Gestão
            </p>
            <p className="text-sm md:text-lg text-blue-100 font-orbitron font-light drop-shadow-lg">
              Bem-vindo ao centro de comando
            </p>
          </div>
        </div>
      </div>

      {/* Floating Elements - Responsive sizing and positioning */}
      <div className="absolute top-10 left-10 md:top-20 md:left-20 w-16 h-16 md:w-32 md:h-32 border border-cyan-400/20 rounded-full animate-pulse" />
      <div className="absolute bottom-10 right-10 md:bottom-20 md:right-20 w-12 h-12 md:w-24 md:h-24 border border-purple-400/20 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-4 md:left-10 w-8 h-8 md:w-16 md:h-16 border border-blue-400/20 rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
    </div>
  );
}