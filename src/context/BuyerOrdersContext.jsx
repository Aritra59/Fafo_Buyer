import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuthProfile } from "./AuthProfileContext";
import { subscribeBuyerOrders } from "../services/orderService";
import { triggerReadyNotification } from "../utils/orderNotifications";
import { normalizeIndiaPhone } from "../utils/format";
import { getGuestProfile } from "../utils/guestProfile";

const BuyerOrdersContext = createContext(null);

export function BuyerOrdersProvider({ children }) {
  const { user, profile, loading: authProfileLoading } = useAuthProfile();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const prevStatusByIdRef = useRef(new Map());
  const [guestVersion, setGuestVersion] = useState(0);

  useEffect(() => {
    const onGuest = () => setGuestVersion((n) => n + 1);
    window.addEventListener("fafo-guest-updated", onGuest);
    return () => window.removeEventListener("fafo-guest-updated", onGuest);
  }, []);

  const { buyerId, buyerPhone } = useMemo(() => {
    const uid = user?.uid || "";
    const rawAccount =
      user?.phoneNumber ||
      String(profile?.phone || "").trim() ||
      String(user?.providerData?.[0]?.phoneNumber || "");
    const accountPhone = normalizeIndiaPhone(rawAccount) || rawAccount.trim();
    const g = getGuestProfile();
    const guestPhone = g?.phone
      ? normalizeIndiaPhone(g.phone) || g.phone.trim()
      : "";
    return {
      buyerId: uid,
      buyerPhone: accountPhone || guestPhone,
    };
  }, [user, profile, guestVersion, authProfileLoading]);

  useEffect(() => {
    if (authProfileLoading) {
      return undefined;
    }

    if (!buyerId && !buyerPhone) {
      setOrders([]);
      setLoading(false);
      setError(null);
      prevStatusByIdRef.current = new Map();
      return undefined;
    }

    setLoading(true);
    const unsub = subscribeBuyerOrders(
      { buyerId, buyerPhone },
      (nextOrders) => {
        const prevMap = prevStatusByIdRef.current;

        nextOrders.forEach((order) => {
          const id = order.id;
          const status = String(order.status || "").toLowerCase();
          const prev = prevMap.get(id);
          if (
            status === "ready" &&
            prev !== undefined &&
            prev !== "ready"
          ) {
            triggerReadyNotification(order);
          }
          prevMap.set(id, status);
        });

        setOrders(nextOrders);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [buyerId, buyerPhone, authProfileLoading]);

  const value = useMemo(
    () => ({
      orders,
      loading,
      error,
    }),
    [orders, loading, error]
  );

  return (
    <BuyerOrdersContext.Provider value={value}>
      {children}
    </BuyerOrdersContext.Provider>
  );
}

export function useBuyerOrders() {
  const ctx = useContext(BuyerOrdersContext);
  if (!ctx) {
    throw new Error("useBuyerOrders must be used within BuyerOrdersProvider");
  }
  return ctx;
}
