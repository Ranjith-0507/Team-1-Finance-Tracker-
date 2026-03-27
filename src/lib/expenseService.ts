import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  getDoc,
  setDoc,
  getDocFromServer
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { geminiService } from './geminiService';

export interface Expense {
  id: string;
  uid: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  type: 'expense' | 'income';
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  gender?: 'male' | 'female' | 'other';
  role: 'admin' | 'driver' | 'customer';
  initialBalance: number;
  monthlyBudget?: number;
  categoryBudgets?: Record<string, number>;
}

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

type OperationType = typeof OperationType[keyof typeof OperationType];

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const expenseService = {
  async testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    }
  },

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, path);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  },

  async saveUserProfile(profile: UserProfile) {
    const path = `users/${profile.uid}`;
    try {
      await setDoc(doc(db, path), profile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async updateUserProfile(uid: string, profile: Partial<UserProfile>) {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, path), profile);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  subscribeToProfile(uid: string, callback: (profile: UserProfile | null) => void) {
    const path = `users/${uid}`;
    return onSnapshot(doc(db, path), (snapshot) => {
      callback(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  subscribeToExpenses(uid: string, callback: (expenses: Expense[]) => void) {
    const path = 'expenses';
    const q = query(
      collection(db, path),
      where('uid', '==', uid),
      orderBy('date', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const expenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      callback(expenses);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  subscribeToAllExpenses(callback: (expenses: Expense[]) => void) {
    const path = 'expenses';
    const q = query(
      collection(db, path),
      orderBy('date', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const expenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      callback(expenses);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  subscribeToAllUsers(callback: (users: UserProfile[]) => void) {
    const path = 'users';
    return onSnapshot(collection(db, path), (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        ...doc.data()
      })) as UserProfile[];
      callback(users);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  async addExpense(expense: Omit<Expense, 'id'>) {
    const path = 'expenses';
    try {
      await addDoc(collection(db, path), expense);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateExpense(id: string, expense: Partial<Expense>) {
    const path = `expenses/${id}`;
    try {
      await updateDoc(doc(db, path), expense);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteExpense(id: string) {
    const path = `expenses/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async getFinancialInsights(expenses: Expense[], profile: UserProfile | null) {
    const prompt = `Analyze the following financial data for the user. 
    Expenses: ${JSON.stringify(expenses.map(e => ({ title: e.title, amount: e.amount, category: e.category, type: e.type, date: e.date })))}
    User Profile: ${JSON.stringify(profile)}
    
    Provide 3-4 concise, actionable financial insights or tips based on their spending habits. 
    Format the response as a JSON array of strings.`;

    try {
      const response = await geminiService.getInsights(prompt);
      return response;
    } catch (error) {
      console.error("Failed to get insights", error);
      return ["Keep tracking your expenses to see patterns!", "Try setting a budget for your top categories.", "Review your recurring bills to find savings."];
    }
  }
};
