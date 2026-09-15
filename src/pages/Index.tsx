import orbiLogo from "@/assets/orbi-logo_white.png";

/** Splash de bootstrap. Aparece por um instante antes do redirecionamento. */
const Index = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <img src={orbiLogo} alt="Logotipo do Orbi" width={56} height={56} decoding="async" className="h-14 w-14" />
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] md:text-3xl">Sistema Orbi</h1>
        <p className="mt-2 text-base text-muted-foreground">Sua visão financeira completa</p>
      </div>
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary"
        role="status"
        aria-label="Carregando"
      />
    </div>
  );
};

export default Index;
