import { Card } from "@/components/ui/card";
import { 
  Mic, 
  Globe2, 
  Zap, 
  Users, 
  Shield, 
  Sparkles,
  Clock,
  Brain,
  Volume2 
} from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: Brain,
      title: "AI Voice Cloning",
      description: "Preserve the original speaker's unique voice characteristics and emotional nuances in any language.",
      gradient: "from-primary to-primary/50",
    },
    {
      icon: Globe2,
      title: "30+ Languages",
      description: "Translate and dub your content into over 30 languages with native-level accuracy and fluency.",
      gradient: "from-secondary to-secondary/50",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Process hours of content in minutes with our optimized AI infrastructure and parallel processing.",
      gradient: "from-accent to-accent/50",
    },
    {
      icon: Users,
      title: "Multi-Speaker Support",
      description: "Automatically detect and preserve multiple speakers with distinct voice profiles for each.",
      gradient: "from-primary to-secondary",
    },
    {
      icon: Clock,
      title: "Perfect Lip Sync",
      description: "Advanced synchronization ensures dubbed audio matches original timing and mouth movements.",
      gradient: "from-secondary to-accent",
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-level encryption and SOC 2 compliance to keep your content safe and secure.",
      gradient: "from-accent to-primary",
    },
  ];

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 relative">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/20 to-background" />

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold font-heading mb-4">
            Powerful Features for <span className="text-gradient-primary">Global Reach</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to localize your content with professional quality
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="p-6 glass border-border/50 hover:border-primary/50 transition-all duration-300 hover:scale-105 hover:shadow-xl group"
            >
              <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${feature.gradient} p-2.5 mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className="h-full w-full text-white" />
              </div>
              <h3 className="text-xl font-semibold font-heading mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
          {[
            { label: "Languages", value: "30+", icon: Globe2 },
            { label: "Processing Speed", value: "10x", icon: Zap },
            { label: "Accuracy", value: "99%", icon: Sparkles },
            { label: "Active Users", value: "50K+", icon: Users },
          ].map((stat, index) => (
            <div key={index} className="text-center">
              <stat.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-3xl font-bold text-gradient-primary">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;