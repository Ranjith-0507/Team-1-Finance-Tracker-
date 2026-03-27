import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import { expenseService, UserProfile } from './expenseService';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (user) {
        // Subscribe to user profile changes
        profileUnsubscribe = expenseService.subscribeToProfile(user.uid, async (userProfile) => {
          // Auto-upgrade specific user to admin
          if (user.email === 'ranjithkumarmanickam05@gmail.com' && userProfile?.role !== 'admin') {
            try {
              await expenseService.saveUserProfile({
                ...userProfile,
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || userProfile?.displayName || '',
                role: 'admin'
              });
            } catch (error) {
              console.error("Failed to auto-upgrade to admin:", error);
            }
          }
          setProfile(userProfile);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
