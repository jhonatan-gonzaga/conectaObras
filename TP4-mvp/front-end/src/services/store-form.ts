export const storeDays = [
  ["MONDAY", "Segunda-feira"], ["TUESDAY", "Terça-feira"],
  ["WEDNESDAY", "Quarta-feira"], ["THURSDAY", "Quinta-feira"],
  ["FRIDAY", "Sexta-feira"], ["SATURDAY", "Sábado"], ["SUNDAY", "Domingo"],
] as const;
export type StoreDay = (typeof storeDays)[number][0];
export type StoreHour = { dayOfWeek: StoreDay; closed: boolean; openingTime: string | null; closingTime: string | null };
export type StoreAddress = { street: string; number: string; neighborhood: string; city: string; state: string; zipCode: string; complement: string };
export type StoreProfile = {
  id: string; name: string | null; status: string; logoUrl?: string | null;
  cnpj?: string | null; phone?: string | null; whatsapp?: string | null; description?: string | null;
  address?: Partial<Record<keyof StoreAddress, string | null>> | null;
  openingHours?: StoreHour[];
};
export type StoreForm = {
  name: string; cnpj: string; phone: string; whatsapp: string; description: string;
  address: StoreAddress; openingHours: StoreHour[];
};
export type StoreErrors = Record<string, string>;
export const storeFieldLabels: Record<string, string> = {
  name: "Nome da loja", cnpj: "CNPJ", phone: "Telefone", whatsapp: "WhatsApp", description: "Descrição",
  "address.street": "Rua", "address.number": "Número", "address.neighborhood": "Bairro",
  "address.city": "Cidade", "address.state": "UF", "address.zipCode": "CEP", openingHours: "Horários",
};
export function storeFieldLabel(key: string) {
  if (storeFieldLabels[key]) return storeFieldLabels[key];
  const [day, field] = key.split(".");
  return `${storeDays.find(([value]) => value === day)?.[1] ?? day}: ${field === "openingTime" ? "abertura" : "fechamento"}`;
}
export const digits = (value: string) => value.replace(/\D/g, "");
export function nationalPhone(value: string) {
  const raw = digits(value);
  return raw.startsWith("55") && raw.length > 11 ? raw.slice(2) : raw;
}
export function maskCnpj(value: string) {
  return digits(value).slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2}\.\d{3})(\d)/, "$1.$2")
    .replace(/(\.\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}
export function maskPhone(value: string) {
  const raw = nationalPhone(value).slice(0, 11);
  return raw.replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(raw.length > 10 ? /(\d{5})(\d)/ : /(\d{4})(\d)/, "$1-$2");
}
export const maskCep = (value: string) => digits(value).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
export function emptyStoreForm(): StoreForm {
  return {
    name: "", cnpj: "", phone: "", whatsapp: "", description: "",
    address: { street: "", number: "", neighborhood: "", city: "", state: "", zipCode: "", complement: "" },
    openingHours: storeDays.map(([dayOfWeek]) => ({ dayOfWeek, closed: true, openingTime: null, closingTime: null })),
  };
}
export function resumeStore(store: StoreProfile): StoreForm {
  const form = emptyStoreForm();
  for (const key of ["name", "cnpj", "phone", "whatsapp", "description"] as const) form[key] = store[key] ?? "";
  form.cnpj = maskCnpj(form.cnpj); form.phone = maskPhone(form.phone); form.whatsapp = maskPhone(form.whatsapp);
  for (const key of Object.keys(form.address) as (keyof StoreAddress)[]) form.address[key] = store.address?.[key] ?? "";
  form.address.zipCode = maskCep(form.address.zipCode);
  form.openingHours = form.openingHours.map((day) => {
    const saved = store.openingHours?.find((hour) => hour.dayOfWeek === day.dayOfWeek);
    return saved ? { ...saved, openingTime: saved.closed ? null : saved.openingTime, closingTime: saved.closed ? null : saved.closingTime } : day;
  });
  return form;
}
export function storePayload(form: StoreForm) {
  return {
    name: form.name.trim(), cnpj: digits(form.cnpj),
    phone: form.phone ? `+55${nationalPhone(form.phone)}` : "",
    whatsapp: form.whatsapp ? `+55${nationalPhone(form.whatsapp)}` : "",
    description: form.description.trim(),
    address: { ...Object.fromEntries(Object.entries(form.address).map(([key, value]) => [key, value.trim()])), state: form.address.state.trim().toUpperCase(), zipCode: digits(form.address.zipCode) },
    openingHours: form.openingHours.map((hour) => ({
      dayOfWeek: hour.dayOfWeek, closed: hour.closed,
      openingTime: hour.closed ? null : hour.openingTime,
      closingTime: hour.closed ? null : hour.closingTime,
    })),
  };
}
function validCnpj(value: string) {
  const raw = digits(value);
  if (!/^\d{14}$/.test(raw) || /^(\d)\1{13}$/.test(raw)) return false;
  const check = (base: string, weights: number[]) => {
    const rest = [...base].reduce((sum, digit, i) => sum + Number(digit) * weights[i], 0) % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = check(raw.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return raw === raw.slice(0, 12) + first + check(raw.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
}
export function validateStore(form: StoreForm, activation = false): StoreErrors {
  const errors: StoreErrors = {};
  if ((activation || form.name) && (form.name.trim().length < 2 || form.name.length > 120)) errors.name = "Informe um nome entre 2 e 120 caracteres.";
  if ((activation || form.cnpj) && !validCnpj(form.cnpj)) errors.cnpj = "Informe um CNPJ válido.";
  for (const key of ["phone", "whatsapp"] as const) {
    if ((key === "phone" && activation || form[key]) && !/^[1-9]\d(?:9\d{8}|[2-5]\d{7})$/.test(nationalPhone(form[key]))) errors[key] = "Informe DDD e telefone válido.";
  }
  if (form.description.length > 1000) errors.description = "Use até 1000 caracteres.";
  for (const key of ["street", "number", "neighborhood", "city", "state", "zipCode"] as const) {
    if (activation && !form.address[key].trim()) errors[`address.${key}`] = "Preencha este campo para ativar.";
  }
  if (form.address.zipCode && digits(form.address.zipCode).length !== 8) errors["address.zipCode"] = "Informe um CEP com 8 dígitos.";
  if (form.address.state && !/^[A-Za-z]{2}$/.test(form.address.state)) errors["address.state"] = "Informe a UF com duas letras.";
  for (const hour of form.openingHours) {
    if (hour.closed) continue;
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!time.test(hour.openingTime ?? "")) errors[`${hour.dayOfWeek}.openingTime`] = "Informe abertura em HH:mm.";
    if (!time.test(hour.closingTime ?? "")) errors[`${hour.dayOfWeek}.closingTime`] = "Informe fechamento em HH:mm.";
    else if (hour.openingTime && hour.closingTime! <= hour.openingTime) errors[`${hour.dayOfWeek}.closingTime`] = "Fechamento deve ser posterior à abertura.";
  }
  if (activation && !form.openingHours.some((hour) => !hour.closed)) errors.openingHours = "Informe ao menos um dia aberto.";
  return errors;
}
export function isStoreRegistrationComplete(store: StoreProfile) {
  return Object.keys(validateStore(resumeStore(store), true)).length === 0;
}
export const pendingLabels: Record<string, string> = {
  STORE_NAME_REQUIRED: "Nome da loja obrigatório", CNPJ_REQUIRED: "CNPJ obrigatório", CNPJ_INVALID: "CNPJ inválido",
  PHONE_REQUIRED: "Telefone obrigatório", PHONE_INVALID: "Telefone inválido", ADDRESS_REQUIRED: "Complete o endereço",
  BUSINESS_HOURS_REQUIRED: "Informe os horários", BUSINESS_OPEN_DAY_REQUIRED: "Informe ao menos um dia aberto",
  BUSINESS_HOURS_REQUIRED_FOR_OPEN_DAY: "Complete os horários dos dias abertos", BUSINESS_HOURS_INVALID: "Corrija os horários",
  CLOSING_TIME_MUST_FOLLOW_OPENING_TIME: "Fechamento deve ser posterior à abertura", TRANSITION_NOT_ALLOWED: "Transição de status não permitida",
  BUSINESS_DAY_INVALID: "Dia da semana inválido", DUPLICATE_BUSINESS_DAY: "Dia da semana duplicado",
  BUSINESS_HOURS_NOT_ALLOWED_FOR_CLOSED_DAY: "Remova os horários dos dias fechados", OVERLAPPING_BUSINESS_HOURS: "Horários sobrepostos",
};
