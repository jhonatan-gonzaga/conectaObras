import { useEffect, useRef, useState } from "react";

export function useCatalogDetail<T>(fetchDetail: (id: string) => Promise<T>, id: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ id: string; data: T | null; error: unknown; loading: boolean }>({ id, data: null, error: null, loading: true });
  const currentId = useRef(id);
  currentId.current = id;
  useEffect(() => {
    let current = true;
    setState({ id, data: null, error: null, loading: true });
    fetchDetail(id).then((data) => {
      if (current && currentId.current === id) setState({ id, data, error: null, loading: false });
    }).catch((error: unknown) => {
      if (current && currentId.current === id) setState({ id, data: null, error, loading: false });
    });
    return () => { current = false; };
  }, [id, attempt, fetchDetail]);
  return { ...(state.id === id ? state : { data: null, loading: true, error: null }), retry: () => setAttempt((value) => value + 1) };
}
