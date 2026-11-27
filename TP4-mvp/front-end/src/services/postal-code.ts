import { digits } from "./store-form";

export async function lookupPostalCode(value: string) {
  const cep = digits(value);
  if (cep.length !== 8) throw new Error("Informe um CEP com 8 dígitos.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal });
    if (!response.ok) throw new Error("Não foi possível consultar o CEP. Preencha o endereço manualmente.");
    const data = await response.json();
    if (data.erro) throw new Error("CEP não encontrado. Confira o número ou preencha manualmente.");
    return { street: String(data.logradouro ?? ""), neighborhood: String(data.bairro ?? ""), city: String(data.localidade ?? ""), state: String(data.uf ?? "") };
  } finally { clearTimeout(timer); }
}
