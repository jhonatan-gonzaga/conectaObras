import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { formatMoney, resolveImageUrl, type StoreOrder } from "../../services/api";
import { productAvailability, productStatusLabels, type ProductDetails } from "../../services/store-products";
import { ProductImageViewer } from "./ProductImageViewer";
import { AppThemeContext } from "../app-theme";

export function ProductDetailsModal({ visible, product, orderItem, loading = false, error, onRetry, onClose, action }: {
  visible: boolean; product: ProductDetails | null; orderItem?: StoreOrder["items"][number];
  loading?: boolean; error?: string | null; onRetry?: () => void; onClose: () => void;
  action?: { label: string; accessibilityLabel: string; onPress: () => void };
}) {
  const [viewImages, setViewImages] = useState<string[]>([]);
  const theme = useContext(AppThemeContext);
  const [viewIndex, setViewIndex] = useState(0);
  useEffect(() => { if (!visible) setViewImages([]); }, [visible]);
  const availability = product?.status && product.stock !== undefined
    ? productAvailability({ status: product.status, stock: product.stock }) : null;

  return <>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={theme} className="flex-1 justify-end bg-black/50"><View accessibilityViewIsModal className="max-h-[90%] rounded-t-[24px] bg-card px-5 pb-8 pt-4">
        <View className="mb-3 flex-row items-center justify-between"><Text className="text-lg font-bold text-foreground">Detalhes do produto</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar detalhes" onPress={onClose} className="min-h-11 min-w-11 items-center justify-center"><Ionicons name="close" size={24} color="#564241" /></Pressable></View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text className="text-xl font-semibold text-foreground">{product?.name ?? orderItem?.name}</Text>
          {orderItem ? <View className="mt-3 gap-2 rounded-xl bg-background p-4">
            <Text className="font-semibold text-foreground">Neste pedido</Text>
            {product && product.name !== orderItem.name ? <Text className="text-sm text-foreground">Produto comprado: {orderItem.name}</Text> : null}
            <Text className="text-sm text-foreground">Quantidade: {orderItem.quantity}</Text>
            <Text className="text-sm text-foreground">Preço unitário no pedido: {formatMoney(orderItem.unitPrice)}</Text>
            <Text className="text-sm font-semibold text-foreground">Total do item: {formatMoney(orderItem.lineTotal ?? Number(orderItem.unitPrice) * orderItem.quantity)}</Text>
            {orderItem.sku ? <Text className="text-sm text-foreground">SKU no pedido: {orderItem.sku}</Text> : null}
          </View> : null}
          {loading ? <View className="items-center gap-2 py-5"><ActivityIndicator color="#b94b50" /><Text className="text-sm text-muted-foreground">Carregando informações do produto...</Text></View> : null}
          {error ? <View className="my-3 gap-2 rounded-xl bg-background p-3"><Text accessibilityRole="alert" className="text-sm text-primary">{error}</Text>{onRetry ? <Pressable accessibilityRole="button" accessibilityLabel="Tentar carregar produto novamente" onPress={onRetry} className="min-h-11 justify-center"><Text className="font-semibold text-primary">Tentar novamente</Text></Pressable> : null}</View> : null}
          {product ? <>
            {availability ? <Text className="mt-1 text-sm font-semibold" style={{ color: availability.color }}>● {availability.label}</Text> : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="my-4">
              {product.images.map((image, index) => <Pressable key={image.id} accessibilityRole="button" accessibilityLabel={`Ampliar foto ${index + 1} de ${product.name}`} onPress={() => { setViewImages(product.images.map((entry) => resolveImageUrl(entry.url) ?? entry.url)); setViewIndex(index); }} className="mr-2"><Image source={{ uri: resolveImageUrl(image.url) ?? image.url }} style={{ width: 112, height: 112 }} className="rounded-xl bg-[#e7eefc]" resizeMode="cover" /></Pressable>)}
            </ScrollView>
            <View className="rounded-xl bg-background p-4">
              <Text className="text-sm text-foreground">{orderItem ? "Preço atual no catálogo" : "Preço"}: {formatMoney(product.price)}</Text>
              {product.stock !== undefined ? <Text className="mt-2 text-sm text-foreground">Estoque: {product.stock} unidades</Text> : null}
              <Text className="mt-2 text-sm text-foreground">Categoria: {product.categoryName || "Categoria indisponível"}</Text>
              {product.status ? <Text className="mt-2 text-sm text-foreground">Status: {productStatusLabels[product.status]}</Text> : null}
              {product.sku ? <Text className="mt-2 text-sm text-foreground">SKU: {product.sku}</Text> : null}
            </View>
            <Text className="mt-4 text-sm font-semibold text-foreground">Descrição</Text><Text className="mt-1 text-sm leading-5 text-muted-foreground">{product.description || "Sem descrição."}</Text>
          </> : orderItem && !loading && !error ? <Text className="mt-4 text-sm leading-5 text-muted-foreground">Este produto não está mais disponível no catálogo. Os dados do pedido foram preservados.</Text> : null}
          {action ? <Pressable accessibilityRole="button" accessibilityLabel={action.accessibilityLabel} onPress={action.onPress} className="mt-5 min-h-12 items-center justify-center rounded-full bg-primary"><Text className="font-semibold text-white">{action.label}</Text></Pressable> : null}
        </ScrollView>
      </View></View>
    </Modal>
    <ProductImageViewer images={viewImages} initialIndex={viewIndex} onClose={() => setViewImages([])} />
  </>;
}
