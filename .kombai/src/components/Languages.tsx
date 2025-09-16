import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Star, TrendingUp } from "lucide-react";

const Languages = () => {
  const languageGroups = {
    "Most Popular": [
      { name: "English", flag: "🇺🇸", speakers: "1.5B" },
      { name: "Spanish", flag: "🇪🇸", speakers: "559M" },
      { name: "Mandarin", flag: "🇨🇳", speakers: "1.1B" },
      { name: "Hindi", flag: "🇮🇳", speakers: "602M" },
      { name: "French", flag: "🇫🇷", speakers: "280M" },
    ],
    "European": [
      { name: "German", flag: "🇩🇪", speakers: "134M" },
      { name: "Italian", flag: "🇮🇹", speakers: "68M" },
      { name: "Portuguese", flag: "🇵🇹", speakers: "264M" },
      { name: "Russian", flag: "🇷🇺", speakers: "258M" },
      { name: "Polish", flag: "🇵🇱", speakers: "50M" },
    ],
    "Asian": [
      { name: "Japanese", flag: "🇯🇵", speakers: "125M" },
      { name: "Korean", flag: "🇰🇷", speakers: "81M" },
      { name: "Vietnamese", flag: "🇻🇳", speakers: "85M" },
      { name: "Thai", flag: "🇹🇭", speakers: "60M" },
      { name: "Indonesian", flag: "🇮🇩", speakers: "199M" },
      { name: "Bangla", flag: "🇧🇩", speakers: "273M" },
    ],
    "Middle Eastern": [
      { name: "Arabic", flag: "🇸🇦", speakers: "422M" },
      { name: "Turkish", flag: "🇹🇷", speakers: "88M" },
      { name: "Hebrew", flag: "🇮🇱", speakers: "9M" },
      { name: "Persian", flag: "🇮🇷", speakers: "70M" },
    ],
  };

  return (
    <section id="languages" className="py-20 px-4 sm:px-6 lg:px-8 relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background to-muted/20" />

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold font-heading mb-4">
            <span className="text-gradient-primary">30+ Languages</span> Supported
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Break language barriers and reach billions of viewers worldwide
          </p>
        </div>

        {/* Language Groups */}
        <div className="space-y-8">
          {Object.entries(languageGroups).map(([group, languages]) => (
            <div key={group}>
              <div className="flex items-center gap-2 mb-4">
                {group === "Most Popular" && <Star className="h-5 w-5 text-primary" />}
                {group === "Asian" && <Globe className="h-5 w-5 text-secondary" />}
                {group === "European" && <TrendingUp className="h-5 w-5 text-accent" />}
                <h3 className="text-xl font-semibold font-heading">{group}</h3>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {languages.map((lang) => (
                  <Card
                    key={lang.name}
                    className="p-4 glass border-border/50 hover:border-primary/50 transition-all duration-300 hover:scale-105 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{lang.flag}</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{lang.name}</div>
                        <div className="text-xs text-muted-foreground">{lang.speakers}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Coming Soon */}
        <div className="mt-12 p-6 rounded-2xl glass border-border/50 text-center">
          <Badge variant="outline" className="mb-3">Coming Soon</Badge>
          <p className="text-lg font-medium mb-2">More Languages on the Way</p>
          <p className="text-muted-foreground">
            We're constantly adding new languages. Request your language and we'll prioritize it!
          </p>
        </div>
      </div>
    </section>
  );
};

export default Languages;