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

  getToken(): string | null {
    const user = storageService.getUser();
    return user?.accessToken || null;
  },

  getRole(): string | null {
    const user = storageService.getUser();
    return user?.roles || null;
  },

  hasRole(role: string): boolean {
    const userRole = this.getRole();
    return userRole === role;
  },

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

  async verifyEmail(email: string, token: string) {
    const res = await authAxios.get(`verify-email?email=${encodeURIComponent(email)}&token=${token}`);
    return res.data;
  },

  async resendVerificationEmail(email: string) {
    const res = await authAxios.post("resend-verification", { email });
    return res.data;
  },

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

  async recoverPassword(email: string) {
    const res = await authAxios.post("recover-password", { email });
    return res.data;
  },

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

  getProfile() {
    return axiosInstance.get(`${BASE_URL}/profile`);
  },

  updateProfile(username: string, gender: string) {
    return axiosInstance.put(`${BASE_URL}/profile`, { username, gender });
  },

  getUserStatus() {
    return axiosInstance.get(`${BASE_URL}/status`);
  },

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

  clearLogoutTimer() {
    console.log("Clearing logout timer");
    if (logoutTimer) {
      clearTimeout(logoutTimer);
      logoutTimer = null;
    }
  }

};