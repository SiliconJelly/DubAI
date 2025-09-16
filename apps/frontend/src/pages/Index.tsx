import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import VideoDemo from "@/components/VideoDemo";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Languages from "@/components/Languages";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import { Dashboard } from "@/components/Dashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="landing" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="landing">Landing Page</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          </TabsList>
          
          <TabsContent value="landing" className="mt-0">
            <div className="-mx-4 -mt-8">
              <Hero />
              <VideoDemo />
              <Features />
              <HowItWorks />
              <Languages />
              <CTA />
            </div>
          </TabsContent>
          
          <TabsContent value="dashboard">
            <Dashboard />
          </TabsContent>
        </Tabs>
      </div>
      
      <Footer />
    </div>
  );
};

export default Index;