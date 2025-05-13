// components/AdminLogin.js
import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/apiClient";
import { AuthContext } from "../context/AuthContext";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password || !adminPassword) {
      setError("All fields are required for admin login");
      setLoading(false);
      return;
    }

    try {
      const res = await apiClient.post("/api/auth/admin/login", { email, password, adminPassword });
      const { token, user } = res.data;

      if (user.role !== "Admin") {
        setError("This endpoint is for admin users only");
        setLoading(false);
        return;
      }

      login(token, user)

      console.log("Admin login successful:", res.data);
      navigate("/super-admin-dashboard");
    } catch (err) {
      console.error("Admin login error:", err);
      setError(err.response?.data?.error || "Failed to login as admin");
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-center">Admin Login</h2>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded"
              required
              disabled={loading}
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded"
              required
              disabled={loading}
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700">Admin Password</label>
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full p-2 border rounded"
              required
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className={`w-full p-2 rounded text-white ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500"}`}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;