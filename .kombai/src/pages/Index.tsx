import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import VideoDemo from "@/components/VideoDemo";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Languages from "@/components/Languages";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <VideoDemo />
      <Features />
      <HowItWorks />
      <Languages />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;