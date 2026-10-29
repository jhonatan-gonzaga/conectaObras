import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { api } from "../../services/api";
import { catalogPriceError, catalogPriceInput, type CatalogPage, type ProductQuery, type PublicProduct, type PublicStore, type StoreQuery } from "../../services/public-catalog";
import { useCatalogPage } from "../../services/use-catalog-page";
import { useCatalogDetail } from "../../services/use-catalog-detail";
import type { useRecentSearches } from "../../services/recent-searches";
import { EmptyState } from "../feedback-state";
import { CatalogAction, CatalogChip, CatalogError, CatalogInput, CatalogPagination, CatalogSearchInput, CatalogSkeleton, CatalogToggle, ProductCard, StoreCard } from "./catalog-ui";

type History = ReturnType<typeof useRecentSearches>;

function PageResults<T extends { id: string }>({ result, children, empty }: {
  result: ReturnType<typeof useCatalogPage<T, { page?: number }>>; children: React.ReactNode; empty: string;
}) {
  return <View className="gap-4">
    <Text accessibilityLiveRegion="polite" className="font-sans text-sm font-semibold text-foreground">{result.total} resultados</Text>
    {result.loading && result.items.length === 0 ? <CatalogSkeleton /> : <>
      {result.error ? <CatalogError message={result.error} onRetry={result.retry} /> : null}
      {!result.error && result.items.length === 0 ? <EmptyState message={empty} /> : children}
      {result.items.length > 0 ? <CatalogPagination count={result.items.length} total={result.total} hasMore={result.hasMore && !result.error} loading={result.loading} onMore={result.loadMore} /> : null}
    </>}
  </View>;
}

export function StoreCatalog({ filters, onChange, onStore, history }: {
  filters: StoreQuery; onChange: (filters: StoreQuery) => void; onStore: (id: string) => void; history?: History;
}) {
  const fetchPage = useCallback((query: StoreQuery) => {
    history?.record("stores", query.q ?? "");
    return api.publicStores(query);
  }, [history?.record]);
  const result = useCatalogPage<PublicStore, StoreQuery>(fetchPage, filters);
  const patch = (changes: Partial<StoreQuery>) => onChange({ ...filters, ...changes, page: undefined });
  return <View className="gap-5">
    <CatalogSearchInput query={filters.q ?? ""} onChange={(q) => patch({ q })} placeholder="Buscar lojas" />
    <View className="gap-3 rounded-2xl bg-muted p-3">
      <CatalogInput label="Bairro" value={filters.neighborhood ?? ""} maxLength={120} placeholder="Todos os bairros" onChangeText={(neighborhood) => patch({ neighborhood })} />
      <CatalogToggle label="Aberto agora" value={filters.openNow === true} onChange={(value) => patch({ openNow: value || undefined })} />
    </View>
    <CatalogAction label="Limpar filtros de lojas" onPress={() => onChange({})} />
    <PageResults result={result} empty="Nenhuma loja encontrada. Experimente outros filtros.">
      <View className="gap-4">{result.items.map((store) => <StoreCard key={store.id} store={store} onPress={() => onStore(store.id)} />)}</View>
    </PageResults>
  </View>;
}

export function ProductCatalog({ filters, onChange, onProduct, history, showSearch = true, fullWidth = false }: {
  filters: ProductQuery; onChange: (filters: ProductQuery) => void; onProduct: (id: string) => void; history?: History; showSearch?: boolean; fullWidth?: boolean;
}) {
  const [minPrice, setMinPrice] = useState(filters.minPrice ?? "");
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice ?? "");
  // Query filters are owned by navigation so returning from details restores them.
  const lastPrices = useRef({ min: filters.minPrice, max: filters.maxPrice });
  useEffect(() => {
    if (lastPrices.current.min !== filters.minPrice) setMinPrice(filters.minPrice ?? "");
    if (lastPrices.current.max !== filters.maxPrice) setMaxPrice(filters.maxPrice ?? "");
    lastPrices.current = { min: filters.minPrice, max: filters.maxPrice };
  }, [filters.minPrice, filters.maxPrice]);
  const priceError = catalogPriceError(minPrice, maxPrice);
  const categories = useCatalogDetail(api.productCategories, "categories");
  const fetchPage = useCallback((query: ProductQuery): Promise<CatalogPage<PublicProduct>> => {
    history?.record("products", query.q ?? "");
    return api.publicProducts(query).then((page) => {
      if (query.storeId && page.items.some((product) => product.store.id !== query.storeId)) throw new Error("Não foi possível confirmar os produtos desta loja. Tente novamente.");
      return page;
    });
  }, [history?.record]);
  const query = { ...filters, minPrice: catalogPriceInput(minPrice), maxPrice: catalogPriceInput(maxPrice) };
  const result = useCatalogPage<PublicProduct, ProductQuery>(fetchPage, query, !priceError);
  const patch = (changes: Partial<ProductQuery>) => onChange({ ...filters, ...changes, page: undefined });
  const changePrice = (min: string, max: string) => {
    setMinPrice(min); setMaxPrice(max);
    if (!catalogPriceError(min, max)) patch({ minPrice: catalogPriceInput(min), maxPrice: catalogPriceInput(max) });
  };
  return <View className="gap-5">
    {showSearch ? <CatalogSearchInput query={filters.q ?? ""} onChange={(q) => patch({ q })} placeholder="Buscar produtos, materiais ou ferramentas" /> : null}
    <View className="gap-3"><Text className="font-sans text-sm font-semibold text-foreground">Categorias de produtos</Text>
      {categories.loading ? <Text className="font-sans text-sm text-muted-foreground">Carregando categorias...</Text> : categories.error ? <CatalogError message="Não foi possível carregar as categorias." onRetry={categories.retry} /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <CatalogChip label="Todos os produtos" selected={!filters.categoryId} onPress={() => patch({ categoryId: undefined })} />
        {categories.data?.map((category) => <CatalogChip key={category.id} label={category.name} selected={filters.categoryId === category.id} onPress={() => patch({ categoryId: category.id })} />)}
      </ScrollView>
    </View>
    <View className="gap-3 rounded-2xl bg-muted p-3">
      <Text className="font-sans text-sm font-semibold text-foreground">Faixa de preço</Text>
      <View className="flex-row gap-3"><CatalogInput label="Preço mínimo (R$)" value={minPrice} keyboardType="decimal-pad" placeholder="Sem mínimo" onChangeText={(value) => changePrice(value, maxPrice)} /><CatalogInput label="Preço máximo (R$)" value={maxPrice} keyboardType="decimal-pad" placeholder="Sem máximo" onChangeText={(value) => changePrice(minPrice, value)} /></View>
      {priceError ? <Text accessibilityRole="alert" className="font-sans text-sm text-primary">{priceError}</Text> : null}
      <CatalogToggle label="Somente em estoque" value={filters.inStock === true} onChange={(value) => patch({ inStock: value || undefined })} />
      <CatalogToggle label="Com promoção vigente" value={filters.onPromotion === true} onChange={(value) => patch({ onPromotion: value || undefined })} />
    </View>
    <CatalogAction label="Limpar filtros de produtos" onPress={() => { setMinPrice(""); setMaxPrice(""); onChange(filters.storeId ? { storeId: filters.storeId } : {}); }} />
    {!priceError ? <PageResults result={result} empty="Nenhum produto encontrado. Experimente outros filtros.">
      <View className="flex-row flex-wrap justify-between gap-y-4">{result.items.map((product) => <ProductCard key={product.id} product={product} fullWidth={fullWidth} onPress={() => onProduct(product.id)} />)}</View>
    </PageResults> : null}
  </View>;
}
