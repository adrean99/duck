import { useContext, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { Button, Container, Typography, Paper } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    setUser(null);  // Clear user state
    localStorage.removeItem("token"); // Clear token
    navigate("/login"); // Redirect to login
  };

  useEffect(() => {
    if (!user) {
      // If no user, redirect to login
      navigate("/login");
  
    } else if (user?.role === "Employee") {
      navigate("/employee-dashboard");
    }
  }, [user, navigate]);

  return (
    <Container maxWidth="md" sx={{ mt: 10 }}>
      <Paper sx={{ p: 6, boxShadow: 3, textAlign: "center" }}>
        <Typography variant="h4">Welcome, {user?.name}!</Typography>
        <Typography variant="h6" sx={{ mb: 2 }}>Role: {user?.role}</Typography>

        {user?.role === "Admin" && <Typography>Admin Dashboard: Manage Users & Leaves</Typography>}
        
        {user?.role === "Employee" && <Typography>Employee Dashboard: Apply for Leave</Typography>}

        <Button component={Link} to="/leave-calendar" variant="contained" color="primary" sx={{ mt: 3, mr: 2 }}>
          Leave Calendar
        </Button>

        <Button variant="contained" color="secondary" sx={{ mt: 3 }} onClick={handleLogout}>
          Logout
        </Button>
      </Paper>
    </Container>
  );
};

export default Dashboard;
