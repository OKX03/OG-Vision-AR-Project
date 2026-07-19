import axios from 'axios';
import { userService } from './user.service';

// Configured Axios instance with base URL for the backend API.
const axiosInstance = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/api`,
});

// Request interceptor to automatically attach the user's JWT access token to every outgoing request.
axiosInstance.interceptors.request.use(
  (config) => {

    const token = userService.getToken();

    if (!token || !userService.hasValidToken()) {
      userService.logout();
      return Promise.reject("Token expired");
    }

    config.headers!["x-access-token"] = token;

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to catch 401 Unauthorized errors globally.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {

    if (error.response?.status === 401) {
      userService.logout();
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;