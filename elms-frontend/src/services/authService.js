import apiClient from"../utils/apiClient";

const API_URL = process.env.REACT_APP_API_URL + "/auth";  // Ensure your backend URL is set in `.env`

// Register User
export const registerUser = async (userData) => {
  try {
    const response = await apiClient.post(`${API_URL}/register`, userData);
    console.log("Registration Success:", response.data);
    return response.data; // Ensure it returns data for further use
  } catch (error) {
    console.error("Registration Error:", error.response?.data || error.message);
    throw error; // Ensure errors are caught in the component
  }
};

// Login User
export const loginUser = async (userData) => {
  try {
    const response = await apiClient.post(`${API_URL}/login`, userData);
    console.log("Login Success:", response.data);

    console.log("User Data on Login:", response.data);
    return response.data; // Return data for further processing
  } catch (error) {
    console.error("Login Error:", error.response?.data || error.message);
    throw error;
  }
};
