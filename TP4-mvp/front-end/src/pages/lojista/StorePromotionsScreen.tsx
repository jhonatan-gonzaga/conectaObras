import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ApiError, api, formatMoney } from "../../services/api";
import type { StoreProduct } from "../../services/store-products";

type Promotion = {
  id: string;
  productId: string;
  promotionalPrice: string | null;
  discountPercent: string | null;
  startAt: string;
  endAt: string;
  enabled: boolean;
  product?: { id: string; name: string; price?: string; status?: string; stock?: number };
};
type PromotionFilter = "Todas" | "Ativas" | "Pausadas" | "Encerradas";

function promotionState(promotion: Promotion, now = Date.now()): Exclude<PromotionFilter, "Todas"> {
  if (new Date(promotion.endAt).getTime() <= now) return "Encerradas";
  if (!promotion.enabled || new Date(promotion.startAt).getTime() > now) return "Pausadas";
  return "Ativas";
}

function formatPromotionDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function dateInputIsValid(value: string) {
  return !Number.isNaN(new Date(value).getTime()) && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
}

export function StorePromotionsScreen({ onBack }: { onBack: () => void }) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState<PromotionFilter>("Todas");
  const [query, setQuery] = useState("");
  const [changing, setChanging] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [discountType, setDiscountType] = useState<"price" | "percent">("price");
  const [discountValue, setDiscountValue] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPromotions(await api.storeDashboardList("promotions") as Promotion[]);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar as promoções.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const nextBoundary = promotions.flatMap((promotion) => [
      new Date(promotion.startAt).getTime(), new Date(promotion.endAt).getTime(),
    ]).filter((boundary) => boundary > now).sort((left, right) => left - right)[0];
    if (nextBoundary === undefined) return;
    const delay = Math.min(2_147_000_000, Math.max(0, nextBoundary - now + 10));
    const timer = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [now, promotions]);

  const counts = useMemo(() => {
    return promotions.reduce<Record<PromotionFilter, number>>((result, promotion) => {
      result.Todas += 1;
      result[promotionState(promotion, now)] += 1;
      return result;
    }, { Todas: 0, Ativas: 0, Pausadas: 0, Encerradas: 0 });
  }, [now, promotions]);

  const visiblePromotions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return promotions.filter((promotion) => {
      const matchesFilter = filter === "Todas" || promotionState(promotion, now) === filter;
      const matchesQuery = !normalizedQuery || (promotion.product?.name ?? "").toLocaleLowerCase("pt-BR").includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [filter, now, promotions, query]);

  const openCreate = async () => {
    setFormError(null);
    setSelectedProduct(null);
    setDiscountValue("");
    setDiscountType("price");
    setStartAt("");
    setEndAt("");
    setCreateOpen(true);
    try {
      const result = await api.storeProducts({ status: "ACTIVE", stock: "IN_STOCK", page: 1, limit: 100 });
      const eligible = result.items.filter((product) => product.status === "ACTIVE" && product.stock > 0 && !product.promotion);
      setProducts(eligible);
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : "Não foi possível carregar os produtos disponíveis.");
    }
  };

  const createPromotion = async () => {
    if (!selectedProduct) { setFormError("Selecione um produto ativo e com estoque."); return; }
    const value = Number(discountValue.trim().replace(",", "."));
    if (!Number.isFinite(value) || value <= 0 || (discountType === "percent" && value >= 100)) {
      setFormError(discountType === "price" ? "Informe um preço promocional maior que zero." : "O desconto deve ser maior que zero e menor que 100%."); return;
    }
    if (discountType === "price" && value >= Number(selectedProduct.price)) { setFormError("O preço promocional precisa ser menor que o preço base."); return; }
    if (!dateInputIsValid(startAt) || !dateInputIsValid(endAt)) { setFormError("Informe início e término com fuso horário, por exemplo 2026-10-15T09:00:00-04:00."); return; }
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (start >= end) { setFormError("O início deve ser anterior ao término."); return; }
    if (promotions.some((promotion) => promotion.productId === selectedProduct.id && promotionState(promotion) !== "Encerradas")) {
      setFormError("Este produto já possui uma promoção não encerrada."); return;
    }
    setSaving(true); setFormError(null);
    try {
      await api.createStorePromotion({
        productId: selectedProduct.id,
        promotionalPrice: discountType === "price" ? value.toFixed(2) : undefined,
        discountPercent: discountType === "percent" ? String(value) : undefined,
        startAt: start.toISOString(), endAt: end.toISOString(),
      });
      setCreateOpen(false);
      await load();
    } catch (cause) {
      setFormError(cause instanceof ApiError ? cause.message : "Não foi possível salvar a promoção.");
    } finally { setSaving(false); }
  };

  const toggle = async (promotion: Promotion) => {
    const enabled = !promotion.enabled;
    setChanging(promotion.id); setError(null);
    try {
      await api.setStorePromotionEnabled(promotion.id, enabled);
      setPromotions((current) => current.map((item) => item.id === promotion.id ? { ...item, enabled } : item));
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : "Não foi possível alterar a promoção."); }
    finally { setChanging(null); }
  };

  return <ScrollView className="w-full max-w-[560px] flex-1 bg-background px-5" contentContainerStyle={{ paddingTop: 24, paddingBottom: 36 }}>
    <Pressable onPress={onBack} accessibilityRole="button" className="mb-5 self-start rounded-xl bg-card px-4 py-3"><Text className="font-semibold text-primary">Voltar ao painel</Text></Pressable>
    <View className="mb-4 flex-row items-center justify-between gap-3"><View className="flex-1"><Text className="text-2xl font-bold text-foreground">Promoções da Loja</Text><Text className="mt-1 text-sm text-muted-foreground">Gerencie ofertas e validade dos seus produtos.</Text></View><Pressable accessibilityRole="button" onPress={() => void openCreate()} className="rounded-full bg-primary px-4 py-3"><Text className="text-center text-sm font-bold text-white">+ Nova promoção</Text></Pressable></View>
    <View className="mb-4 flex-row flex-wrap gap-2">{(["Ativas", "Pausadas", "Encerradas"] as const).map((label) => <View key={label} className="rounded-full bg-card px-3 py-2"><Text className="text-xs font-semibold text-foreground">{label} · {counts[label]}</Text></View>)}</View>
    <TextInput accessibilityLabel="Buscar promoções" placeholder="Buscar produto em promoção" value={query} onChangeText={setQuery} className="mb-3 h-12 rounded-xl border border-input-border bg-card px-4 text-foreground" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 max-h-12">{(["Todas", "Ativas", "Pausadas", "Encerradas"] as const).map((label) => <Pressable key={label} onPress={() => setFilter(label)} accessibilityRole="button" accessibilityState={{ selected: filter === label }} className={`mr-2 rounded-full px-4 py-3 ${filter === label ? "bg-primary" : "bg-card"}`}><Text className={`text-xs font-bold ${filter === label ? "text-white" : "text-foreground"}`}>{label} ({counts[label]})</Text></Pressable>)}</ScrollView>
    {error ? <View className="mb-3 rounded-xl bg-[#ffdad6] p-3"><Text accessibilityRole="alert" className="text-sm text-[#93000a]">{error}</Text><Pressable onPress={() => void load()} className="mt-2"><Text className="font-bold text-primary">Tentar novamente</Text></Pressable></View> : null}
    {loading ? <Text accessibilityRole="alert" className="py-10 text-center text-muted-foreground">Carregando promoções...</Text> : visiblePromotions.length ? visiblePromotions.map((promotion) => {
      const state = promotionState(promotion, now);
      const expired = state === "Encerradas";
      const displayedPrice = promotion.promotionalPrice ? formatMoney(promotion.promotionalPrice) : promotion.discountPercent && promotion.product?.price ? formatMoney(Number(promotion.product.price) * (1 - Number(promotion.discountPercent) / 100)) : null;
      return <View key={promotion.id} className="mb-3 rounded-2xl border border-input-border bg-card p-4">
        <View className="flex-row items-start justify-between gap-3"><View className="flex-1"><Text className="font-bold text-foreground">{promotion.product?.name ?? "Produto"}</Text><Text className="mt-1 text-xs text-muted-foreground">{promotion.discountPercent ? `${promotion.discountPercent}% de desconto` : "Preço promocional"}</Text></View><Text className={`rounded-full px-3 py-1 text-xs font-bold ${state === "Ativas" ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fff0c2] text-[#795600]"}`}>{state === "Ativas" ? "Ativa" : state === "Pausadas" ? "Pausada" : "Encerrada"}</Text></View>
        {displayedPrice ? <Text className="mt-3 text-lg font-bold text-primary">Por {displayedPrice}</Text> : null}
        <Text className="mt-2 text-xs text-muted-foreground">Válida de {formatPromotionDate(promotion.startAt)} até {formatPromotionDate(promotion.endAt)}</Text>
        {expired && promotion.enabled ? <Text className="mt-2 text-xs font-semibold text-muted-foreground">Prazo encerrado. A oferta não altera o preço nem aparece em destaque.</Text> : null}
        <Pressable accessibilityRole="button" disabled={changing !== null || (!promotion.enabled && expired)} onPress={() => void toggle(promotion)} className={`mt-3 min-h-10 items-center justify-center rounded-full ${!promotion.enabled && expired ? "bg-background" : "bg-primary"}`}><Text className={`font-semibold ${!promotion.enabled && expired ? "text-muted-foreground" : "text-white"}`}>{changing === promotion.id ? "Salvando..." : promotion.enabled ? "Desativar promoção" : expired ? "Reativação indisponível" : "Ativar promoção"}</Text></Pressable>
      </View>;
    }) : <View className="items-center rounded-2xl bg-card p-7"><Text className="text-center font-semibold text-foreground">{query || filter !== "Todas" ? "Nenhuma promoção encontrada" : "Você ainda não tem promoções"}</Text><Text className="mt-1 text-center text-sm text-muted-foreground">{query || filter !== "Todas" ? "Altere a busca ou o filtro para ver outras ofertas." : "Crie uma oferta para divulgar um produto aos seus clientes."}</Text><Pressable onPress={() => void openCreate()} className="mt-4 rounded-full bg-primary px-5 py-3"><Text className="font-bold text-white">Criar promoção</Text></Pressable></View>}

    <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
      <View className="flex-1 justify-end bg-black/40"><ScrollView className="max-h-[90%] rounded-t-3xl bg-card px-5 pt-5" keyboardShouldPersistTaps="handled"><Text className="text-xl font-bold text-foreground">Nova promoção</Text><Text className="mt-1 text-sm text-muted-foreground">Escolha um produto ativo com estoque e defina o período da oferta.</Text>
        <Pressable accessibilityRole="button" onPress={() => setProductPickerOpen(true)} className="mt-4 rounded-xl border border-input-border bg-background p-3"><Text className="text-xs text-muted-foreground">Produto</Text><Text className="mt-1 font-semibold text-foreground">{selectedProduct?.name ?? "Selecionar produto"}</Text></Pressable>
        {selectedProduct ? <Text className="mt-2 text-sm text-muted-foreground">Preço atual: {formatMoney(selectedProduct.price)}</Text> : null}
        <View className="mt-4 flex-row gap-2">{(["price", "percent"] as const).map((type) => <Pressable key={type} onPress={() => setDiscountType(type)} className={`flex-1 rounded-full px-3 py-2 ${discountType === type ? "bg-primary" : "bg-background"}`}><Text className={`text-center text-xs font-semibold ${discountType === type ? "text-white" : "text-foreground"}`}>{type === "price" ? "Preço promocional" : "Desconto (%)"}</Text></Pressable>)}</View>
        <TextInput accessibilityLabel={discountType === "price" ? "Preço promocional" : "Percentual de desconto"} keyboardType="decimal-pad" placeholder={discountType === "price" ? "Preço promocional (R$)" : "Desconto percentual"} value={discountValue} onChangeText={setDiscountValue} className="mt-3 h-11 rounded-xl bg-background px-3 text-foreground" />
        <TextInput accessibilityLabel="Início da promoção" placeholder="Início (ex.: 2026-10-15T09:00:00-04:00)" value={startAt} onChangeText={setStartAt} className="mt-3 h-11 rounded-xl bg-background px-3 text-foreground" />
        <TextInput accessibilityLabel="Término da promoção" placeholder="Término (ex.: 2026-10-16T18:00:00-04:00)" value={endAt} onChangeText={setEndAt} className="mt-2 h-11 rounded-xl bg-background px-3 text-foreground" />
        {formError ? <Text accessibilityRole="alert" className="mt-3 rounded-xl bg-[#ffdad6] p-3 text-sm text-[#93000a]">{formError}</Text> : null}
        <View className="mb-6 mt-4 flex-row gap-3"><Pressable onPress={() => setCreateOpen(false)} className="min-h-11 flex-1 items-center justify-center rounded-full bg-background"><Text className="font-bold text-foreground">Cancelar</Text></Pressable><Pressable disabled={saving} onPress={() => void createPromotion()} className="min-h-11 flex-1 items-center justify-center rounded-full bg-primary"><Text className="font-bold text-white">{saving ? "Salvando..." : "Salvar promoção"}</Text></Pressable></View>
      </ScrollView></View>
    </Modal>
    <Modal visible={productPickerOpen} transparent animationType="fade" onRequestClose={() => setProductPickerOpen(false)}><View className="flex-1 justify-center bg-black/40 px-5"><View className="max-h-[75%] rounded-2xl bg-card p-4"><Text className="mb-3 text-lg font-bold text-foreground">Produtos disponíveis</Text><ScrollView>{products.length ? products.map((product) => <Pressable key={product.id} onPress={() => { setSelectedProduct(product); setProductPickerOpen(false); }} className="border-b border-input-border py-3"><Text className="font-semibold text-foreground">{product.name}</Text><Text className="text-xs text-muted-foreground">{formatMoney(product.price)} · {product.stock} em estoque</Text></Pressable>) : <Text className="py-6 text-center text-sm text-muted-foreground">Nenhum produto ativo, disponível e sem promoção.</Text>}</ScrollView><Pressable onPress={() => setProductPickerOpen(false)} className="mt-3 self-end px-3 py-2"><Text className="font-bold text-primary">Fechar</Text></Pressable></View></View></Modal>
  </ScrollView>;
}
