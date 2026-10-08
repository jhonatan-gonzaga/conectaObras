import { Ionicons } from "@expo/vector-icons";
import type { ImagePickerAsset } from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { ProductImageViewer } from "../../components/lojista/ProductImageViewer";
import { ApiError, api } from "../../services/api";
import { pickProductImage } from "../../services/image-upload";
import { emptyProductForm, productPayload, productToForm, validateProductForm, type ProductCategory, type ProductForm, type ProductFormErrors, type ProductImage, type StoreProduct } from "../../services/store-products";

type PendingImage = { key: string; asset: ImagePickerAsset; progress: number; uploading: boolean; error?: string };
type PhotoToRemove = { kind: "saved"; image: ProductImage } | { kind: "pending"; key: string };

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
  const [photoToRemove, setPhotoToRemove] = useState<PhotoToRemove | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [galleryChanged, setGalleryChanged] = useState(false);
  const currentId = useRef<string | null>(productId);
  const initialForm = useRef<ProductForm>(emptyProductForm());
  const savingRef = useRef(false);
  const galleryRef = useRef(false);

  useEffect(() => {
    let alive = true;
    api.productCategories().then((value) => { if (alive) setCategories(value); })
      .catch(() => { if (alive) setError("Não foi possível carregar as categorias."); });
    if (productId) {
      api.storeProduct(productId).then((value) => {
        if (!alive) return;
        const loadedForm = productToForm(value);
        initialForm.current = loadedForm;
        setProduct(value); setForm(loadedForm); setImages(value.images);
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
      setGalleryChanged(true);
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
    setGalleryChanged(true);
  });

  const coverImage = (image: ProductImage) => galleryAction(async () => {
    if (!currentId.current) return;
    const ordered = await api.setStoreProductCover(currentId.current, image.id);
    setImages(ordered); setSelectedCover(image.id);
    setGalleryChanged(true);
  });

  const moveImage = (index: number, direction: -1 | 1) => galleryAction(async () => {
    if (!currentId.current || index + direction < 0 || index + direction >= images.length) return;
    const ids = images.map((image) => image.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    setImages(await api.reorderStoreProductImages(currentId.current, ids));
    setGalleryChanged(true);
  });

  const confirmRemovePhoto = async () => {
    if (!photoToRemove || galleryRef.current || savingRef.current) return;
    const target = photoToRemove;
    setPhotoToRemove(null);
    if (target.kind === "saved") await removeImage(target.image);
    else {
      setPending((old) => old.filter((entry) => entry.key !== target.key));
      if (selectedCover === target.key) setSelectedCover(images.find((entry) => entry.isCover)?.id ?? null);
      setPhotoError(null);
    }
  };

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

  const deleteProduct = async () => {
    if (!productId || !product || savingRef.current || galleryRef.current || pending.some((item) => item.uploading)) return;
    savingRef.current = true; setSaving(true); setDeleteError(null);
    try {
      await api.archiveStoreProduct(productId);
      setConfirmDelete(false);
      onSaved("Produto retirado do catálogo. Você pode restaurá-lo em Arquivados.");
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "Não foi possível excluir o produto.");
    } finally { savingRef.current = false; setSaving(false); }
  };

  const restore = async (status: "ACTIVE" | "INACTIVE") => {
    if (!currentId.current || savingRef.current) return;
    savingRef.current = true; setSaving(true); setError(null);
    try {
      const restored = await api.setStoreProductStatus(currentId.current, status);
      const restoredForm = productToForm(restored);
      initialForm.current = restoredForm;
      setProduct(restored); setForm(restoredForm);
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

  const hasChanges = JSON.stringify(form) !== JSON.stringify(initialForm.current) || pending.length > 0 || galleryChanged;
  const requestBack = () => {
    if (savingRef.current || galleryRef.current || pending.some((item) => item.uploading)) return;
    if (hasChanges) setConfirmExit(true);
    else onBack();
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { requestBack(); return true; });
    return () => subscription.remove();
  });

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
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar aos produtos" onPress={requestBack} className="h-10 w-10 items-center justify-center rounded-full bg-card"><Ionicons name="arrow-back" size={20} color="#0f1720" /></Pressable>
      <Text className="flex-1 text-center text-base font-bold text-foreground">{currentId.current ? "Editar Produto" : "Novo Produto"}</Text>
      {productId && product ? <Pressable accessibilityRole="button" accessibilityLabel="Excluir produto" disabled={saving || busyGallery || pending.some((item) => item.uploading)} onPress={() => { setDeleteError(null); setConfirmDelete(true); }} className="min-h-10 flex-row items-center gap-1 rounded-full px-2"><Ionicons name="trash-outline" size={17} color="#ba1a1a" /><Text className="text-xs font-semibold text-[#ba1a1a]">Excluir</Text></Pressable> : <View className="w-10" />}
    </View>
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {notice ? <Text accessibilityRole="alert" className="mb-3 rounded-xl bg-[#eef4ff] p-3 text-sm text-primary">{notice}</Text> : null}
      {error ? <View className="mb-4 rounded-xl bg-[#ffdad6] p-3"><Text accessibilityRole="alert" className="text-sm text-[#93000a]">{error}</Text><Pressable accessibilityRole="button" onPress={() => void save()} className="mt-2 self-start"><Text className="font-semibold text-primary">Tentar novamente</Text></Pressable></View> : null}
      <View className="mb-3 flex-row items-center justify-between"><Text className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fotos do produto <Text className="text-primary">*</Text></Text><Text className="text-xs text-muted-foreground">{images.length + pending.length} de 8</Text></View>
      <Text className="mb-3 text-xs text-muted-foreground">Foto de capa obrigatória para ativar.</Text>
      <View className="mb-3 flex-row flex-wrap gap-2">
        {images.map((image, index) => <View key={image.id} className={`w-[31%] overflow-hidden rounded-xl border-2 bg-card ${image.isCover ? "border-primary" : "border-[#f1e5e7]"}`}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Ampliar foto ${index + 1}`} onPress={() => setViewImage(image.url)}><Image source={{ uri: image.url }} className="h-24 w-full bg-[#e7eefc]" resizeMode="cover" /></Pressable>
          <Text numberOfLines={1} className="px-2 pt-1 text-[10px] font-semibold text-foreground">{image.isCover ? "CAPA" : `Foto ${index + 1}`}</Text>
          <View className="flex-row justify-between px-1 pb-1">
            <Pressable accessibilityRole="button" accessibilityLabel={`Mover foto ${index + 1} para esquerda`} disabled={busyGallery || index === 0} onPress={() => void moveImage(index, -1)} className="p-1"><Ionicons name="arrow-back" size={16} color="#897171" /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Mover foto ${index + 1} para direita`} disabled={busyGallery || index === images.length - 1} onPress={() => void moveImage(index, 1)} className="p-1"><Ionicons name="arrow-forward" size={16} color="#897171" /></Pressable>
            {!image.isCover ? <Pressable accessibilityRole="button" accessibilityLabel={`Definir foto ${index + 1} como capa`} disabled={busyGallery} onPress={() => void coverImage(image)} className="p-1"><Ionicons name="star-outline" size={16} color="#b94b50" /></Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={`Remover foto ${index + 1}`} disabled={busyGallery} onPress={() => setPhotoToRemove({ kind: "saved", image })} className="p-1"><Ionicons name="close" size={17} color="#ba1a1a" /></Pressable>
          </View>
        </View>)}
        {pending.map((item, index) => <View key={item.key} className={`w-[31%] overflow-hidden rounded-xl border-2 bg-card ${selectedCover === item.key ? "border-primary" : "border-[#f1e5e7]"}`}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Ampliar foto pendente ${index + 1}`} onPress={() => setViewImage(item.asset.uri)}><Image source={{ uri: item.asset.uri }} className="h-24 w-full bg-[#e7eefc]" resizeMode="cover" /></Pressable>
          <Text numberOfLines={1} className="px-2 pt-1 text-[10px] text-foreground">{item.asset.fileName || `Foto ${index + 1}`}</Text>
          {item.uploading ? <Text className="px-2 pb-1 text-[10px] text-primary">Enviando {item.progress}%</Text>
            : item.error ? <View className="flex-row items-center justify-between px-2 pb-1"><Pressable accessibilityRole="button" accessibilityLabel={`Tentar novamente foto ${index + 1}`} onPress={() => void retryPhoto(item)}><Text className="text-[10px] font-semibold text-[#ba1a1a]">Tentar novamente</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Remover foto pendente ${index + 1}`} onPress={() => setPhotoToRemove({ kind: "pending", key: item.key })}><Ionicons name="close" size={17} color="#ba1a1a" /></Pressable></View>
            : <View className="flex-row justify-between px-1 pb-1"><Pressable accessibilityRole="button" accessibilityLabel={`Mover foto pendente ${index + 1} para esquerda`} disabled={index === 0} onPress={() => setPending((old) => { const next = [...old]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} className="p-1"><Ionicons name="arrow-back" size={15} color="#897171" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Mover foto pendente ${index + 1} para direita`} disabled={index === pending.length - 1} onPress={() => setPending((old) => { const next = [...old]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })} className="p-1"><Ionicons name="arrow-forward" size={15} color="#897171" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Definir foto pendente ${index + 1} como capa`} onPress={() => setSelectedCover(item.key)} className="p-1"><Ionicons name="star-outline" size={16} color="#b94b50" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Remover foto pendente ${index + 1}`} onPress={() => setPhotoToRemove({ kind: "pending", key: item.key })} className="p-1"><Ionicons name="close" size={17} color="#ba1a1a" /></Pressable></View>}
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
        <View className="mb-4 flex-row items-center justify-between rounded-[16px] bg-card p-4"><View className="min-w-0 flex-1 pr-3"><Text className="text-sm font-bold text-foreground">Disponível para venda</Text><Text className="mt-1 text-xs text-muted-foreground">Ative para exibir o produto no catálogo da loja</Text></View><Switch accessibilityLabel="Disponível para venda" value={form.active} onValueChange={(value) => change("active", value)} trackColor={{ false: "#e4d7d9", true: "#f0b9bd" }} thumbColor={form.active ? "#b94b50" : "#f8f4f4"} ios_backgroundColor="#e4d7d9" /></View>
      </View>
    </ScrollView>
    <View className="border-t border-[#f1e5e7] bg-[#fbf6f7] p-4"><Pressable accessibilityRole="button" accessibilityLabel="Salvar produto" disabled={saving || busyGallery || pending.some((item) => item.uploading)} onPress={() => void save()} className={`min-h-[52px] flex-row items-center justify-center gap-2 rounded-[16px] ${saving ? "bg-[#d48b8e]" : "bg-primary"}`}>
      {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={21} color="#fff" />}<Text className="text-base font-semibold text-white">{saving ? "Salvando dados..." : "Salvar Produto"}</Text>
    </Pressable>
    </View>
    <Modal visible={Boolean(photoToRemove)} transparent animationType="fade" onRequestClose={() => setPhotoToRemove(null)}><View className="flex-1 justify-center bg-black/40 px-6"><View className="rounded-[22px] bg-card p-6">
      <Text className="text-xl font-semibold text-foreground">Apagar foto?</Text><Text className="mt-2 text-sm text-muted-foreground">Essa foto será removida do produto. Deseja continuar?</Text>
      <View className="mt-6 flex-row gap-3"><Pressable accessibilityRole="button" accessibilityLabel="Cancelar remoção" onPress={() => setPhotoToRemove(null)} className="min-h-11 flex-1 items-center justify-center rounded-full bg-[#f7ecee]"><Text className="font-semibold text-foreground">Cancelar</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Confirmar remoção da foto" onPress={() => void confirmRemovePhoto()} className="min-h-11 flex-1 items-center justify-center rounded-full bg-primary"><Text className="font-semibold text-white">Apagar foto</Text></Pressable></View>
    </View></View></Modal>
    <ProductImageViewer uri={viewImage} onClose={() => setViewImage(null)} />
    <Modal visible={confirmExit} transparent animationType="fade" onRequestClose={() => setConfirmExit(false)}><View className="flex-1 justify-center bg-black/40 px-6"><View className="rounded-[22px] bg-card p-6">
      <Text className="text-xl font-semibold text-foreground">Sair da edição?</Text><Text className="mt-2 text-sm leading-5 text-muted-foreground">Você alterou este produto. Campos não salvos serão perdidos; alterações nas fotos já aplicadas permanecem.</Text>
      <View className="mt-6 flex-row gap-3"><Pressable accessibilityRole="button" accessibilityLabel="Continuar editando" onPress={() => setConfirmExit(false)} className="min-h-11 flex-1 items-center justify-center rounded-full bg-[#f7ecee]"><Text className="font-semibold text-foreground">Continuar</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Confirmar saída da edição" onPress={() => { setConfirmExit(false); onBack(); }} className="min-h-11 flex-1 items-center justify-center rounded-full bg-primary"><Text className="font-semibold text-white">Sair</Text></Pressable></View>
    </View></View></Modal>
    <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => { if (!saving) setConfirmDelete(false); }}><View className="flex-1 justify-center bg-black/40 px-6"><View className="rounded-[22px] bg-card p-6">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-[#ffdad6]"><Ionicons name="trash-outline" size={25} color="#ba1a1a" /></View>
      <Text className="mt-4 text-xl font-semibold text-foreground">Excluir produto?</Text><Text className="mt-2 text-sm leading-5 text-muted-foreground">{product?.name} sairá do catálogo padrão e ficará em Arquivados, de onde poderá ser restaurado. Alterações não salvas serão descartadas.</Text>
      {deleteError ? <Text accessibilityRole="alert" className="mt-3 text-sm text-[#ba1a1a]">{deleteError}</Text> : null}
      <View className="mt-6 flex-row gap-3"><Pressable accessibilityRole="button" accessibilityLabel="Cancelar exclusão" disabled={saving} onPress={() => setConfirmDelete(false)} className="min-h-11 flex-1 items-center justify-center rounded-full bg-[#f7ecee]"><Text className="font-semibold text-foreground">Cancelar</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Confirmar exclusão do produto" disabled={saving} onPress={() => void deleteProduct()} className="min-h-11 flex-1 items-center justify-center rounded-full bg-[#ba1a1a]"><Text className="font-semibold text-white">{saving ? "Excluindo..." : "Excluir"}</Text></Pressable></View>
    </View></View></Modal>
  </KeyboardAvoidingView>;
}
