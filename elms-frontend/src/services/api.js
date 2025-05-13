import apiClient from"../utils/apiClient";

const API_URL = process.env.REACT_APP_API_URL + "/auth";  // Dynamic API URL

export const registerUser = async (userData) => {
  return await apiCLient.post(`${API_URL}/register`, userData);
};

export const loginUser = async (userData) => {
  return await apiClient.post(`${API_URL}/login`, userData);
};
