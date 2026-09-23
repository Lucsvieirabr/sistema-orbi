import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Car,
  Plane,
  ShoppingBag,
  Heart,
  GraduationCap,
  FileText,
  Briefcase,
  DollarSign,
  ChartLine,
  Gift,
  Utensils,
  Coffee,
  Shirt,
  Smartphone,
  Gamepad2,
  Music,
  Camera,
  Wrench,
  Zap,
  Wifi,
  Tv,
  Baby,
  Stethoscope,
  Pill,
  BookOpen,
  School,
  Palette,
  Dumbbell,
  Fuel,
  Train,
  Bus,
  Bike,
  Building,
  Building2,
  Store,
  Banknote,
  CreditCard,
  PiggyBank,
  Calculator,
  TrendingUp,
  TrendingDown,
  Receipt,
  Wallet,
  Coins,
  Crown,
  Star,
  Sparkles,
  Flower,
  Sun,
  Moon,
  Cloud,
  Shield,
  Lock,
  Key,
  Settings,
  Lightbulb,
  Battery,
  Users,
  User,
  Users2,
  ShoppingCart,
  Package,
  Truck,
  MapPin,
  Navigation,
  Compass,
  Mountain,
  Waves,
  Eye,
  Search,
  Filter,
  Grid3x3,
  List,
  Plus,
  Minus,
  X,
  Check,
  AlertCircle,
  Info,
  HelpCircle,
  BanknoteXIcon,
  Calendar,
  Bell,
  Mail,
  MessageCircle,
  Phone,
  PhoneCall,
  Video,
  Image,
  File,
  Edit,
  Trash2,
  Save,
  Send,
  Share,
  Bookmark,
  Flag,
  Pin,
  Map,
  Globe,
  Monitor,
  Laptop,
  Tablet,
  Watch,
  Headphones,
  Speaker,
  Volume2,
  Play,
  Pause,
  Music as MusicIcon,
  Gamepad,
  Trophy,
  Medal,
  Award,
  Target,
  Scissors,
  Circle,
  Square,
  Triangle,
  Diamond,
} from "lucide-react";

export interface IconOption {
  name: string;
  label: string;
  component: React.ComponentType<{ className?: string }>;
  category: string;
}

const iconCategories = {
  "Moradia": [
    { name: "home", label: "Casa", component: Home },
    { name: "building", label: "Prédio", component: Building },
    { name: "building2", label: "Edifício", component: Building2 },
  ],
  "Transporte": [
    { name: "car", label: "Carro", component: Car },
    { name: "fuel", label: "Combustível", component: Fuel },
    { name: "train", label: "Trem", component: Train },
    { name: "bus", label: "Ônibus", component: Bus },
    { name: "bike", label: "Bicicleta", component: Bike },
    { name: "plane", label: "Avião", component: Plane },
  ],
  "Alimentação": [
    { name: "utensils", label: "Talheres", component: Utensils },
    { name: "coffee", label: "Café", component: Coffee },
    { name: "shopping-cart", label: "Carrinho de compras", component: ShoppingCart },
  ],
  "Saúde": [
    { name: "heart", label: "Coração", component: Heart },
    { name: "stethoscope", label: "Estetoscópio", component: Stethoscope },
    { name: "pill", label: "Remédio", component: Pill },
  ],
  "Educação": [
    { name: "graduation-cap", label: "Formatura", component: GraduationCap },
    { name: "book-open", label: "Livro", component: BookOpen },
    { name: "school", label: "Escola", component: School },
  ],
  "Lazer": [
    { name: "gamepad2", label: "Videogame", component: Gamepad2 },
    { name: "music", label: "Música", component: Music },
    { name: "camera", label: "Câmera", component: Camera },
    { name: "palette", label: "Paleta", component: Palette },
    { name: "dumbbell", label: "Academia", component: Dumbbell },
    { name: "tv", label: "TV", component: Tv },
  ],
  "Compras": [
    { name: "shopping-bag", label: "Sacola", component: ShoppingBag },
    { name: "shirt", label: "Roupa", component: Shirt },
    { name: "smartphone", label: "Celular", component: Smartphone },
    { name: "store", label: "Loja", component: Store },
  ],
  "Contas": [
    { name: "file-text", label: "Documento", component: FileText },
    { name: "receipt", label: "Recibo", component: Receipt },
    { name: "calculator", label: "Calculadora", component: Calculator },
    { name: "credit-card", label: "Cartão de crédito", component: CreditCard },
    { name: "wallet", label: "Carteira", component: Wallet },
    { name: "banknote", label: "Dinheiro", component: Banknote },
    { name: "banknote-x", label: "Dinheiro cancelado", component: BanknoteXIcon },
  ],
  "Renda": [
    { name: "briefcase", label: "Trabalho", component: Briefcase },
    { name: "dollar-sign", label: "Cifrão", component: DollarSign },
    { name: "chart-line", label: "Gráfico", component: ChartLine },
    { name: "trending-up", label: "Alta", component: TrendingUp },
    { name: "piggy-bank", label: "Cofrinho", component: PiggyBank },
    { name: "coins", label: "Moedas", component: Coins },
  ],
  "Presentes": [
    { name: "gift", label: "Presente", component: Gift },
    { name: "crown", label: "Coroa", component: Crown },
    { name: "star", label: "Estrela", component: Star },
    { name: "sparkles", label: "Brilho", component: Sparkles },
  ],
  "Serviços": [
    { name: "wrench", label: "Ferramenta", component: Wrench },
    { name: "settings", label: "Engrenagem", component: Settings },
    { name: "zap", label: "Energia", component: Zap },
    { name: "wifi", label: "Internet", component: Wifi },
    { name: "lightbulb", label: "Lâmpada", component: Lightbulb },
  ],
  "Pessoal": [
    { name: "user", label: "Pessoa", component: User },
    { name: "users", label: "Pessoas", component: Users },
    { name: "baby", label: "Bebê", component: Baby },
  ],
};

const allIcons: IconOption[] = Object.entries(iconCategories).flatMap(([category, icons]) =>
  icons.map(icon => ({ ...icon, category }))
);

/** Minúsculo e sem acento: "ônibus" casa com "onibus". */
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface IconSelectorProps {
  value: string;
  onChange: (iconName: string) => void;
  trigger?: React.ReactNode;
}

export function IconSelector({ value, onChange, trigger }: IconSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const term = normalize(search.trim());
  const filteredIcons = term
    ? allIcons.filter((icon) => [icon.label, icon.category, icon.name].some((t) => normalize(t).includes(term)))
    : allIcons;

  const groupedIcons = filteredIcons.reduce((acc, icon) => {
    if (!acc[icon.category]) {
      acc[icon.category] = [];
    }
    acc[icon.category].push(icon);
    return acc;
  }, {} as Record<string, IconOption[]>);

  const selectedIcon = allIcons.find(icon => icon.name === value);

  const renderGrid = (icons: IconOption[]) => (
    <div className="grid grid-cols-4 gap-2 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
      {icons.map((icon) => {
        const IconComponent = icon.component;
        const isSelected = icon.name === value;
        return (
          <Button
            key={icon.name}
            type="button"
            variant={isSelected ? "default" : "outline"}
            className="flex h-auto min-h-16 w-full flex-col items-center justify-center gap-1.5 px-1 py-2"
            onClick={() => {
              onChange(icon.name);
              setOpen(false);
              setSearch("");
            }}
            title={icon.label}
            aria-pressed={isSelected}
          >
            <IconComponent className="h-6 w-6" />
            <span className="w-full truncate text-center text-xs leading-tight">{icon.label}</span>
          </Button>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full justify-start text-left font-normal">
            <div className="flex items-center gap-2">
              {selectedIcon ? (
                <selectedIcon.component className="h-4 w-4" />
              ) : (
                <div className="h-4 w-4 rounded border border-dashed" />
              )}
              <span className="text-muted-foreground">
                {selectedIcon ? selectedIcon.label : "Selecionar ícone"}
              </span>
            </div>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Selecionar ícone</DialogTitle>
          <DialogDescription className="sr-only">Busque e escolha um ícone.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Buscar ícones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
          <ScrollArea className="h-[65vh]">
            {filteredIcons.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Nenhum ícone encontrado para "{search.trim()}".</p>
            ) : term ? (
              <div className="space-y-5">
                {Object.entries(groupedIcons).map(([category, icons]) => (
                  <section key={category} className="space-y-2">
                    <h3 className="label-eyebrow">{category}</h3>
                    {renderGrid(icons)}
                  </section>
                ))}
              </div>
            ) : (
              <Tabs defaultValue={Object.keys(groupedIcons)[0]} className="w-full">
                <div className="mb-4">
                  <ScrollArea className="w-full whitespace-nowrap">
                    <TabsList className="w-max min-w-full justify-start">
                      {Object.keys(groupedIcons).map((category) => (
                        <TabsTrigger key={category} value={category}>
                          {category}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </ScrollArea>
                </div>
                {Object.entries(groupedIcons).map(([category, icons]) => (
                  <TabsContent key={category} value={category} className="mt-0">
                    {renderGrid(icons)}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
