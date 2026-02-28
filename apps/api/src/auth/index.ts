export type AuthContext = {
  userId: string | null;
  isGuest: boolean;
};

export const resolveAuthContext = (): AuthContext => {
  return {
    userId: null,
    isGuest: true
  };
};
