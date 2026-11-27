import { StoreOwnerTabBar } from "../../components/lojista/StoreOwnerTabBar";
import { OrdersScreen } from "../../components/orders/OrdersScreen";
import type { StoreOrderStatus } from "../../services/api";

export function StoreOrdersScreen({ status, onBack, onOpenProfile, onProducts, onPromotions, onSettings }: {
  status?: string; onBack: () => void; onSwitchProfile?: () => void; onOpenProfile?: () => void;
  onProducts?: () => void; onPromotions?: () => void; onSettings?: () => void; avatarUrl?: string | null;
}) {
  return <OrdersScreen audience="owner" status={status as StoreOrderStatus | undefined} onBack={onBack} onOpenProfile={onOpenProfile}
    renderFooter={(showList, navigate) => <StoreOwnerTabBar selected="Pedidos"
      onDashboard={() => navigate(onBack)} onOrders={() => navigate(showList)}
      onProducts={() => navigate(onProducts ?? onBack)} onPromotions={() => navigate(onPromotions ?? onBack)} onSettings={() => navigate(onSettings ?? onBack)} />} />;
}
