import { ScrollView, Text, View } from "react-native";
import { api } from "../../services/api";
import type { ProductQuery } from "../../services/public-catalog";
import { useCatalogDetail } from "../../services/use-catalog-detail";
import { CatalogAction, CatalogChip, CatalogError, CatalogSkeleton, ProductCard, StoreCard } from "./catalog-ui";
import { EmptyState } from "../feedback-state";

const loadPromotions = () => api.publicProducts({ onPromotion: true, limit: 4 });
const loadStores = () => api.publicStores({ limit: 3 });

export function HomeCommerce({ onProducts, onStores, onProduct, onStore }: {
  onProducts?: (filters?: ProductQuery) => void; onStores?: () => void; onProduct?: (id: string) => void; onStore?: (id: string) => void;
}) {
  const categories = useCatalogDetail(api.productCategories, "categories");
  const promotions = useCatalogDetail(loadPromotions, "promotions");
  const stores = useCatalogDetail(loadStores, "stores");
  return <View className="mb-5 gap-6">
    {categories.data?.length ? <View className="gap-3">
      <Text className="font-sans text-lg font-bold text-foreground">Materiais e insumos</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {categories.data.map((category) => <CatalogChip key={category.id} label={category.name} selected={false} onPress={() => onProducts?.({ categoryId: category.id })} />)}
      </ScrollView>
    </View> : categories.error ? <CatalogError message="Não foi possível carregar as categorias comerciais." onRetry={categories.retry} /> : null}
    <View className="gap-3">
      <Text className="font-sans text-lg font-bold text-foreground">Produtos em promoção</Text>
      <CatalogAction label="Ver todas as promoções" onPress={() => onProducts?.({ onPromotion: true })} />
      {promotions.loading ? <CatalogSkeleton /> : promotions.error ? <CatalogError message="Não foi possível carregar as promoções." onRetry={promotions.retry} /> : promotions.data?.items.length ?
        <View className="flex-row flex-wrap justify-between gap-y-4">{promotions.data.items.map((product) => <ProductCard key={product.id} product={product} onPress={() => onProduct?.(product.id)} />)}</View> : <EmptyState message="Nenhuma promoção disponível no momento." />}
    </View>
    <View className="gap-3">
      <Text className="font-sans text-lg font-bold text-foreground">Lojas e materiais</Text>
      <CatalogAction label="Ver todas as lojas" onPress={() => onStores?.()} />
      {stores.loading ? <CatalogSkeleton /> : stores.error ? <CatalogError message="Não foi possível carregar as lojas." onRetry={stores.retry} /> : stores.data?.items.length ?
        stores.data.items.map((store) => <StoreCard key={store.id} store={store} onPress={() => onStore?.(store.id)} />) : <EmptyState message="Nenhuma loja disponível no momento." />}
    </View>
  </View>;
}
