import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Pause, Volume2, Upload, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const VideoDemo = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("spanish");

  const languages = [
    { code: "spanish", label: "Spanish", flag: "🇪🇸" },
    { code: "french", label: "French", flag: "🇫🇷" },
    { code: "german", label: "German", flag: "🇩🇪" },
    { code: "japanese", label: "Japanese", flag: "🇯🇵" },
    { code: "mandarin", label: "Mandarin", flag: "🇨🇳" },
  ];

  const transcripts = [
    { time: "0:00", text: "Welcome to DubAI's revolutionary platform", speaker: "Speaker 1" },
    { time: "0:03", text: "Transform your content instantly", speaker: "Speaker 1" },
    { time: "0:06", text: "With perfect voice synchronization", speaker: "Speaker 2" },
  ];

  return (
    <section id="demo" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold font-heading mb-4">
            See <span className="text-gradient-primary">DubAI</span> in Action
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience the power of AI dubbing with real-time voice translation
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Video Player */}
          <Card className="overflow-hidden glass border-border/50">
            <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-secondary/20">
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  variant="glass"
                  size="icon"
                  className="h-16 w-16 rounded-full"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6 ml-1" />
                  )}
                </Button>
              </div>
              
              {/* Video Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background/80 to-transparent">
                <Progress value={33} className="mb-2" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">0:06 / 0:18</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Volume2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Controls Panel */}
          <div className="space-y-6">
            {/* Language Selection */}
            <Card className="p-6 glass border-border/50">
              <h3 className="text-lg font-semibold mb-4">Select Target Language</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {languages.map((lang) => (
                  <Button
                    key={lang.code}
                    variant={selectedLanguage === lang.code ? "glow" : "outline"}
                    size="sm"
                    onClick={() => setSelectedLanguage(lang.code)}
                    className="justify-start"
                  >
                    <span className="mr-2">{lang.flag}</span>
                    {lang.label}
                  </Button>
                ))}
              </div>
            </Card>

            {/* Transcript */}
            <Card className="p-6 glass border-border/50">
              <h3 className="text-lg font-semibold mb-4">Live Transcript</h3>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {transcripts.map((item, index) => (
                  <div key={index} className="flex gap-3 text-sm">
                    <span className="text-muted-foreground min-w-[3rem]">{item.time}</span>
                    <div className="flex-1">
                      <span className="text-primary text-xs">{item.speaker}</span>
                      <p className="text-foreground">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Upload CTA */}
            <Card className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/30">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Try with Your Video</h3>
                  <p className="text-sm text-muted-foreground">Upload and dub in seconds</p>
                </div>
                <Button variant="glow" size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VideoDemo;