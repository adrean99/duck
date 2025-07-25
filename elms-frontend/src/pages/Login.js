import { useState, useContext, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { TextField, Button, Container, Typography, Paper, Checkbox, FormControlLabel, InputAdornment, CircularProgress } from "@mui/material";
import { Email as EmailIcon, Lock as LockIcon } from '@mui/icons-material';
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/apiClient";

const Login = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [authData, setAuthData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      console.log("Attempting login with", { email, password });
      const response = await apiClient.post("/api/auth/login", { email, password });
      const data = response.data;
      console.log("Login success:", data);
      login(data.token, data.user);
      setAuthData(data);
    } catch (error) {
      console.error("Login error", error);
      setError(error.response?.data?.message || "Server error. Please try again");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authData?.user?.role) {
      console.log("Login useEffect - Navigating with:", authData);
      if (["Admin", "Director", "DepartmentalHead", "HRDirector"].includes(authData.user.role)) {
        console.log("Navigating to /admin-dashboard");
        navigate("/admin-dashboard");
      } else {
        console.log("Navigating to /employee-dashboard");
        navigate("/employee-dashboard");
      }
    }
  }, [authData, navigate]);

  return (
    <Container maxWidth="md" className="flex items-center justify-center h-screen">
       <Paper className="p-10 shadow-lg">
        <img 
          src="/nyeri logo.jpg" 
          alt="Nyeri County Logo" 
          style={{ width: '100px', height: 'auto', margin: '0 auto 1rem', display: 'block' }} 
        />
        <div style={{ textAlign: 'center' }}>
          <Typography variant="h4" className="mb-4" style={{ marginBottom: '2rem' }}>
            Nyeri County Leave Management System
          </Typography>
        </div>


        {error && <Typography color="error">{error}</Typography>}
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField
            label="Email"
            fullWidth
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailIcon />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockIcon />
                </InputAdornment>
              ),
            }}
          />
          <FormControlLabel
            control={<Checkbox />}
            label="Remember me"
          />
           <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={24} color="inherit" /> : null}
            style={{ width: '50%', alignSelf: 'center' }}
          >
            {isLoading ? "Logging in..." : "Login"}
          </Button>
        </form>
      </Paper>
    </Container>
  );
};

export default Login;