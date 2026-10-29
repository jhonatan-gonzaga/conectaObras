import { useEffect, useRef, useState } from "react";
import { ApiError, api, type StoreOrder, type StoreOrderItemDetails } from "../../services/api";
import { ProductDetailsModal } from "../lojista/ProductDetailsModal";
import type { OrdersAudience } from "./use-orders";

export function OrderItemDetailsModal({ orderId, item, audience, onClose }: {
  orderId: string; item: StoreOrder["items"][number]; audience: OrdersAudience; onClose: () => void;
}) {
  const [details, setDetails] = useState<StoreOrderItemDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const closed = useRef(false);
  useEffect(() => {
    let current = true;
    setLoading(true); setDetails(null); setError(null);
    const request = audience === "owner" ? api.storeOrderItem : api.clientStoreOrderItem;
    request(orderId, item.id)
      .then((result) => { if (current && !closed.current) setDetails(result); })
      .catch((cause) => {
        if (current && !closed.current) setError(cause instanceof ApiError ? cause.message : "Não foi possível carregar o produto.");
      })
      .finally(() => { if (current && !closed.current) setLoading(false); });
    return () => { current = false; };
  }, [orderId, item.id, audience, attempt]);

  return <ProductDetailsModal visible product={details?.product ?? null} orderItem={details?.item ?? item}
    loading={loading} error={error} onRetry={() => setAttempt((value) => value + 1)}
    onClose={() => { closed.current = true; onClose(); }} />;
}
