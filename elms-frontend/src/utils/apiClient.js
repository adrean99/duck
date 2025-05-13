import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("Adding token to request:", token);
    } else {
      console.log("No token found in localStorage");
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;