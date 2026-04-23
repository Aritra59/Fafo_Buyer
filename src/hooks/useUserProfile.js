import { useEffect, useState } from "react";
import { subscribeUser } from "../services/userService";

/**
 * @param {import('firebase/auth').User | null} user
 */
export function useUserProfile(user) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(!!user);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    const unsub = subscribeUser(
      user.uid,
      (data) => {
        setProfile(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  return { profile, loading, error };
}
