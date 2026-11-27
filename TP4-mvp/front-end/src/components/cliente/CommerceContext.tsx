import { createContext, useContext, type ReactNode } from "react";
import { useCommerceCart, type CommerceCart } from "../../services/commerce-cart";
import type { CommerceTab } from "../../navigation/types";

type Commerce = { cart: CommerceCart; active: boolean; tab: CommerceTab; onNavigate: (tab: CommerceTab) => void };
const Context = createContext<Commerce | null>(null);
export function CommerceProvider({ userId, active, tab, onNavigate, children }: Omit<Commerce, "cart"> & { userId?: string; children: ReactNode }) {
  const cart = useCommerceCart(userId);
  return <Context.Provider value={{ cart, active, tab, onNavigate }}>{children}</Context.Provider>;
}
export const useCommerce = () => useContext(Context);
