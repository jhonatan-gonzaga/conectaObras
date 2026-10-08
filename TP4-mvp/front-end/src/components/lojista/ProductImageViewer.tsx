import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, Pressable, Text, View } from "react-native";

export function ProductImageViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  return <Modal visible={Boolean(uri)} animationType="fade" onRequestClose={onClose}>
    <View className="flex-1 bg-black">
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar imagem" onPress={onClose} className="absolute right-5 top-8 z-10 flex-row items-center gap-2 rounded-full bg-white/20 px-4 py-2">
        <Ionicons name="close" size={22} color="#fff" /><Text className="font-semibold text-white">Fechar</Text>
      </Pressable>
      {uri ? <Image source={{ uri }} className="h-full w-full" resizeMode="contain" accessibilityLabel="Foto do produto em tela cheia" /> : null}
    </View>
  </Modal>;
}
