import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from"../utils/apiClient";
import { TextField, Button, Typography, Container, Paper, } from "@mui/material";

const Register = () => {
  const [userData, setUserData] = useState({ name: "", email: "", password: "", department: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setUserData({ ...userData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      await apiClient.post("/api/auth/register",{...userData, role: "Employee"});
      navigate("/login");
    } catch (error) {
      setError(error.response?.data?.message || "Registration failed");
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={3} sx={{ padding: 4, textAlign: "center", marginTop: 8 }}>
        <Typography variant="h5" gutterBottom>
          Register
        </Typography>
        {error && <Typography color="error">{error}</Typography>}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Full Name"
            name="name"
            value={userData.name}
            onChange={handleChange}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            name="email"
            value={userData.email}
            onChange={handleChange}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            name="password"
            value={userData.password}
            onChange={handleChange}
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="Department"
            name="department"
            value={userData.department}
            onChange={handleChange}
            margin="normal"
          />
          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ marginTop: 2 }}>
            Register
          </Button>
        </form>
      </Paper>
    </Container>
  );
};


export default Register;
