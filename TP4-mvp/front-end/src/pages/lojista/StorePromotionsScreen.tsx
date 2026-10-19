import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, BackHandler, Image, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { StoreOwnerTabBar } from "../../components/lojista/StoreOwnerTabBar";
import { PromotionButton, PromotionDialog, PromotionHeader } from "../../components/lojista/promotion-ui";
import { ApiError, api, formatMoney } from "../../services/api";
import { PROMOTION_TIMEZONE, promotionDate, promotionLabels, promotionPreview, promotionState, type PromotionState, type StorePromotion } from "../../services/store-promotions";

const filters: (PromotionState | "ALL")[] = ["ALL", "ACTIVE", "SCHEDULED", "ENDED", "DRAFT", "CANCELED"];

export function StorePromotionsScreen({ onBack, onCreate, onEdit, onProducts, onOrders, onSettings }: {
  onBack: () => void; onCreate: () => void; onEdit: (id: string) => void;
  onProducts: () => void; onOrders: () => void; onSettings: () => void;
}) {
  const [items, setItems] = useState<StorePromotion[]>([]);
  const [filter, setFilter] = useState<PromotionState | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<StorePromotion | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true); setError(null); setNow(Date.now());
    try { const result = await api.storePromotions(); if (request === requestId.current) setItems(result); }
    catch (cause) { if (request === requestId.current) { setItems([]); setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar as promoções."); } }
    finally { if (request === requestId.current) { setNow(Date.now()); setLoading(false); } }
  }, []);
  useEffect(() => {
    void load();
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void load(); });
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => { subscription.remove(); clearInterval(timer); requestId.current++; };
  }, [load]);
  useEffect(() => { const back = BackHandler.addEventListener("hardwareBackPress", () => { onBack(); return true; }); return () => back.remove(); }, [onBack]);
  const changeStatus = async () => {
    if (!target || saving.current) return;
    saving.current = true; setBusy(true);
    try {
      await api.setStorePromotionStatus(target.id, target.status === "ACTIVE" ? "CANCELED" : "ACTIVE");
      setTarget(null); await load();
    } catch (cause) { setTarget(null); setError(cause instanceof ApiError ? cause.message : "Não foi possível alterar a promoção."); }
    finally { saving.current = false; setBusy(false); }
  };
  const visible = items.filter((item) => (filter === "ALL" || promotionState(item, now) === filter)
    && `${item.name} ${item.product?.name ?? ""} ${item.product?.sku ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  return <View className="w-full max-w-[560px] flex-1 bg-background">
    <PromotionHeader title="Promoções da loja" onBack={onBack} />
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor="#99333a" />} contentContainerStyle={{ paddingBottom: 24 }}>
      <View className="px-5 pt-6"><Text className="text-[26px] font-semibold text-foreground">Promoções e descontos</Text><Text className="mt-1 text-sm text-muted-foreground">Gerencie ofertas, agendamentos e histórico.</Text>
        <View className="mb-4 mt-5 flex-row items-center gap-2 rounded-full bg-card px-4"><Ionicons name="search" size={20} color="#897171" /><TextInput accessibilityLabel="Buscar promoções" value={query} onChangeText={setQuery} placeholder="Buscar por produto, oferta ou SKU" className="min-h-12 flex-1 text-sm text-foreground" /></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        {filters.map((state) => <Pressable key={state} accessibilityRole="button" accessibilityLabel={state === "ALL" ? "Todas" : promotionLabels[state]} accessibilityState={{ selected: state === filter }} onPress={() => setFilter(state)} className={`mr-2 rounded-full px-4 py-3 ${filter === state ? "bg-primary" : "bg-card"}`}><Text className={`text-xs font-semibold ${filter === state ? "text-white" : "text-muted-foreground"}`}>{state === "ALL" ? "Todas" : promotionLabels[state]} · {items.filter((p) => state === "ALL" || promotionState(p, now) === state).length}</Text></Pressable>)}
      </ScrollView>
      <View className="gap-4 px-5">
        <View className="flex-row items-start gap-2 rounded-2xl bg-[#eae1da] p-4"><Ionicons name="time-outline" size={20} color="#645d58" /><View className="flex-1"><Text className="text-xs font-semibold text-[#645d58]">{PROMOTION_TIMEZONE}</Text><Text className="mt-1 text-xs leading-5 text-[#645d58]">O destaque da oferta aparece somente durante a vigência.</Text></View></View>
        <PromotionButton label="Criar nova promoção" onPress={onCreate} />
        <Pressable accessibilityRole="button" onPress={() => void load()}><Text className="text-right text-sm font-semibold text-primary">Atualizar promoções</Text></Pressable>
        {error ? <View className="gap-3 rounded-2xl bg-card p-5"><Text accessibilityRole="alert" className="text-sm text-primary">{error}</Text><PromotionButton label="Tentar novamente" secondary onPress={() => void load()} /></View> : null}
        {loading ? <ActivityIndicator accessibilityLabel="Carregando promoções" color="#99333a" /> : visible.map((promotion) => {
          const state = promotionState(promotion, now);
          const active = state === "ACTIVE";
          const preview = promotion.product ? promotionPreview(promotion.product.price, promotion.discountType, promotion.discountValue) : null;
          const image = promotion.product?.images[0];
          return <View key={promotion.id} testID={`promotion-${promotion.id}`} className={`overflow-hidden rounded-[24px] bg-card ${active ? "border border-primary" : "border border-input-border"}`}>
            <View className={`flex-row items-center justify-between px-5 py-3 ${active ? "bg-primary" : "bg-[#f1edee]"}`}><Text className={`text-xs font-semibold ${active ? "text-white" : "text-muted-foreground"}`}>{active ? "Em vigor agora" : promotionLabels[state]}</Text><Ionicons name={active ? "pricetag" : "time-outline"} size={18} color={active ? "#fff" : "#897171"} /></View>
            <View className="gap-3 p-5"><View className="flex-row gap-3">{image ? <Image source={{ uri: image.url }} accessibilityLabel={promotion.product?.name} className="h-16 w-16 rounded-2xl bg-background" /> : <View className="h-16 w-16 items-center justify-center rounded-2xl bg-background"><Ionicons name="cube-outline" size={28} color="#897171" /></View>}<View className="flex-1"><Text className="font-semibold text-foreground">{promotion.product?.name ?? "Produto indisponível"}</Text><Text className="mt-1 text-xs text-muted-foreground">{promotion.name}</Text><Text className="mt-1 text-xs text-muted-foreground">SKU: {promotion.product?.sku ?? "Não informado"}</Text></View></View>
              {active && preview ? <View className="flex-row flex-wrap items-center gap-2"><Text className="text-2xl font-bold text-primary">{formatMoney(preview.finalPrice)}</Text><Text className="text-sm text-muted-foreground line-through">{formatMoney(promotion.product!.price)}</Text><Text className="rounded-full bg-[#ffdad9] px-3 py-1 text-xs font-semibold text-primary">−{preview.percent}% OFF</Text></View> : <Text className="text-sm text-muted-foreground">Preço de tabela: {formatMoney(promotion.product?.price ?? "0")}</Text>}
              {!active && preview ? <Text className="text-xs text-muted-foreground">Preço previsto da oferta: {formatMoney(preview.finalPrice)}</Text> : null}
              <Text className="text-xs leading-5 text-muted-foreground">Início: {promotionDate(promotion.startsAt)}{"\n"}Término: {promotionDate(promotion.endsAt)}</Text>
              <View className="flex-row items-center justify-between border-t border-input-border pt-3"><View className="flex-row items-center gap-2"><Switch accessibilityLabel={`Ativação de ${promotion.name}`} value={promotion.status === "ACTIVE" && state !== "ENDED"} trackColor={{ false: "#ddd9da", true: "#99333a" }} thumbColor="#ffffff" onValueChange={() => { if (state === "ENDED") onEdit(promotion.id); else setTarget(promotion); }} /><Text className="text-xs text-muted-foreground">{state === "ACTIVE" ? "Ativa na loja" : state === "SCHEDULED" ? "Agendamento ativo" : "Sem destaque"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Editar ${promotion.name}`} onPress={() => onEdit(promotion.id)} className="rounded-full bg-background px-4 py-3"><Text className="text-xs font-semibold text-primary">{state === "ENDED" ? "Renovar" : "Editar"}</Text></Pressable></View>
            </View>
          </View>;
        })}
        {!loading && !error && !visible.length ? <View className="items-center rounded-2xl bg-card p-7"><Ionicons name="pricetags-outline" size={36} color="#99333a" /><Text className="mt-3 text-center font-semibold text-foreground">Nenhuma promoção encontrada</Text><Text className="mt-2 text-center text-sm text-muted-foreground">Ajuste a busca ou crie uma nova oferta.</Text></View> : null}
      </View>
    </ScrollView>
    <StoreOwnerTabBar selected="Promoções" onDashboard={onBack} onOrders={onOrders} onProducts={onProducts} onPromotions={() => {}} onSettings={onSettings} />
    <PromotionDialog visible={Boolean(target)} title={target?.status === "ACTIVE" ? "Confirmar desativação?" : "Confirmar ativação?"} confirmLabel={target?.status === "ACTIVE" ? "Desativar promoção" : "Ativar promoção"} busy={busy} onConfirm={() => void changeStatus()} onCancel={() => setTarget(null)}><Text className="text-sm leading-6 text-muted-foreground">{target?.name}. {target?.status === "ACTIVE" ? "O produto voltará ao preço de tabela. O agendamento também será desativado." : "A oferta será exibida somente no período definido, sem acumular com outra regra."}</Text></PromotionDialog>
  </View>;
}
