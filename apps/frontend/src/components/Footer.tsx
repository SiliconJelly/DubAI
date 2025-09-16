import logo from "@/assets/logo.png";

const Footer = () => {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border/50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center -gap-1">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full blur-lg opacity-30" />
              <img 
                src={logo} 
                alt="DubAI Logo" 
                className="relative h-14 w-14 object-contain"
              />
            </div>
            <span className="text-xl font-bold font-galactic tracking-wider -ml-2">DubAI</span>
            <span className="text-sm text-muted-foreground ml-2">© 2024</span>
          </div>
          
          <nav className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Support</a>
            <a href="#" className="hover:text-foreground transition-colors">API</a>
          </nav>
        </div>
      </div>
    </footer>
  );
};

export default Footer;