import orbiLogo from "@/assets/orbi-logo_white.png";

const Index = () => {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <img src={orbiLogo} alt="Orbi" className="h-16 w-16 mx-auto mb-6" />
          <h1 className="mb-4 text-4xl font-bold">Sistema Orbi</h1>
          <p className="text-xl text-muted-foreground">Sua visão financeira completa</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
