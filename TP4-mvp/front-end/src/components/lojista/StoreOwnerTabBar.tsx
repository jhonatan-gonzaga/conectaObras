import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

type Tab = "Painel" | "Pedidos" | "Produtos" | "Promoções" | "Configurações";
type IconName = React.ComponentProps<typeof Ionicons>["name"];

const tabs: { label: Tab; icon: IconName }[] = [
  { label: "Painel", icon: "storefront-outline" },
  { label: "Pedidos", icon: "receipt-outline" },
  { label: "Produtos", icon: "cube-outline" },
  { label: "Promoções", icon: "pricetag-outline" },
  { label: "Configurações", icon: "settings-outline" },
];

export function StoreOwnerTabBar({ selected, onDashboard, onOrders, onProducts, onPromotions, onSettings }: {
  selected: Tab;
  onDashboard: () => void; onOrders: () => void; onProducts: () => void;
  onPromotions: () => void; onSettings: () => void;
}) {
  const actions: Record<Tab, () => void> = {
    Painel: onDashboard, Pedidos: onOrders, Produtos: onProducts,
    Promoções: onPromotions, Configurações: onSettings,
  };
  return <View className="flex-row border-t border-input-border bg-card px-1 shadow-sm shadow-primary/10">
    {tabs.map(({ label, icon }) => <Pressable key={label} onPress={actions[label]} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: selected === label }} className="min-h-[58px] flex-1 items-center justify-center px-0.5">
      <Ionicons name={icon} size={22} color={selected === label ? "#99333a" : "#766a70"} />
      <Text numberOfLines={1} className={`mt-0.5 text-[10px] ${selected === label ? "font-semibold text-primary" : "text-muted-foreground"}`}>{label}</Text>
    </Pressable>)}
  </View>;
}
