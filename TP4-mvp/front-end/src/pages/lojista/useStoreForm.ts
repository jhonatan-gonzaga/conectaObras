import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { ApiError, api } from "../../services/api";
import { emptyStoreForm, pendingLabels, resumeStore, storePayload, validateStore, type StoreErrors, type StoreForm } from "../../services/store-form";

export function useStoreForm() {
  const [form, setForm] = useState<StoreForm>(emptyStoreForm);
  const [saved, setSaved] = useState(JSON.stringify(emptyStoreForm()));
  const [exists, setExists] = useState(false);
  const [status, setStatus] = useState("DRAFT");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [errors, setErrors] = useState<StoreErrors>({});
  const [pending, setPending] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const dirty = JSON.stringify(form) !== saved;

  useEffect(() => {
    let current = true;
    setLoading(true); setLoadError(null);
    async function load() {
      let foundStore = false;
      try {
        const store = await api.myStore();
        foundStore = true;
        if (!current) return;
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
    Alert.alert("Alterações não salvas", "Salve o rascunho antes de sair para retomar estas alterações depois.", [
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
      setPending(cause.details.pending); setReady(false); setStep(3);
      const fields: StoreErrors = {};
      for (const code of cause.details.pending) {
        const key = code.startsWith("CNPJ") ? "cnpj" : code.startsWith("PHONE") ? "phone" : code === "STORE_NAME_REQUIRED" ? "name" : code === "ADDRESS_REQUIRED" ? "address.street" : "openingHours";
        fields[key] = pendingLabels[code] ?? code;
      }
      setErrors(fields);
    }
  }
  async function save() {
    if (busy) return;
    const invalid = validateStore(form, status !== "DRAFT");
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      const first = Object.keys(invalid)[0];
      setStep(first.startsWith("address.") ? 1 : first === "openingHours" || first.includes("Time") ? 2 : 0);
      setError("Revise os campos indicados antes de salvar."); return;
    }
    setBusy(true); setError(null); setSuccess(null); setReady(false);
    try {
      const store = await api.saveMyStore(storePayload(form));
      const restored = resumeStore(store);
      setForm(restored); setSaved(JSON.stringify(restored)); setExists(true); setStatus(store.status);
      setSuccess(store.status === "DRAFT" ? "Rascunho salvo. Você pode retomar o cadastro depois." : "Dados da loja salvos com sucesso.");
      if (store.status !== "ACTIVE") {
        const decision = await api.storeActivationReadiness();
        setPending(decision.pending); setReady(decision.allowed && !decision.pending.length);
      }
    } catch (cause) { showApiError(cause); }
    finally { setBusy(false); }
  }
  async function activate() {
    if (busy || dirty || !ready || pending.length || status === "ACTIVE") return;
    setBusy(true); setError(null);
    try {
      const store = await api.changeMyStoreStatus("ACTIVE");
      setStatus(store.status); setReady(false); setSuccess("Loja ativada com sucesso.");
    } catch (cause) { setReady(false); showApiError(cause); }
    finally { setBusy(false); }
  }
  return { form, exists, status, step, setStep, loading, busy, loadError, error, success,
    errors, pending, ready, dirty, change, save, activate, leave,
    retryLoad: () => setLoadAttempt((value) => value + 1) };
}
