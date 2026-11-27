import { useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import { ApiError, api, resolveImageUrl } from "../../services/api";
import { lookupPostalCode } from "../../services/postal-code";
import { pickStoreImage, type StoreImageFile, type StoreImageKind } from "../../services/store-logo";
import { emptyStoreForm, pendingLabels, resumeStore, storePayload, validateStore, type StoreErrors, type StoreForm, type StoreProfile } from "../../services/store-form";

export function useStoreForm(registration = false) {
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [form, setForm] = useState<StoreForm>(emptyStoreForm);
  const [saved, setSaved] = useState(JSON.stringify(emptyStoreForm()));
  const [exists, setExists] = useState(false);
  const [status, setStatus] = useState("DRAFT");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorSource, setErrorSource] = useState<"save" | StoreImageKind>("save");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [errors, setErrors] = useState<StoreErrors>({});
  const [pending, setPending] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [images, setImages] = useState<Partial<Record<StoreImageKind, StoreImageFile>>>({});
  const dirty = JSON.stringify(form) !== saved || !!images.cover || !!images.background;

  useEffect(() => {
    let current = true;
    setLoading(true); setLoadError(null);
    async function load() {
      let foundStore = false;
      try {
        const store = await api.myStore();
        foundStore = true;
        if (!current) return;
        setProfile(store);
        const restored = resumeStore(store);
        setForm(restored); setSaved(JSON.stringify(restored)); setExists(true); setStatus(store.status);
        if (store.status !== "ACTIVE") {
          const decision = await api.storeActivationReadiness();
          if (current) { setPending(decision.pending); setReady(decision.allowed && !decision.pending.length); }
        }
      } catch (cause) {
        if (!current) return;
        if (!foundStore && cause instanceof ApiError && cause.status === 404) {
          const empty = emptyStoreForm();
          setForm(empty); setSaved(JSON.stringify(empty)); setExists(false); setReady(false);
        } else setLoadError(cause instanceof ApiError ? cause.message : "Não foi possível carregar a loja.");
      } finally { if (current) setLoading(false); }
    }
    void load();
    return () => { current = false; };
  }, [loadAttempt]);

  function leave(action: () => void) {
    if (busy) return;
    if (!dirty) { action(); return; }
    if (Platform.OS === "web") {
      if (globalThis.confirm("Há alterações não salvas. Deseja descartá-las e sair?")) action();
      return;
    }
    Alert.alert("Alterações não salvas", "Conclua ou salve suas alterações antes de sair. Deseja descartá-las?", [
      { text: "Continuar editando", style: "cancel" },
      { text: "Descartar alterações", style: "destructive", onPress: action },
    ]);
  }

  function change(update: (value: StoreForm) => StoreForm) {
    setForm(update); setErrors({}); setError(null); setSuccess(null); setReady(false);
  }
  function showApiError(cause: unknown) {
    setError(cause instanceof ApiError ? cause.message : "Não foi possível salvar a loja.");
    if (cause instanceof ApiError && cause.details?.pending?.length) {
      setPending(cause.details.pending); setReady(false);
      const fields: StoreErrors = {};
      for (const code of cause.details.pending) {
        const key = code.startsWith("CNPJ") ? "cnpj" : code.startsWith("PHONE") ? "phone" : code === "STORE_NAME_REQUIRED" ? "name" : code === "ADDRESS_REQUIRED" ? "address.street" : "openingHours";
        fields[key] = pendingLabels[code] ?? code;
      }
      setErrors(fields);
      const first = Object.keys(fields)[0];
      setStep(first.startsWith("address.") ? 1 : first === "phone" || first === "openingHours" ? 2 : 0);
    }
  }
  async function save(requireComplete = false) {
    if (busy) return;
    setErrorSource("save");
    const invalid = validateStore(form, true);
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      const first = Object.keys(invalid)[0];
      setStep(first.startsWith("address.") ? 1 : first === "phone" || first === "whatsapp" || first === "openingHours" || first.includes("Time") ? 2 : 0);
      setError("Revise os campos indicados antes de salvar."); return;
    }
    setBusy(true); setError(null); setSuccess(null); setReady(false);
    try {
      const store = await api.saveMyStore(storePayload(form));
      setProfile(store);
      const restored = resumeStore(store);
      setForm(restored); setSaved(JSON.stringify(restored)); setExists(true); setStatus(store.status);

      for (const kind of ["cover", "background"] as const) {
        const image = images[kind];
        if (!image) continue;
        // Keep unsuccessful selections available for retry, without resending
        // images already persisted in this attempt.
        const updated = await api.uploadStoreImage(kind, image);
        setProfile(updated);
        setImages((old) => { const next = { ...old }; delete next[kind]; return next; });
      }

      if (store.status !== "ACTIVE") {
        const decision = await api.storeActivationReadiness();
        setPending(decision.pending); setReady(decision.allowed && !decision.pending.length);
        if ((registration || requireComplete) && (!decision.allowed || decision.pending.length)) {
          showApiError(new ApiError("Corrija os campos indicados para concluir o cadastro.", 400, { pending: decision.pending }));
          return false;
        }
      }
      setSuccess(registration ? "Cadastro da loja concluído com sucesso." : "Dados da loja salvos com sucesso.");
      return true;
    } catch (cause) { showApiError(cause); return false; }
    finally { setBusy(false); }
  }
  async function activate() {
    if (busy || dirty || !ready || pending.length || status === "ACTIVE") return;
    setErrorSource("save");
    setBusy(true); setError(null);
    try {
      const store = await api.changeMyStoreStatus("ACTIVE");
      setProfile(store); setStatus(store.status); setReady(false); setSuccess("Loja ativada com sucesso."); return true;
    } catch (cause) { setReady(false); showApiError(cause); }
    finally { setBusy(false); }
  }
  async function searchCep() {
    if (busy) return;
    setBusy(true); setError(null); setSuccess(null);
    try {
      const address = await lookupPostalCode(form.address.zipCode);
      change((old) => ({ ...old, address: { ...old.address, ...address } }));
      setSuccess("Endereço encontrado. Confira os dados e informe o número.");
    } catch (cause) {
      setErrors((old) => ({ ...old, "address.zipCode": cause instanceof Error ? cause.message : "Consulta indisponível. Preencha manualmente." }));
    } finally { setBusy(false); }
  }
  async function selectImage(kind: StoreImageKind) {
    if (busy) return;
    setErrorSource(kind);
    setBusy(true); setError(null); setSuccess(null);
    try {
      const image = await pickStoreImage(kind);
      if (image) setImages((old) => ({ ...old, [kind]: image }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível selecionar a imagem."); }
    finally { setBusy(false); }
  }
  return { registration, validationErrors: validateStore(form, true), profile, form, exists, status, step, setStep, loading, busy, loadError, error, success,
    errors, pending, ready, dirty, change, save, activate, leave, searchCep, selectImage,
    coverUri: images.cover?.uri ?? resolveImageUrl(profile?.logoUrl),
    backgroundUri: images.background?.uri ?? resolveImageUrl(profile?.backgroundUrl),
    retryError: () => errorSource === "save" ? save() : selectImage(errorSource),
    retryErrorLabel: errorSource === "save" ? "Tentar salvar novamente" : "Tentar selecionar imagem novamente",
    retryLoad: () => setLoadAttempt((value) => value + 1) };
}
