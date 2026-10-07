import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ApiError, api } from "../../services/api";
import { inventoryPayload, type ProductCategory, type ProductFilters, type ProductStatus, type StockFilter, type StoreProduct } from "../../services/store-products";

const statusOptions: { label: string; value: ProductStatus | "" }[] = [
  { label: "Todos", value: "" }, { label: "Ativos", value: "ACTIVE" },
  { label: "Rascunhos", value: "DRAFT" }, { label: "Inativos", value: "INACTIVE" },
  { label: "Arquivados", value: "ARCHIVED" },
];
const stockOptions: { label: string; value: StockFilter | "" }[] = [
  { label: "Todo estoque", value: "" }, { label: "Em estoque", value: "IN_STOCK" },
  { label: "Esgotados", value: "OUT_OF_STOCK" },
];
const statusLabels: Record<ProductStatus, string> = {
  DRAFT: "Rascunho", ACTIVE: "Ativo", INACTIVE: "Inativo", ARCHIVED: "Arquivado",
};

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
    className={`mr-2 min-h-9 justify-center rounded-full px-4 ${selected ? "bg-primary" : "bg-card"}`}>
    <Text className={`text-xs font-semibold ${selected ? "text-white" : "text-muted-foreground"}`}>{label}</Text>
  </Pressable>;
}

function ProductCard({ product, onChanged, onEdit, onArchive, onSuccess }: {
  product: StoreProduct; onChanged: (value: StoreProduct) => void; onEdit: () => void;
  onArchive: () => void; onSuccess: (message: string) => void;
}) {
  const [price, setPrice] = useState(product.price.replace(".", ","));
  const [stock, setStock] = useState(String(product.stock));
  const [errors, setErrors] = useState<{ price?: string; stock?: string }>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => {
    setPrice(product.price.replace(".", ",")); setStock(String(product.stock));
  }, [product.price, product.stock]);

  const save = async () => {
    if (savingRef.current || product.status === "ARCHIVED") return;
    const result = inventoryPayload(price, stock, product);
    setErrors(result.errors);
    if (!result.payload || !Object.keys(result.payload).length) return;
    savingRef.current = true; setSaving(true);
    try {
      const updated = await api.updateStoreProductInventory(product.id, result.payload);
      onChanged(updated);
      setErrors({});
      onSuccess("Preço e estoque atualizados.");
    } catch (cause) {
      // A conflict can mean another session changed the product; reload the saved values.
      try {
        const latest = await api.storeProduct(product.id);
        onChanged(latest);
        setPrice(latest.price.replace(".", ",")); setStock(String(latest.stock));
      } catch {
        setPrice(product.price.replace(".", ",")); setStock(String(product.stock));
      }
      const message = cause instanceof ApiError ? cause.message : "Não foi possível atualizar o produto.";
      const field = cause instanceof ApiError ? cause.details?.field : undefined;
      setErrors(field === "price" ? { price: message } : field === "stock" ? { stock: message } : { price: message });
    } finally { savingRef.current = false; setSaving(false); }
  };

  const cover = product.images.find((image) => image.isCover) ?? product.images[0];
  return <View className="mb-3 rounded-[18px] bg-card p-4 shadow-sm shadow-primary/10">
    <View className="flex-row gap-3">
      {cover ? <Image source={{ uri: cover.url }} className="h-16 w-16 rounded-xl bg-[#e7eefc]" resizeMode="cover" />
        : <View className="h-16 w-16 items-center justify-center rounded-xl bg-[#e7eefc]"><Ionicons name="cube-outline" size={26} color="#897171" /></View>}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-start justify-between gap-1">
          <View className="rounded-full bg-[#e7eefc] px-2 py-0.5"><Text className="text-[11px] font-semibold text-foreground">{statusLabels[product.status]}</Text></View>
          <View className="flex-row gap-1">
            <Pressable accessibilityRole="button" accessibilityLabel={`Editar ${product.name}`} onPress={onEdit} className="h-8 w-8 items-center justify-center"><Ionicons name="create-outline" size={19} color="#564241" /></Pressable>
            {product.status !== "ARCHIVED" ? <Pressable accessibilityRole="button" accessibilityLabel={`Arquivar ${product.name}`} onPress={onArchive} className="h-8 w-8 items-center justify-center"><Ionicons name="archive-outline" size={19} color="#564241" /></Pressable> : null}
          </View>
        </View>
        <Text numberOfLines={2} className="mt-0.5 text-sm font-semibold text-foreground">{product.name}</Text>
        {product.sku ? <Text numberOfLines={1} className="text-[11px] text-muted-foreground">SKU: {product.sku}</Text> : null}
      </View>
    </View>
    <View className="mt-3 flex-row items-end gap-2 rounded-xl bg-[#eef4ff] p-2.5">
      <View className="min-w-0 flex-1">
        <Text className="mb-1 text-[11px] font-medium text-muted-foreground">Preço (R$)</Text>
        <TextInput accessibilityLabel={`Preço de ${product.name}`} value={price} onChangeText={(value) => { setPrice(value); setErrors((old) => ({ ...old, price: undefined })); }} keyboardType="decimal-pad" editable={product.status !== "ARCHIVED" && !saving} selectTextOnFocus className={`h-10 rounded-lg bg-card px-2 text-sm text-foreground ${errors.price ? "border-b-2 border-[#ba1a1a]" : ""}`} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="mb-1 text-[11px] font-medium text-muted-foreground">Estoque</Text>
        <TextInput accessibilityLabel={`Estoque de ${product.name}`} value={stock} onChangeText={(value) => { setStock(value); setErrors((old) => ({ ...old, stock: undefined })); }} keyboardType="number-pad" editable={product.status !== "ARCHIVED" && !saving} selectTextOnFocus className={`h-10 rounded-lg bg-card px-2 text-sm text-foreground ${errors.stock ? "border-b-2 border-[#ba1a1a]" : ""}`} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Salvar preço e estoque de ${product.name}`} disabled={saving || product.status === "ARCHIVED"} onPress={() => void save()} className={`h-10 w-10 items-center justify-center rounded-lg ${saving ? "bg-[#dbe3f0]" : "bg-primary"}`}>
        {saving ? <ActivityIndicator size="small" color="#99333a" /> : <Ionicons name="checkmark" size={22} color="#ffffff" />}
      </Pressable>
    </View>
    {errors.price ? <Text accessibilityRole="alert" className="mt-1 text-xs text-[#ba1a1a]">{errors.price}</Text> : null}
    {errors.stock ? <Text accessibilityRole="alert" className="mt-1 text-xs text-[#ba1a1a]">{errors.stock}</Text> : null}
  </View>;
}

export function StoreProductsScreen({ filters, onChangeFilters, initialNotice, onNoticeSeen, onBack, onCreate, onEdit }: {
  filters: ProductFilters; onChangeFilters: (filters: ProductFilters) => void;
  initialNotice?: string | null; onNoticeSeen?: () => void;
  onBack: () => void; onCreate: () => void; onEdit: (id: string) => void;
}) {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [items, setItems] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initialNotice ?? null);
  const [archiveTarget, setArchiveTarget] = useState<StoreProduct | null>(null);
  const [archiving, setArchiving] = useState(false);
  const archiveRef = useRef(false);
  const requestId = useRef(0);

  const load = useCallback(async (nextPage: number, append = false) => {
    const id = ++requestId.current;
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const result = await api.storeProducts({ ...filters, page: nextPage, limit: 10 });
      if (id !== requestId.current) return;
      setItems((previous) => append ? [...previous, ...result.items] : result.items);
      setTotal(result.total); setPage(result.page);
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar os produtos.");
    } finally {
      if (id === requestId.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [filters]);

  useEffect(() => {
    api.productCategories().then(setCategories).catch(() => setError("Não foi possível carregar as categorias."));
    if (initialNotice) onNoticeSeen?.();
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => { void load(1); }, filters.q ? 250 : 0);
    return () => { clearTimeout(timer); requestId.current++; };
  }, [load, filters.q]);

  const setFilter = (change: Partial<ProductFilters>) => onChangeFilters({ ...filters, ...change });
  const archive = async () => {
    if (!archiveTarget || archiveRef.current) return;
    archiveRef.current = true; setArchiving(true);
    try {
      await api.archiveStoreProduct(archiveTarget.id);
      setArchiveTarget(null); setNotice("Produto arquivado com sucesso.");
      await load(1);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível arquivar o produto.");
    } finally { archiveRef.current = false; setArchiving(false); }
  };

  return <View className="w-full max-w-[560px] flex-1 bg-background">
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 36 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View className="flex-row items-center justify-between bg-card px-5 py-3">
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar ao painel" onPress={onBack} className="h-10 w-10 items-center justify-center rounded-full bg-background"><Ionicons name="arrow-back" size={20} color="#141c25" /></Pressable>
        <Text className="text-base font-semibold text-foreground">Catálogo da loja</Text>
        <View className="w-10" />
      </View>
      <View className="px-5 pt-5">
        {notice ? <Text accessibilityRole="alert" className="mb-3 rounded-full bg-[#eef4ff] px-4 py-2 text-sm text-primary">{notice}</Text> : null}
        <View className="mb-4 flex-row items-center justify-between gap-2">
          <View><Text className="text-[26px] font-semibold text-foreground">Produtos</Text><Text className="text-xs text-muted-foreground">{total} {total === 1 ? "item encontrado" : "itens encontrados"}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Novo produto" onPress={onCreate} className="min-h-10 flex-row items-center gap-1 rounded-full bg-primary px-4"><Ionicons name="add" size={18} color="#fff" /><Text className="text-xs font-semibold text-white">Novo produto</Text></Pressable>
        </View>
        <View className="mb-3 flex-row items-center rounded-full bg-card px-4">
          <Ionicons name="search" size={19} color="#897171" />
          <TextInput accessibilityLabel="Buscar produtos" value={filters.q} onChangeText={(q) => setFilter({ q })} placeholder="Buscar por nome ou SKU..." placeholderTextColor="#897171" className="min-h-11 flex-1 pl-2 text-sm text-foreground" />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <FilterChip label="Todas categorias" selected={!filters.categoryId} onPress={() => setFilter({ categoryId: "" })} />
        {categories.map((category) => <FilterChip key={category.id} label={category.name} selected={filters.categoryId === category.id} onPress={() => setFilter({ categoryId: category.id })} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        {statusOptions.map((option) => <FilterChip key={option.label} label={option.label} selected={filters.status === option.value} onPress={() => setFilter({ status: option.value })} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 14 }}>
        {stockOptions.map((option) => <FilterChip key={option.label} label={option.label} selected={filters.stock === option.value} onPress={() => setFilter({ stock: option.value })} />)}
      </ScrollView>
      <View className="px-5">
        {loading ? <View className="items-center py-12"><ActivityIndicator color="#b94b50" /><Text className="mt-3 text-sm text-muted-foreground">Carregando produtos...</Text></View>
          : error && !items.length ? <View className="items-center rounded-2xl bg-card p-6"><Text accessibilityRole="alert" className="text-center text-primary">{error}</Text><Pressable accessibilityRole="button" onPress={() => void load(1)} className="mt-3 rounded-full bg-primary px-5 py-2"><Text className="font-semibold text-white">Tentar novamente</Text></Pressable></View>
          : items.length === 0 ? <View className="items-center rounded-2xl bg-card p-7"><Ionicons name="cube-outline" size={32} color="#b94b50" /><Text className="mt-3 text-center font-semibold text-foreground">Nenhum produto encontrado</Text><Text className="mt-1 text-center text-sm text-muted-foreground">Ajuste os filtros ou cadastre um produto.</Text></View>
          : items.map((product) => <ProductCard key={product.id} product={product} onChanged={(updated) => setItems((old) => old.map((item) => item.id === updated.id ? updated : item))} onEdit={() => onEdit(product.id)} onArchive={() => setArchiveTarget(product)} onSuccess={setNotice} />)}
        {error && items.length > 0 ? <Text accessibilityRole="alert" className="mb-3 text-sm text-primary">{error}</Text> : null}
        {!loading && items.length < total ? <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => void load(page + 1, true)} className="min-h-11 items-center justify-center rounded-full bg-card"><Text className="font-semibold text-primary">{loadingMore ? "Carregando..." : "Carregar mais"}</Text></Pressable> : null}
      </View>
    </ScrollView>
    <View className="flex-row border-t border-input-border bg-card px-2 py-1">
      <Pressable accessibilityRole="button" accessibilityLabel="Painel" onPress={onBack} className="min-h-[54px] flex-1 items-center justify-center"><Ionicons name="storefront-outline" size={21} color="#897171" /><Text className="text-[10px] text-muted-foreground">Painel</Text></Pressable>
      <View className="min-h-[54px] flex-1 items-center justify-center"><Ionicons name="cube" size={21} color="#99333a" /><Text className="text-[10px] font-semibold text-primary">Produtos</Text></View>
    </View>
    <Modal visible={Boolean(archiveTarget)} transparent animationType="fade" onRequestClose={() => { if (!archiving) setArchiveTarget(null); }}>
      <View className="flex-1 justify-center bg-black/40 px-6"><View className="rounded-[22px] bg-card p-6">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-[#ffdad6]"><Ionicons name="archive-outline" size={25} color="#ba1a1a" /></View>
        <Text className="mt-4 text-xl font-semibold text-foreground">Arquivar produto?</Text>
        <Text className="mt-2 text-sm leading-5 text-muted-foreground">{archiveTarget?.name} sairá da lista padrão. Você ainda poderá encontrá-lo em Arquivados.</Text>
        <View className="mt-6 flex-row gap-3">
          <Pressable accessibilityRole="button" disabled={archiving} onPress={() => setArchiveTarget(null)} className="min-h-11 flex-1 items-center justify-center rounded-full bg-[#eef4ff]"><Text className="font-semibold text-foreground">Cancelar</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Confirmar arquivamento" disabled={archiving} onPress={() => void archive()} className="min-h-11 flex-1 items-center justify-center rounded-full bg-primary"><Text className="font-semibold text-white">{archiving ? "Arquivando..." : "Arquivar"}</Text></Pressable>
        </View>
      </View></View>
    </Modal>
  </View>;
}
