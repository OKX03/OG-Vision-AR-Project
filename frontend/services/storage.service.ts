const USER_KEY = "auth-user";

export const storageService = {

  clean() {
    if (typeof window !== "undefined") {
      sessionStorage.clear();
    }
  },

  saveUser(user: any) {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },

  getUser() {
    if (typeof window !== "undefined") {
      const user = sessionStorage.getItem(USER_KEY);
      return user ? JSON.parse(user) : null;
    }
    return null;
  },

  isLoggedIn() {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(USER_KEY) !== null;
    }
    return false;
  }
};