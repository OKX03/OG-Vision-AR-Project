const USER_KEY = "auth-user";

export const storageService = {

  // Clears the current user's session data from sessionStorage.
  clean() {
    if (typeof window !== "undefined") {
      sessionStorage.clear();
    }
  },

  // Saves user authentication data (including tokens) to sessionStorage.
  saveUser(user: any) {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },

  // Retrieves the currently logged-in user's data from sessionStorage.
  getUser() {
    if (typeof window !== "undefined") {
      const user = sessionStorage.getItem(USER_KEY);
      return user ? JSON.parse(user) : null;
    }
    return null;
  },

  // Checks whether a user is currently logged in based on the presence of session data.
  isLoggedIn() {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(USER_KEY) !== null;
    }
    return false;
  }
};