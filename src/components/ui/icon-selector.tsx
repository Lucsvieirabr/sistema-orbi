import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Clock,
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
  component: React.ComponentType<{ className?: string }>;
  category: string;
}

const iconCategories = {
  "Moradia": [
    { name: "home", component: Home },
    { name: "building", component: Building },
    { name: "building2", component: Building2 },
  ],
  "Transporte": [
    { name: "car", component: Car },
    { name: "fuel", component: Fuel },
    { name: "train", component: Train },
    { name: "bus", component: Bus },
    { name: "bike", component: Bike },
    { name: "plane", component: Plane },
  ],
  "Alimentação": [
    { name: "utensils", component: Utensils },
    { name: "coffee", component: Coffee },
    { name: "shopping-cart", component: ShoppingCart },
  ],
  "Saúde": [
    { name: "heart", component: Heart },
    { name: "stethoscope", component: Stethoscope },
    { name: "pill", component: Pill },
  ],
  "Educação": [
    { name: "graduation-cap", component: GraduationCap },
    { name: "book-open", component: BookOpen },
    { name: "school", component: School },
  ],
  "Lazer": [
    { name: "gamepad2", component: Gamepad2 },
    { name: "music", component: Music },
    { name: "camera", component: Camera },
    { name: "palette", component: Palette },
    { name: "dumbbell", component: Dumbbell },
    { name: "tv", component: Tv },
  ],
  "Compras": [
    { name: "shopping-bag", component: ShoppingBag },
    { name: "shirt", component: Shirt },
    { name: "smartphone", component: Smartphone },
    { name: "store", component: Store },
  ],
  "Contas": [
    { name: "file-text", component: FileText },
    { name: "receipt", component: Receipt },
    { name: "calculator", component: Calculator },
    { name: "credit-card", component: CreditCard },
    { name: "wallet", component: Wallet },
    { name: "banknote", component: Banknote },
  ],
  "Renda": [
    { name: "briefcase", component: Briefcase },
    { name: "dollar-sign", component: DollarSign },
    { name: "chart-line", component: ChartLine },
    { name: "trending-up", component: TrendingUp },
    { name: "piggy-bank", component: PiggyBank },
    { name: "coins", component: Coins },
  ],
  "Presentes": [
    { name: "gift", component: Gift },
    { name: "crown", component: Crown },
    { name: "star", component: Star },
    { name: "sparkles", component: Sparkles },
  ],
  "Serviços": [
    { name: "wrench", component: Wrench },
    { name: "settings", component: Settings },
    { name: "zap", component: Zap },
    { name: "wifi", component: Wifi },
    { name: "lightbulb", component: Lightbulb },
  ],
  "Pessoal": [
    { name: "user", component: User },
    { name: "users", component: Users },
    { name: "baby", component: Baby },
  ],
};

const allIcons: IconOption[] = Object.entries(iconCategories).flatMap(([category, icons]) =>
  icons.map(icon => ({ ...icon, category }))
);

interface IconSelectorProps {
  value: string;
  onChange: (iconName: string) => void;
  trigger?: React.ReactNode;
}

export function IconSelector({ value, onChange, trigger }: IconSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredIcons = allIcons.filter(icon =>
    icon.name.toLowerCase().includes(search.toLowerCase()) ||
    icon.category.toLowerCase().includes(search.toLowerCase())
  );

  const groupedIcons = filteredIcons.reduce((acc, icon) => {
    if (!acc[icon.category]) {
      acc[icon.category] = [];
    }
    acc[icon.category].push(icon);
    return acc;
  }, {} as Record<string, IconOption[]>);

  const selectedIcon = allIcons.find(icon => icon.name === value);

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
                {selectedIcon ? selectedIcon.name : "Selecionar ícone"}
              </span>
            </div>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Selecionar Ícone</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Buscar ícones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
          <ScrollArea className="h-[65vh]">
            <Tabs defaultValue={Object.keys(groupedIcons)[0]} className="w-full">
              <div className="mb-4">
                <ScrollArea className="w-full whitespace-nowrap">
                  <TabsList className="inline-flex h-10 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground w-max min-w-full">
                    {Object.keys(groupedIcons).map((category) => (
                      <TabsTrigger
                        key={category}
                        value={category}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                      >
                        {category}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </ScrollArea>
              </div>
              {Object.entries(groupedIcons).map(([category, icons]) => (
                <TabsContent key={category} value={category} className="mt-0">
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-3">
                    {icons.map((icon) => {
                      const IconComponent = icon.component;
                      const isSelected = icon.name === value;
                      return (
                        <Button
                          key={icon.name}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="h-16 w-16 p-0 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-transform"
                          onClick={() => {
                            onChange(icon.name);
                            setOpen(false);
                          }}
                          title={icon.name}
                        >
                          <IconComponent className="h-6 w-6" />
                          <span className="text-xs truncate w-full text-center leading-tight">
                            {icon.name}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
