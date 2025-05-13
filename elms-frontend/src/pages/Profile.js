import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import apiClient from "../utils/apiClient";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Paper,
  Alert,
  Avatar,
  Grid,
  CircularProgress,
  Box,
  TextField,
  Button,
} from "@mui/material";
import { styled } from "@mui/system";
import Sidebar from "../components/Sidebar";

// Styled components
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: "#1976d2",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  zIndex: 1201, // Ensure AppBar is above Sidebar Drawer
  position: "fixed",
}));

const MainContent = styled(Box)(({ theme }) => ({
  marginTop: "64px", // Match AppBar height
  height: "calc(100vh - 64px)", // Full height minus AppBar
  width: "100%",
  overflow: "auto", // Handle overflow
  padding: theme.spacing(3),
  boxSizing: "border-box",
}));

const Profile = () => {
  const { token, logout, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: "",
    department: "",
    phoneNumber: "",
    profilePicture: "",
    chiefOfficerName: "",
    supervisorName: "",
    personNumber: "",
    email: "",
    sector: "",
    sectionalHeadName: "",
    departmentalHeadName: "",
    HRDirectorName: "",
  });
  const [message, setMessage] = useState({ type: "", text: "" });
  const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { addNotification } = useNotifications();
  const localToken = localStorage.getItem("token");
  const localUser = JSON.parse(localStorage.getItem("user") || "null");
  const effectiveToken = token || localToken;
  const effectiveUser = user || localUser;

  console.log("Profile rendering - Effective Token:", effectiveToken, "User:", effectiveUser);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!effectiveToken) {
        console.log("No effective token, redirecting to /login");
        navigate("/login");
        return;
      }
      setIsLoading(true);
      try {
        const res = await apiClient.get("/api/profiles", {
          headers: { Authorization: `Bearer ${effectiveToken}` },
        });
        console.log("Profile fetched:", res.data);
        setProfile(res.data);
      } catch (error) {
        const errorMessage = error.response
          ? `${error.response.status}: ${error.response.data.error || error.response.statusText}`
          : error.message;
        setMessage({ type: "error", text: `Failed to fetch profile: ${errorMessage}` });
        addNotification(`Failed to fetch profile: ${errorMessage}`, "error");
      
        if (error.response?.status === 401) {
          console.log("401 Unauthorized, logging out");
          logout();
          navigate("/login");
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [addNotification, effectiveToken, navigate, logout]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (!profile.name || !profile.department || !profile.email) {
      setMessage({ type: "error", text: "Name, department, and email are required" });
     
      return;
    }
    if (!effectiveToken) {
      console.log("No effective token on submit, redirecting to /login");
      navigate("/login");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.put(
        "/api/profiles",
        profile,
        { headers: { Authorization: `Bearer ${effectiveToken}` } }
      );
      setMessage({ type: "success", text: "Profile updated successfully" });
      setProfile(res.data.profile);
    } catch (error) {
      const errorMessage = error.response
        ? `${error.response.status}: ${error.response.data.error || error.response.statusText}`
        : error.message;
      setMessage({ type: "error", text: `Failed to update profile: ${errorMessage}` });
      addNotification(`Failed to update profile: ${errorMessage}`, "error");
      if (error.response?.status === 401) {
        console.log("401 Unauthorized on submit, logging out");
        logout();
        navigate("/login");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!effectiveToken) {
    console.log("Render guard: No effective token, redirecting");
    navigate("/login");
    return null;
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div>
      <StyledAppBar>
        <Toolbar>
          <Sidebar onLogout={logout} role={effectiveUser?.role || "Employee"} />
          <Typography
            variant="h6"
            sx={{
              flexGrow: 1,
              fontWeight: "bold",
              letterSpacing: 1,
              color: "#fff",
              ml: 2,
            }}
          >
            Employee Profile
          </Typography>
          <Typography variant="subtitle1" sx={{ color: "#fff", fontWeight: "medium" }}>
            {effectiveUser?.role || "Employee"}
          </Typography>
        </Toolbar>
      </StyledAppBar>

      <MainContent>
        <Paper elevation={3} sx={{ padding: 4, borderRadius: 2, boxShadow: 5, width: "100%" }}>
          
          {message.text && <Alert severity={message.type}>{message.text}</Alert>}
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
              <Avatar
                src={profile.profilePicture || ""}
                alt={profile.name}
                sx={{ width: 100, height: 100 }}
              />
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Full Name"
                  name="name"
                  value={profile.name || ""}
                  onChange={handleChange}
                  sx={{ mb: 2 }}
                  required
                  helperText="Your full name"
                  aria-label="Full Name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Department"
                  name="department"
                  value={profile.department || ""}
                  onChange={handleChange}
                  sx={{ mb: 2 }}
                  required
                  helperText="Your department"
                  aria-label="Department"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Phone Number"
                  name="phoneNumber"
                  value={profile.phoneNumber || ""}
                  onChange={handleChange}
                  sx={{ mb: 2 }}
                  helperText="Your contact phone number (optional)"
                  aria-label="Phone Number"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Chief Officer Name"
                  name="chiefOfficerName"
                  value={profile.chiefOfficerName || ""}
                  onChange={handleChange}
                  sx={{ mb: 2 }}
                  helperText="Name of the Chief Officer (optional)"
                  aria-label="Chief Officer Name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Supervisor Name"
                  name="supervisorName"
                  value={profile.supervisorName || ""}
                  onChange={handleChange}
                  sx={{ mb: 2 }}
                  helperText="Your supervisor's name (optional)"
                  aria-label="Supervisor Name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Person Number"
                  name="personNumber"
                  value={profile.personNumber || ""}
                  onChange={handleChange}
                  sx={{ mb: 2 }}
                  helperText="Your personnel number (optional)"
                  aria-label="Person Number"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  value={profile.email || ""}
                  onChange={handleChange}
                  sx={{ mb: 2 }}
                  required
                  helperText="Your email address"
                  aria-label="Email"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Sector"
                  name="sector"
                  value={profile.sector || ""}
                  onChange={handleChange}
                  sx={{ mb: 2 }}
                  helperText="Your sector (optional)"
                  aria-label="Sector"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Profile Picture URL"
                  name="profilePicture"
                  value={profile.profilePicture || ""}
                  onChange={handleChange}
                  sx={{ mb: 2 }}
                  helperText="URL to your profile picture (optional)"
                  aria-label="Profile Picture URL"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Sectional Head Name"
                  name="sectionalHeadName"
                  value={profile.sectionalHeadName || ""}
                  onChange={handleChange}
                  sx={{ mb: 2 }}
                  helperText="Sectional Head’s name (optional)"
                  aria-label="Sectional Head Name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Departmental Head Name"
                  name="departmentalHeadName"
                  value={profile.departmentalHeadName || ""}
                  onChange={handleChange}
                  sx={{ mb: 2 }}
                  helperText="Departmental Head’s name (optional)"
                  aria-label="Departmental Head Name"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="HR Director Name"
                  name="HRDirectorName"
                  value={profile.HRDirectorName || ""}
                  onChange={handleChange}
                  sx={{ mb: 2 }}
                  helperText="HR Director’s name (optional)"
                  aria-label="HR Director Name"
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                  sx={{ mt: 2, borderRadius: 2, padding: "8px 24px" }}
                  disabled={submitting}
                  aria-label="Update Profile"
                >
                  {submitting ? "Updating..." : "Update Profile"}
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>
      </MainContent>
    </div>
  );
};

export default Profile;