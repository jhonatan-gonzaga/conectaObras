import { useState } from "react";
import { View } from "react-native";
import type { ClientNavKey } from "../../components/cliente";
import { CatalogChip, CatalogFrame, RecentSearches } from "../../components/cliente/catalog-ui";
import { StoreCatalog, ProductCatalog } from "../../components/cliente/catalog-results";
import { ProfessionalSearchPanel } from "../../components/cliente/professional-search";
import { emptyClientSearch, type ClientSearchState } from "../../navigation/types";
import { useRecentSearches } from "../../services/recent-searches";

export function ClientSearchPage({ onBack, onNavigate, onOpenProfessional, onOpenStore, onOpenProduct, onProfilePress, userId, searchState, onSearchStateChange }: {
  onNavigate?: (key: ClientNavKey) => void; onBack?: () => void; onOpenProfessional?: (id: string) => void;
  onOpenStore?: (id: string) => void; onOpenProduct?: (id: string) => void; onProfilePress?: () => void;
  userId?: string; searchState?: ClientSearchState; onSearchStateChange?: (state: ClientSearchState) => void;
}) {
  const [localState, setLocalState] = useState(emptyClientSearch);
  const state = searchState ?? localState;
  const setState = onSearchStateChange ?? setLocalState;
  const history = useRecentSearches(userId);
  return <CatalogFrame title="Buscar" active="search" onBack={onBack ?? (() => onNavigate?.("home"))} onNavigate={onNavigate} onProfilePress={onProfilePress}>
    <View className="flex-row flex-wrap gap-2 rounded-full bg-muted p-1">
      {([ ["professionals", "Profissionais"], ["stores", "Lojas"], ["products", "Produtos"] ] as const).map(([domain, label]) => <CatalogChip key={domain} label={label} selected={state.domain === domain} onPress={() => setState({ ...state, domain })} />)}
    </View>
    <RecentSearches history={history} onReuse={(entry) => setState({ ...state, domain: entry.domain,
      ...(entry.domain === "professionals" ? { query: entry.query } : entry.domain === "stores" ? { stores: { ...state.stores, q: entry.query } } : { products: { ...state.products, q: entry.query } }),
    })} />
    {state.domain === "professionals" ? <ProfessionalSearchPanel query={state.query} onQueryChange={(query) => setState({ ...state, query })} history={history} onOpenProfessional={onOpenProfessional} /> : state.domain === "stores" ?
      <StoreCatalog filters={state.stores} onChange={(stores) => setState({ ...state, stores })} onStore={(id) => onOpenStore?.(id)} history={history} /> :
      <ProductCatalog filters={state.products} onChange={(products) => setState({ ...state, products })} onProduct={(id) => onOpenProduct?.(id)} history={history} />}
  </CatalogFrame>;
}
