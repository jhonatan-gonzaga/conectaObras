import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Text, View } from "react-native";

import { CatalogAction } from "./catalog-ui";

export type CommerceOrdersState =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "error"; onRetry: () => void };

export function CommerceOrdersFeedback({ state, onStores }: {
  state: CommerceOrdersState;
  onStores: () => void;
}) {
  return <View className="items-center gap-4 rounded-2xl border border-black/5 bg-card px-6 py-8 shadow-sm shadow-black/5">
    {state.status === "loading" ? <>
      <ActivityIndicator accessibilityLabel="Carregando pedidos" size="large" color="#b94b50" />
      <Text accessibilityLiveRegion="polite" className="text-center font-sans text-sm text-muted-foreground">Carregando seus pedidos...</Text>
    </> : <>
      <View className="h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Ionicons name={state.status === "error" ? "alert-circle-outline" : "receipt-outline"} size={30} color="#7a6568" />
      </View>
      <View className="gap-2">
        <Text accessibilityRole={state.status === "error" ? "alert" : "header"} className="text-center font-sans text-base font-bold text-foreground">
          {state.status === "error" ? "Não foi possível carregar seus pedidos" : "Seus pedidos aparecerão aqui"}
        </Text>
        <Text className="text-center font-sans text-xs leading-5 text-muted-foreground">
          {state.status === "error" ? "Verifique sua conexão e tente novamente." : "A consulta de pedidos ainda não está disponível para clientes. Enquanto isso, explore as lojas e os produtos de Itacoatiara."}
        </Text>
      </View>
      <CatalogAction label={state.status === "error" ? "Tentar novamente" : "Explorar Lojas"} onPress={state.status === "error" ? state.onRetry : onStores} primary />
    </>}
  </View>;
}
