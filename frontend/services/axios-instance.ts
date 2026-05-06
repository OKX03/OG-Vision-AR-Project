import axios from 'axios';
import { userService } from './user.service';

const axiosInstance = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/api`,
});

axiosInstance.interceptors.request.use(
  (config) => {

    const token =userService.getToken();

    if (!token || !userService.hasValidToken()) {
      userService.logout();
      return Promise.reject("Token expired");
    }

    config.headers!["x-access-token"] = token;

    return config;
  },
  (error) => Promise.reject(error)
);

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