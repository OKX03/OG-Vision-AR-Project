import { jwtDecode } from "jwt-decode";
import { storageService } from "./storage.service";
import axiosInstance from "./axios-instance";
import axios from "axios";

const authAxios = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/api/users/`,
});

const BASE_URL = '/users';

let logoutTimer: any = null;

interface DecodedToken {
  exp: number;
}

export const userService = {

  // Retrieves the current user's authentication token from local storage.
  getToken(): string | null {
    const user = storageService.getUser();
    return user?.accessToken || null;
  },

  // Retrieves the current user's role from local storage.
  getRole(): string | null {
    const user = storageService.getUser();
    return user?.roles || null;
  },

  // Checks whether the current user has a specific role.
  hasRole(role: string): boolean {
    const userRole = this.getRole();
    return userRole === role;
  },

  // Checks if a valid, unexpired token exists in local storage.
  hasValidToken(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp > currentTime;
    } catch {
      return false;
    }
  },

  // Authenticates a user with the given credentials.
  async login(username: string, password: string) {
    const res = await authAxios.post("login", {
      username,
      password,
    });

    const data = res.data;

    if (data.accessToken) {
      storageService.saveUser(data);
      this.setAutoLogout();
    }

    return data;
  },

  // Registers a new user account.
  async register(username: string, email: string, password: string, gender: string) {
    console.log("Registering user:", { username, email, password, gender });
    const res = await authAxios.post("register", {
      username,
      email,
      password,
      gender
    });

    console.log("Registration response status:", res.status);
    return res.data;
  },

  // Verifies the user's email using a token sent to their inbox.
  async verifyEmail(email: string, token: string) {
    const res = await authAxios.get(`verify-email?email=${encodeURIComponent(email)}&token=${token}`);
    return res.data;
  },

  // Requests a new email verification link.
  async resendVerificationEmail(email: string) {
    const res = await authAxios.post("resend-verification", { email });
    return res.data;
  },

  // Logs out the current user, clearing local session data and ending any active chatbot sessions.
  async logout() {
    this.clearLogoutTimer();

    if (typeof window !== "undefined") {
      const activeSession = sessionStorage.getItem('og_chat_session');
      if (activeSession) {
        const token = this.getToken();
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
        if (token) {
          fetch(`${baseUrl}/api/chatbot/session/${activeSession}/end`, {
            method: 'PUT',
            headers: { 'x-access-token': token },
            keepalive: true
          }).catch(() => {});
        }
        sessionStorage.removeItem('og_chat_session');
      }
    }

    try {
      await authAxios.post("logout");
    } catch {}

    storageService.clean();

    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
  },

  // Requests a password recovery email.
  async recoverPassword(email: string) {
    const res = await authAxios.post("recover-password", { email });
    return res.data;
  },

  // Resets the user's password using a valid recovery token.
  async resetPassword(email: string, token: string, password: string) {
    try {
      const res = await authAxios.post("reset-password", {
        email,
        token,
        password
      });
      return res.data;
    } catch (err: any) {
      throw new Error(
        err.response?.data?.message || "Failed to reset password"
      );
    }
  },

  // Fetches the profile data for the currently authenticated user.
  getProfile() {
    return axiosInstance.get(`${BASE_URL}/profile`);
  },

  // Updates the profile information of the currently authenticated user.
  updateProfile(username: string, gender: string, phone_number: string, face_shape?: string) {
    return axiosInstance.put(`${BASE_URL}/profile`, { username, gender, phone_number, face_shape });
  },

  // Fetches the current account status for the authenticated user.
  getUserStatus() {
    return axiosInstance.get(`${BASE_URL}/status`);
  },

  // Calculates the time remaining on the user's JWT token and sets an automatic logout timer.
  setAutoLogout() {
    const token = this.getToken();
    if (!token) return;

    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const currentTime = Math.floor(Date.now() / 1000);
      const expiresIn = (decoded.exp - currentTime) * 1000;

      console.log("Token expires in (ms):", expiresIn);

      if (expiresIn > 0) {
        this.clearLogoutTimer();

        logoutTimer = setTimeout(() => {
          alert("Your session has expired. Please log in again.");
          this.logout();
        }, expiresIn);
        
        console.log("Auto-logout timer set for (ms):", expiresIn);
      }
    } catch (err) {
      console.error("Token decode failed", err);
      this.logout();
    }
  },

  // Clears any active automatic logout timer.
  clearLogoutTimer() {
    console.log("Clearing logout timer");
    if (logoutTimer) {
      clearTimeout(logoutTimer);
      logoutTimer = null;
    }
  }

};