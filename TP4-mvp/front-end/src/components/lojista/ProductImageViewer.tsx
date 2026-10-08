import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

export function ProductImageViewer({ images, initialIndex = 0, onClose }: { images: string[]; initialIndex?: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(initialIndex);
  const visibleIndex = Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0));

  useEffect(() => {
    setIndex(visibleIndex);
    const frame = requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: width * visibleIndex, y: 0, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [visibleIndex, width, images.length]);

  return <Modal visible={images.length > 0} animationType="fade" onRequestClose={onClose}>
    <View className="flex-1 bg-black">
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar imagem" onPress={onClose} className="absolute right-5 top-8 z-10 flex-row items-center gap-2 rounded-full bg-white/20 px-4 py-2">
        <Ionicons name="close" size={22} color="#fff" /><Text className="font-semibold text-white">Fechar</Text>
      </Pressable>
      {images.length > 1 ? <View className="absolute left-0 right-0 top-10 z-10 items-center"><Text className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white">{index + 1} / {images.length}</Text></View> : null}
      <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}>
        {images.map((uri, imageIndex) => <View key={`${imageIndex}-${uri}`} className="items-center justify-center" style={{ width, height }}>
          <Image source={{ uri }} style={{ width, height: height * 0.78 }} resizeMode="contain" accessibilityLabel={images.length === 1 ? "Foto do produto em tela cheia" : `Foto ${imageIndex + 1} do produto em tela cheia`} />
        </View>)}
      </ScrollView>
    </View>
  </Modal>;
}
