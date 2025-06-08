import axios from "axios";

const baseURL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001/api";

export const axiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});

// Add a request interceptor to include the auth token in every request
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // Or however you store your auth token
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
