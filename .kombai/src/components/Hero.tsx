import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Globe, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import heroBg from "@/assets/hero-bg.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img src={heroBg} alt="" className="w-full h-full object-cover opacity-10" />
      </div>
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/90 to-muted/20" />
      <div className="absolute inset-0">
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse-glow animation-delay-2000" />
      </div>

      {/* Grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.1)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.1)_1px,transparent_1px)] bg-[size:4rem_4rem]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="flex justify-center mb-6 animate-slide-up">
          <Badge variant="outline" className="px-4 py-1.5 text-sm border-primary/30 bg-primary/10">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            AI-Powered Translation
          </Badge>
        </div>

        {/* Main heading */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold font-galactic tracking-wide mb-6 animate-slide-up animation-delay-100">
          <span className="text-gradient-primary">Dub Your Movies</span>
          <br />
          <span className="text-foreground">in Two Clicks</span>
        </h1>

        {/* Subtitle */}
        <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8 animate-slide-up animation-delay-200">
          Transform your content into any language while preserving the original emotion, timing, and voice characteristics with cutting-edge AI technology.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-slide-up animation-delay-300">
          <Button variant="gradient" size="lg" className="group">
            Start Dubbing Free
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button variant="glass" size="lg" className="group">
            <Play className="mr-2 h-4 w-4" />
            Watch Demo
          </Button>
        </div>

        {/* Language badges */}
        <div className="flex flex-wrap gap-3 justify-center animate-slide-up animation-delay-400">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full glass">
            <Globe className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">30+ Languages</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full glass">
            <span className="text-sm font-medium">Voice Cloning</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full glass">
            <span className="text-sm font-medium">Lip Sync</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full glass">
            <span className="text-sm font-medium">Multi-Speaker</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;