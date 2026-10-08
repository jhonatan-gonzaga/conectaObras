import { Ionicons } from "@expo/vector-icons";
import type { ImagePickerAsset } from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { ApiError, api } from "../../services/api";
import { pickProductImage } from "../../services/image-upload";
import { emptyProductForm, productPayload, productToForm, validateProductForm, type ProductCategory, type ProductForm, type ProductFormErrors, type ProductImage, type StoreProduct } from "../../services/store-products";

type PendingImage = { key: string; asset: ImagePickerAsset; progress: number; uploading: boolean; error?: string };

function FormField({ label, value, onChangeText, placeholder, error, required, keyboardType, multiline }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder?: string;
  error?: string; required?: boolean; keyboardType?: "default" | "decimal-pad" | "number-pad"; multiline?: boolean;
}) {
  return <View className="mb-4">
    <Text className="mb-1.5 text-sm font-semibold text-foreground">{label}{required ? <Text className="text-primary"> *</Text> : null}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#a1a1aa" keyboardType={keyboardType} multiline={multiline} numberOfLines={multiline ? 4 : 1}
      className={`rounded-[14px] border bg-card px-4 text-sm text-foreground ${multiline ? "min-h-[104px] py-3" : "min-h-12"} ${error ? "border-[#ba1a1a] border-b-2" : "border-[#e4d7d9]"}`} />
    {error ? <Text accessibilityRole="alert" className="mt-1 text-xs text-[#ba1a1a]">{error}</Text> : null}
  </View>;
}

export function StoreProductFormScreen({ productId, onBack, onSaved }: {
  productId: string | null; onBack: () => void; onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<ProductForm>(emptyProductForm);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [selectedCover, setSelectedCover] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(productId));
  const [busyGallery, setBusyGallery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const currentId = useRef<string | null>(productId);
  const savingRef = useRef(false);
  const galleryRef = useRef(false);

  useEffect(() => {
    let alive = true;
    api.productCategories().then((value) => { if (alive) setCategories(value); })
      .catch(() => { if (alive) setError("Não foi possível carregar as categorias."); });
    if (productId) {
      api.storeProduct(productId).then((value) => {
        if (!alive) return;
        setProduct(value); setForm(productToForm(value)); setImages(value.images);
        setSelectedCover(value.images.find((image) => image.isCover)?.id ?? null);
      }).catch((cause) => { if (alive) setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar o produto."); })
        .finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; };
  }, [productId]);

  const change = (field: keyof ProductForm, value: string | boolean) => {
    setForm((old) => ({ ...old, [field]: value }));
    setErrors((old) => ({ ...old, [field]: undefined }));
    setError(null);
  };

  const uploadOne = async (id: string, item: PendingImage): Promise<ProductImage | null> => {
    setPending((old) => old.map((entry) => entry.key === item.key ? { ...entry, uploading: true, error: undefined, progress: 0 } : entry));
    try {
      const image = await api.uploadStoreProductImage(id, item.asset, (progress) => {
        setPending((old) => old.map((entry) => entry.key === item.key ? { ...entry, progress } : entry));
      });
      setImages((old) => [...old, image].sort((a, b) => a.position - b.position));
      setPending((old) => old.filter((entry) => entry.key !== item.key));
      if (selectedCover === item.key) {
        try {
          const ordered = await api.setStoreProductCover(id, image.id);
          setImages(ordered); setSelectedCover(image.id);
        } catch (cause) {
          setPhotoError(cause instanceof Error ? cause.message : "Foto enviada, mas não foi possível definir a capa.");
        }
      }
      setPhotoError(null);
      return image;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível enviar a foto.";
      setPending((old) => old.map((entry) => entry.key === item.key ? { ...entry, uploading: false, error: message } : entry));
      setPhotoError(message);
      return null;
    }
  };

  const addPhoto = async () => {
    if (images.length + pending.length >= 8 || galleryRef.current || savingRef.current || pending.some((item) => item.uploading)) return;
    try {
      const asset = await pickProductImage();
      if (!asset) return;
      const item: PendingImage = { key: `${Date.now()}-${Math.random()}`, asset, progress: 0, uploading: false };
      setPending((old) => [...old, item]);
      if (!selectedCover && images.length === 0) setSelectedCover(item.key);
      setPhotoError(null);
      if (currentId.current) await uploadOne(currentId.current, item);
    } catch (cause) { setPhotoError(cause instanceof Error ? cause.message : "Não foi possível selecionar a foto."); }
  };

  const retryPhoto = async (item: PendingImage) => {
    if (item.uploading || savingRef.current) return;
    if (currentId.current) await uploadOne(currentId.current, item);
    else setPending((old) => old.map((entry) => entry.key === item.key ? { ...entry, error: undefined } : entry));
  };

  const galleryAction = async (action: () => Promise<ProductImage[] | void>) => {
    if (galleryRef.current || savingRef.current) return;
    galleryRef.current = true; setBusyGallery(true); setPhotoError(null);
    try { await action(); }
    catch (cause) { setPhotoError(cause instanceof Error ? cause.message : "Não foi possível alterar as fotos."); }
    finally { galleryRef.current = false; setBusyGallery(false); }
  };

  const removeImage = (image: ProductImage) => galleryAction(async () => {
    if (!currentId.current) return;
    await api.removeStoreProductImage(currentId.current, image.id);
    const refreshed = await api.storeProduct(currentId.current);
    setImages(refreshed.images); setSelectedCover(refreshed.images.find((entry) => entry.isCover)?.id ?? null);
  });

  const coverImage = (image: ProductImage) => galleryAction(async () => {
    if (!currentId.current) return;
    const ordered = await api.setStoreProductCover(currentId.current, image.id);
    setImages(ordered); setSelectedCover(image.id);
  });

  const moveImage = (index: number, direction: -1 | 1) => galleryAction(async () => {
    if (!currentId.current || index + direction < 0 || index + direction >= images.length) return;
    const ids = images.map((image) => image.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    setImages(await api.reorderStoreProductImages(currentId.current, ids));
  });

  const save = async () => {
    if (savingRef.current || busyGallery || pending.some((item) => item.uploading)) return;
    const validation = validateProductForm(form);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    if (form.active && images.length + pending.length === 0) { setPhotoError("Adicione uma foto de capa para ativar o produto."); return; }
    savingRef.current = true; setSaving(true); setError(null); setNotice(null);
    try {
      const payload = productPayload(form);
      let saved = currentId.current
        ? await api.updateStoreProduct(currentId.current, { ...payload, sku: form.sku.trim() || null, description: form.description.trim() || null })
        : await api.createStoreProduct(payload);
      currentId.current = saved.id;
      setProduct(saved);
      for (const item of pending) {
        const uploaded = await uploadOne(saved.id, item);
        if (!uploaded) throw new Error("O produto foi salvo, mas uma foto falhou. Toque em Tentar novamente.");
      }
      if (form.active && saved.status !== "ACTIVE") saved = await api.setStoreProductStatus(saved.id, "ACTIVE");
      else if (!form.active && saved.status === "ACTIVE") saved = await api.setStoreProductStatus(saved.id, "INACTIVE");
      setProduct(saved);
      onSaved(productId ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível salvar o produto.";
      if (cause instanceof ApiError && cause.details?.field === "price") setErrors((old) => ({ ...old, price: message }));
      else if (cause instanceof ApiError && cause.details?.field === "stock") setErrors((old) => ({ ...old, stock: message }));
      setError(message);
    } finally { savingRef.current = false; setSaving(false); }
  };

  const restore = async (status: "ACTIVE" | "INACTIVE") => {
    if (!currentId.current || savingRef.current) return;
    savingRef.current = true; setSaving(true); setError(null);
    try {
      const restored = await api.setStoreProductStatus(currentId.current, status);
      setProduct(restored); setForm(productToForm(restored));
      setNotice(status === "ACTIVE" ? "Produto reativado para venda." : "Produto restaurado. Agora você pode editá-lo.");
    } catch (cause) {
      const pending = cause instanceof ApiError ? cause.details?.pending : undefined;
      const reasons: Record<string, string> = {
        NAME_REQUIRED: "nome", ACTIVE_CATEGORY_REQUIRED: "categoria ativa", PRICE_REQUIRED: "preço",
        STOCK_REQUIRED: "estoque", COVER_IMAGE_REQUIRED: "foto de capa",
      };
      setError(pending?.length ? `Para reativar, revise: ${pending.map((item) => reasons[item] ?? item).join(", ")}. Você pode restaurar para editar.`
        : cause instanceof Error ? cause.message : "Não foi possível restaurar o produto.");
    } finally { savingRef.current = false; setSaving(false); }
  };

  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color="#b94b50" /><Text className="mt-3 text-muted-foreground">Carregando produto...</Text></View>;
  if (product?.status === "ARCHIVED") return <View className="flex-1 items-center justify-center bg-background px-6">
    <View className="w-full max-w-[420px] rounded-[22px] bg-card p-6"><Ionicons name="archive-outline" size={32} color="#b94b50" />
      <Text className="mt-4 text-xl font-bold text-foreground">Produto arquivado</Text>
      <Text className="mt-2 text-sm leading-5 text-muted-foreground">Restaure para editar o produto ou reative para exibi-lo na loja.</Text>
      {error ? <Text accessibilityRole="alert" className="mt-3 text-sm text-[#ba1a1a]">{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Restaurar para editar" disabled={saving} onPress={() => void restore("INACTIVE")} className="mt-5 min-h-12 items-center justify-center rounded-full bg-primary"><Text className="font-semibold text-white">{saving ? "Restaurando..." : "Restaurar para editar"}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Reativar para venda" disabled={saving} onPress={() => void restore("ACTIVE")} className="mt-3 min-h-12 items-center justify-center rounded-full border border-primary"><Text className="font-semibold text-primary">Reativar para venda</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar aos produtos" disabled={saving} onPress={onBack} className="mt-3 min-h-11 items-center justify-center"><Text className="font-semibold text-muted-foreground">Voltar</Text></Pressable>
    </View>
  </View>;

  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="w-full max-w-[560px] flex-1 bg-[#fbf6f7]">
    <View className="flex-row items-center justify-between border-b border-[#f1e5e7] px-4 py-3">
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar aos produtos" onPress={onBack} className="h-10 w-10 items-center justify-center rounded-full bg-card"><Ionicons name="arrow-back" size={20} color="#0f1720" /></Pressable>
      <Text className="text-base font-bold text-foreground">{currentId.current ? "Editar Produto" : "Novo Produto"}</Text>
      <View className="w-10" />
    </View>
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {notice ? <Text accessibilityRole="alert" className="mb-3 rounded-xl bg-[#eef4ff] p-3 text-sm text-primary">{notice}</Text> : null}
      {error ? <View className="mb-4 rounded-xl bg-[#ffdad6] p-3"><Text accessibilityRole="alert" className="text-sm text-[#93000a]">{error}</Text><Pressable accessibilityRole="button" onPress={() => void save()} className="mt-2 self-start"><Text className="font-semibold text-primary">Tentar novamente</Text></Pressable></View> : null}
      <View className="mb-3 flex-row items-center justify-between"><Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fotos do produto <Text className="text-primary">*</Text></Text><Text className="text-xs text-muted-foreground">{images.length + pending.length} de 8</Text></View>
      <Text className="mb-3 text-xs text-muted-foreground">Foto de capa obrigatória para ativar.</Text>
      <View className="mb-3 flex-row flex-wrap gap-2">
        {images.map((image, index) => <View key={image.id} className={`w-[31%] overflow-hidden rounded-xl border-2 bg-card ${image.isCover ? "border-primary" : "border-[#f1e5e7]"}`}>
          <Image source={{ uri: image.url }} className="h-24 w-full bg-[#e7eefc]" resizeMode="cover" />
          <Text numberOfLines={1} className="px-2 pt-1 text-[10px] font-semibold text-foreground">{image.isCover ? "CAPA" : `Foto ${index + 1}`}</Text>
          <View className="flex-row justify-between px-1 pb-1">
            <Pressable accessibilityRole="button" accessibilityLabel={`Mover foto ${index + 1} para esquerda`} disabled={busyGallery || index === 0} onPress={() => void moveImage(index, -1)} className="p-1"><Ionicons name="arrow-back" size={16} color="#897171" /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Mover foto ${index + 1} para direita`} disabled={busyGallery || index === images.length - 1} onPress={() => void moveImage(index, 1)} className="p-1"><Ionicons name="arrow-forward" size={16} color="#897171" /></Pressable>
            {!image.isCover ? <Pressable accessibilityRole="button" accessibilityLabel={`Definir foto ${index + 1} como capa`} disabled={busyGallery} onPress={() => void coverImage(image)} className="p-1"><Ionicons name="star-outline" size={16} color="#b94b50" /></Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={`Remover foto ${index + 1}`} disabled={busyGallery} onPress={() => void removeImage(image)} className="p-1"><Ionicons name="close" size={17} color="#ba1a1a" /></Pressable>
          </View>
        </View>)}
        {pending.map((item, index) => <View key={item.key} className={`w-[31%] overflow-hidden rounded-xl border-2 bg-card ${selectedCover === item.key ? "border-primary" : "border-[#f1e5e7]"}`}>
          <Image source={{ uri: item.asset.uri }} className="h-24 w-full bg-[#e7eefc]" resizeMode="cover" />
          <Text numberOfLines={1} className="px-2 pt-1 text-[10px] text-foreground">{item.asset.fileName || `Foto ${index + 1}`}</Text>
          {item.uploading ? <Text className="px-2 pb-1 text-[10px] text-primary">Enviando {item.progress}%</Text>
            : item.error ? <Pressable accessibilityRole="button" accessibilityLabel={`Tentar novamente foto ${index + 1}`} onPress={() => void retryPhoto(item)} className="px-2 pb-1"><Text className="text-[10px] font-semibold text-[#ba1a1a]">Tentar novamente</Text></Pressable>
            : <View className="flex-row justify-between px-1 pb-1"><Pressable accessibilityRole="button" accessibilityLabel={`Mover foto pendente ${index + 1} para esquerda`} disabled={index === 0} onPress={() => setPending((old) => { const next = [...old]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} className="p-1"><Ionicons name="arrow-back" size={15} color="#897171" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Mover foto pendente ${index + 1} para direita`} disabled={index === pending.length - 1} onPress={() => setPending((old) => { const next = [...old]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })} className="p-1"><Ionicons name="arrow-forward" size={15} color="#897171" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Definir foto pendente ${index + 1} como capa`} onPress={() => setSelectedCover(item.key)} className="p-1"><Ionicons name="star-outline" size={16} color="#b94b50" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Remover foto pendente ${index + 1}`} onPress={() => { setPending((old) => old.filter((entry) => entry.key !== item.key)); if (selectedCover === item.key) setSelectedCover(images.find((entry) => entry.isCover)?.id ?? null); }} className="p-1"><Ionicons name="close" size={17} color="#ba1a1a" /></Pressable></View>}
        </View>)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Adicionar foto" disabled={images.length + pending.length >= 8 || busyGallery || saving || pending.some((item) => item.uploading)} onPress={() => void addPhoto()} className="mb-2 items-center rounded-[16px] border-2 border-dashed border-[#e6d5d8] bg-card p-5">
        <View className="mb-2 h-11 w-11 items-center justify-center rounded-full bg-[#faeef0]"><Ionicons name="images-outline" size={23} color="#b94b50" /></View>
        <Text className="text-sm font-semibold text-foreground">Adicionar Foto</Text><Text className="text-xs text-muted-foreground">PNG ou JPG de até 5 MB</Text>
      </Pressable>
      {photoError ? <Text accessibilityRole="alert" className="mb-4 text-xs text-[#ba1a1a]">{photoError}</Text> : null}

      <View className="mt-3"><FormField label="Nome do Produto" required value={form.name} onChangeText={(value) => change("name", value)} placeholder="Ex: Furadeira de Impacto 710W" error={errors.name} />
        <View className="flex-row gap-3"><View className="flex-1"><FormField label="Preço (R$)" required value={form.price} onChangeText={(value) => change("price", value)} placeholder="0,00" keyboardType="decimal-pad" error={errors.price} /></View><View className="flex-1"><FormField label="Estoque (unid.)" required value={form.stock} onChangeText={(value) => change("stock", value)} placeholder="0" keyboardType="number-pad" error={errors.stock} /></View></View>
        <Text className="mb-1.5 text-sm font-semibold text-foreground">Categoria <Text className="text-primary">*</Text></Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">{categories.map((category) => <Pressable key={category.id} accessibilityRole="button" accessibilityState={{ selected: form.categoryId === category.id }} onPress={() => change("categoryId", category.id)} className={`mr-2 min-h-10 justify-center rounded-full px-4 ${form.categoryId === category.id ? "bg-primary" : "bg-card"}`}><Text className={`text-xs font-semibold ${form.categoryId === category.id ? "text-white" : "text-foreground"}`}>{category.name}</Text></Pressable>)}</ScrollView>
        {errors.categoryId ? <Text accessibilityRole="alert" className="mb-3 text-xs text-[#ba1a1a]">{errors.categoryId}</Text> : null}
        <FormField label="Código (SKU)" value={form.sku} onChangeText={(value) => change("sku", value)} placeholder="Ex: FUR-710-110V" error={errors.sku} />
        <FormField label="Descrição" value={form.description} onChangeText={(value) => change("description", value)} placeholder="Marca, voltagem, material, tamanho..." multiline error={errors.description} />
        <View className="mb-4 flex-row items-center justify-between rounded-[16px] bg-card p-4"><View className="min-w-0 flex-1 pr-3"><Text className="text-sm font-bold text-foreground">Disponível para venda</Text><Text className="mt-1 text-xs text-muted-foreground">Ative para exibir o produto no catálogo da loja</Text></View><Switch accessibilityLabel="Disponível para venda" value={form.active} onValueChange={(value) => change("active", value)} trackColor={{ true: "#b94b50" }} /></View>
      </View>
    </ScrollView>
    <View className="border-t border-[#f1e5e7] bg-[#fbf6f7] p-4"><Pressable accessibilityRole="button" accessibilityLabel="Salvar produto" disabled={saving || busyGallery || pending.some((item) => item.uploading)} onPress={() => void save()} className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-[16px] ${saving ? "bg-[#d48b8e]" : "bg-primary"}`}>
      {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={21} color="#fff" />}<Text className="text-base font-semibold text-white">{saving ? "Salvando dados..." : "Salvar Produto"}</Text>
    </Pressable></View>
  </KeyboardAvoidingView>;
}
