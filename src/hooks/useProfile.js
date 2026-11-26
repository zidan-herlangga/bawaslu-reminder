import { useEffect, useState } from 'react';
import fetchProfile from '../lib/fetchProfile';

export default function useProfile(session) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(Boolean(session?.user));

  useEffect(() => {
    let active = true;

    if (!session?.user) {
      setProfile(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    fetchProfile(session)
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((error) => {
        console.error('[useProfile] gagal memuat profil:', error?.message);
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  return { profile, loading, setProfile };
}