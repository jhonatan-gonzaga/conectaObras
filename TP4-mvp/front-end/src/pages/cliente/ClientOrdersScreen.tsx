import { ClientBottomNav, type ClientNavKey } from "../../components/cliente";
import { OrdersScreen } from "../../components/orders/OrdersScreen";

export function ClientOrdersScreen({ onBack, onProfilePress, onNavigate }: {
  onBack: () => void; onProfilePress: () => void; onNavigate: (tab: ClientNavKey) => void;
}) {
  return <OrdersScreen audience="client" onBack={onBack} onOpenProfile={onProfilePress}
    renderFooter={(showList, navigate) => <ClientBottomNav active="orders" onSelect={(tab) => navigate(tab === "orders" ? showList : () => onNavigate(tab))} />} />;
}
