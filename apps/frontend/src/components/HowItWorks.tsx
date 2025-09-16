import { Card } from "@/components/ui/card";
import { Upload, Wand2, Download, ArrowRight } from "lucide-react";

const HowItWorks = () => {
  const steps = [
    {
      number: "01",
      icon: Upload,
      title: "Upload Your Content",
      description: "Simply drag and drop your video or audio file. We support MP4, MOV, MP3, WAV and more formats.",
      color: "primary",
    },
    {
      number: "02",
      icon: Wand2,
      title: "AI Processing Magic",
      description: "Our AI analyzes speech patterns, transcribes, translates, and generates natural-sounding dubbed audio.",
      color: "secondary",
    },
    {
      number: "03",
      icon: Download,
      title: "Download & Share",
      description: "Get your professionally dubbed content ready to share with global audiences in minutes.",
      color: "accent",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold font-heading mb-4">
            How It Works
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Three simple steps to transform your content for global audiences
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connection lines for desktop */}
          <div className="hidden md:block absolute top-1/2 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-primary via-secondary to-accent -translate-y-1/2" />

          {steps.map((step, index) => (
            <div key={index} className="relative">
              <Card className="p-6 glass border-border/50 hover:border-primary/50 transition-all duration-300 hover:scale-105 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-5xl font-bold text-${step.color}/20`}>
                    {step.number}
                  </span>
                  <div className={`h-12 w-12 rounded-lg bg-${step.color}/10 p-2.5`}>
                    <step.icon className={`h-full w-full text-${step.color}`} />
                  </div>
                </div>
                <h3 className="text-xl font-semibold font-heading mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </Card>

              {/* Arrow for mobile */}
              {index < steps.length - 1 && (
                <div className="md:hidden flex justify-center my-4">
                  <ArrowRight className="h-6 w-6 text-muted-foreground rotate-90" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Visual Process Flow */}
        <div className="mt-16 p-8 rounded-2xl glass border-border/50">
          <div className="grid md:grid-cols-3 gap-4 text-center">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Input</div>
              <div className="flex justify-center gap-2">
                {["🎬", "🎙️", "📹"].map((emoji, i) => (
                  <span key={i} className="text-2xl">{emoji}</span>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">Original Content</div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Processing</div>
              <div className="h-2 bg-gradient-to-r from-primary via-secondary to-accent rounded-full animate-gradient" />
              <div className="text-xs text-muted-foreground">AI Magic ✨</div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Output</div>
              <div className="flex justify-center gap-2">
                {["🇪🇸", "🇫🇷", "🇩🇪", "🇯🇵", "🇨🇳"].map((flag, i) => (
                  <span key={i} className="text-2xl">{flag}</span>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">30+ Languages</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;