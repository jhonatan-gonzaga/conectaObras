import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BackHandler, Modal, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import type { StoreOrderStatus } from "../../services/api";
import { orderLabels, orderPeriod, orderTimezone } from "../../services/store-orders";
import { EmptyState, LoadingState } from "../feedback-state";
import { NativeDateTimeField } from "../native-date-time-field";
import { ProjectHeader } from "../profissional/components";
import { OrderDetails, type OrderIntent } from "./OrderDetails";
import { OrderButton, OrderCard } from "./order-ui";
import { useOrders, type OrdersAudience } from "./use-orders";

export type OrdersScreenProps = {
  audience: OrdersAudience; status?: StoreOrderStatus; onBack: () => void; onOpenProfile?: () => void;
  renderFooter: (showList: () => void, navigate: (action: () => void) => void) => ReactNode;
};

export function OrdersScreen({ audience, status, onBack, onOpenProfile, renderFooter }: OrdersScreenProps) {
  const orders = useOrders(audience, status);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<OrderIntent | null>(null);
  const confirmationRef = useRef<OrderIntent | null>(null);
  const locked = orders.saving || confirmation !== null;
  const navigate = (action: () => void) => { if (!orders.saving && !confirmationRef.current) action(); };
  const back = () => navigate(orders.selectedId ? orders.close : onBack);
  const request = (intent: OrderIntent) => {
    if (orders.saving || confirmationRef.current || !orders.detailValid) return;
    confirmationRef.current = intent;
    setConfirmation(intent);
  };
  const cancel = () => { confirmationRef.current = null; setConfirmation(null); };
  const confirm = async () => {
    const intent = confirmationRef.current;
    if (!intent) return;
    cancel();
    if (await orders.mutate(intent.execute)) intent.onSuccess?.();
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { back(); return true; });
    return () => subscription.remove();
  });

  const applyPeriod = () => {
    try {
      const period = orderPeriod(from, to);
      setPeriodError(null);
      orders.changeFilters({ ...period, page: 1 });
    } catch (cause) { setPeriodError(cause instanceof Error ? cause.message : "Confira o período."); }
  };
  const filterChips: { label: string; status?: StoreOrderStatus; group?: "OPEN" | "COMPLETED" }[] = audience === "client"
    ? [{ label: "Em aberto", group: "OPEN" }, { label: "Concluídos", group: "COMPLETED" }, { label: "Todos" }]
    : [{ label: "Todos" }, ...Object.entries(orderLabels).map(([value, label]) => ({ label, status: value as StoreOrderStatus }))];
  const pages = Math.max(1, Math.ceil(orders.data.total / orders.data.limit));

  return <View className="w-full max-w-[560px] flex-1 bg-background">
    <ProjectHeader onBack={back} onProfilePress={() => navigate(onOpenProfile ?? onBack)} />
    <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 16, paddingBottom: 28 }} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={orders.loading} onRefresh={() => { if (!locked) void orders.refresh(true); }} />}>
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1"><Text className="text-[26px] font-semibold text-foreground">{orders.selectedId ? "Detalhes do pedido" : audience === "client" ? "Meus Pedidos" : "Pedidos e entregas"}</Text><Text className="mt-1 text-sm text-muted-foreground">{orders.selectedId ? "Itens, valores e acompanhamento da entrega" : audience === "client" ? "Acompanhe suas compras em tempo real" : "Acompanhe e atualize os pedidos da sua loja"}</Text></View>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-[#fdc7cb]"><Ionicons name="car-outline" size={22} color="#99333a" /></View>
      </View>
      <Text className="mb-3 text-xs text-muted-foreground">{orderTimezone()} Atualização automática a cada 15 segundos.</Text>
      {orders.error ? <View className="mb-4 gap-2 rounded-xl bg-[#ffdad6] p-3"><Text accessibilityRole="alert" className="text-sm text-[#93000a]">{orders.error}</Text><OrderButton label="Tentar novamente" secondary disabled={locked || orders.loading} onPress={() => void orders.refresh(true)} /></View> : null}
      {orders.notice ? <Text accessibilityRole="alert" className="mb-4 rounded-xl bg-card p-3 text-sm text-primary">{orders.notice}</Text> : null}
      {orders.saving ? <Text accessibilityRole="alert" className="mb-3 text-sm text-primary">Salvando alteração...</Text> : null}

      {orders.selectedId ? <>
        <View className="mb-4 self-start"><OrderButton label="Voltar à lista de pedidos" onPress={() => navigate(orders.close)} disabled={locked} secondary /></View>
        {orders.selected ? <OrderDetails key={orders.selected.id} order={orders.selected} audience={audience} disabled={locked || !orders.detailValid || orders.loading} onRequest={request} /> : orders.loading ? <LoadingState label="Carregando pedido..." /> : null}
      </> : <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ gap: 6 }}>
          {filterChips.map((chip) => {
            const active = orders.filters.status === chip.status && orders.filters.group === chip.group;
            return <Pressable key={chip.label} accessibilityRole="button" accessibilityLabel={`Filtrar: ${chip.label}`} accessibilityState={{ selected: active, disabled: locked }} disabled={locked}
              onPress={() => orders.changeFilters({ status: chip.status, group: chip.group, page: 1 })} className={`min-h-11 justify-center rounded-full px-4 py-2 ${active ? "bg-primary" : "bg-card"}`}><Text className={`text-sm font-medium ${active ? "text-white" : "text-muted-foreground"}`}>{chip.label}</Text></Pressable>;
          })}
        </ScrollView>
        <View className="mb-4 gap-3 rounded-[18px] bg-card p-4">
          <Text className="font-semibold text-foreground">Período do pedido</Text>
          <View className="flex-row gap-2">
            <View className="flex-1"><NativeDateTimeField label="Data inicial" mode="date" value={from} onChange={setFrom} disabled={locked} placeholder="AAAA-MM-DD" /></View>
            <View className="flex-1"><NativeDateTimeField label="Data final" mode="date" value={to} onChange={setTo} disabled={locked} placeholder="AAAA-MM-DD" /></View>
          </View>
          {periodError ? <Text accessibilityRole="alert" className="text-sm text-primary">{periodError}</Text> : null}
          <View className="flex-row flex-wrap gap-2"><OrderButton label="Aplicar período" disabled={locked} onPress={applyPeriod} /><OrderButton label="Limpar período" disabled={locked} secondary onPress={() => { setFrom(""); setTo(""); setPeriodError(null); orders.changeFilters({ from: undefined, to: undefined, page: 1 }); }} /></View>
        </View>
        <View className="mb-4 flex-row items-center justify-between"><Text className="text-sm text-muted-foreground">{orders.data.total} pedido(s)</Text><OrderButton label="Atualizar pedidos" secondary disabled={locked || orders.loading} onPress={() => void orders.refresh(true)} /></View>
        {orders.loading ? <LoadingState label="Carregando pedidos..." /> : orders.data.items.length ? orders.data.items.map((order) => <OrderCard key={order.id} order={order} onPress={() => orders.open(order.id)} disabled={locked} />) : !orders.error ? <EmptyState message="Nenhum pedido encontrado com esses filtros." /> : null}
        <View className="mt-4 flex-row items-center justify-between gap-2">
          <OrderButton label="Página anterior" secondary disabled={locked || orders.loading || (orders.filters.page ?? 1) <= 1} onPress={() => orders.changeFilters({ page: (orders.filters.page ?? 1) - 1 })} />
          <Text className="text-xs text-muted-foreground">{orders.filters.page ?? 1} / {pages}</Text>
          <OrderButton label="Próxima página" secondary disabled={locked || orders.loading || (orders.filters.page ?? 1) >= pages} onPress={() => orders.changeFilters({ page: (orders.filters.page ?? 1) + 1 })} />
        </View>
      </>}
    </ScrollView>
    {renderFooter(orders.close, navigate)}
    <Modal visible={!!confirmation} transparent animationType="fade" onRequestClose={cancel}>
      <View className="flex-1 items-center justify-center bg-black/40 px-6"><View accessibilityViewIsModal className="w-full max-w-[440px] gap-4 rounded-2xl bg-card p-6">
        <Text className="text-xl font-semibold text-foreground">Confirmar alteração</Text>
        <Text className="text-sm text-foreground">{confirmation?.description}</Text>
        <OrderButton label="Confirmar" onPress={() => void confirm()} />
        <OrderButton label="Manter como está" secondary onPress={cancel} />
      </View></View>
    </Modal>
  </View>;
}
