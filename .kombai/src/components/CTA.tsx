import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, Sparkles, Zap } from "lucide-react";

const CTA = () => {
  const plans = [
    {
      name: "Pay as you go",
      price: "Project-Based",
      description: "No account needed - pay as you go",
      features: [
        "Pay only for what you use",
        "Token-based pricing",
        "No subscription required",
        "Instant access",
        "All languages available",
        "HD voice quality",
        "Quick turnaround",
      ],
      cta: "Start Dubbing Now",
      variant: "outline" as const,
    },
    {
      name: "Volume+ Unlimited",
      price: "$49",
      period: "/week",
      description: "Unlimited dubbing for any movie length",
      features: [
        "Unlimited movies weekly",
        "Dub any movie, any length",
        "All 30+ languages included",
        "Ultra HD voice quality",
        "Voice cloning included",
        "Priority processing",
        "Download in all formats",
        "Cancel anytime",
      ],
      cta: "Create Account",
      variant: "gradient" as const,
      popular: true,
    },
  ];

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 relative">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Limited Time Offer
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-bold font-heading mb-4">
            Choose Your <span className="text-gradient-primary">Perfect Plan</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start dubbing for free. Upgrade anytime as you grow.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`p-6 glass border-border/50 relative ${
                plan.popular ? "border-primary/50 shadow-xl" : ""
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}
              
              <div className="mb-6">
                <h3 className="text-2xl font-bold font-heading mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground">{plan.period}</span>
                  )}
                </div>
                <p className="text-muted-foreground">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button variant={plan.variant} className="w-full group">
                {plan.cta}
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Card>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center p-8 rounded-2xl bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 border border-primary/30">
          <Zap className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h3 className="text-2xl font-bold font-heading mb-2">
            Ready to Go Global?
          </h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join thousands of content creators who are reaching millions of new viewers with DubAI's instant translation technology.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="gradient" size="lg" className="group">
              Start Dubbing Free
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="glass" size="lg">
              Book a Demo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;