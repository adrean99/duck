import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/apiClient";
import {
  Paper, Typography, TextField, MenuItem, Button, Alert, Box, Grid, AppBar, Toolbar, IconButton
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { styled } from "@mui/system";

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: "#1976d2",
  width: "100%",
  position: "fixed",
  top: 0,
  zIndex: 1201,
}));

const MainContent = styled(Box)(({ theme }) => ({
  marginTop: "64px",
  height: "calc(100vh - 64px)",
  width: "100%",
  overflow: "auto",
  boxSizing: "border-box",
}));

const ContentPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  height: "100%",
  width: "100%",
  borderRadius: 0,
  boxSizing: "border-box",
  overflow: "auto",
}));

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: 6,
  textTransform: "none",
  padding: "8px 16px",
}));

const AddUser = () => {
  const { authState } = useContext(AuthContext);
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  const [newUser, setNewUser] = useState({
    email: "", password: "", name: "", role: "Employee", department: "", directorate: "",
    chiefOfficerName: "", personNumber: "", directorName: "", departmentalHeadName: "", HRDirectorName: "", profilePicture: ""
  });
  const [message, setMessage] = useState({ type: "", text: "" });

  const localToken = localStorage.getItem("token");
  const effectiveToken = authState?.token || localToken;
  const effectiveUser = authState?.user || JSON.parse(localStorage.getItem("user") || "{}");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewUser(prev => ({ ...prev, [name]: value }));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await apiClient.post("/api/users/add-user", newUser, {
        headers: { Authorization: `Bearer ${effectiveToken}` },
      });
      setMessage({ type: "success", text: "User added successfully" });
      await apiClient.post("/api/audit-logs", {
        action: "ADD_USER",
        userId: effectiveUser.id,
        details: `Added user: ${newUser.email}`
      }, { headers: { Authorization: `Bearer ${effectiveToken}` } });
      setTimeout(() => navigate("/super-admin-dashboard"), 1500);
    } catch (error) {
      const errorMessage = error.response?.data?.error || "An error occurred";
      setMessage({ type: "error", text: errorMessage });
      addNotification(errorMessage, "error");
    }
  };

  return (
    <>
      <StyledAppBar position="fixed">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate("/super-admin-dashboard")}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Add New User
          </Typography>
        </Toolbar>
      </StyledAppBar>

      <MainContent>
        <ContentPaper elevation={3}>
          {message.text && (
            <Alert severity={message.type} sx={{ mb: 3, borderRadius: 2 }}>
              {message.text}
            </Alert>
          )}
          <Typography variant="h5" sx={{ mb: 3, fontWeight: "bold" }}>
            Add User
          </Typography>
          <Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Name"
                  name="name"
                  value={newUser.name}
                  onChange={handleChange}
                  fullWidth
                  required
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={newUser.email}
                  onChange={handleChange}
                  fullWidth
                  required
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Password"
                  name="password"
                  type="password"
                  value={newUser.password}
                  onChange={handleChange}
                  fullWidth
                  required
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Role"
                  name="role"
                  value={newUser.role}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                  select
                >
                  <MenuItem value="Employee">Employee</MenuItem>
                  <MenuItem value="Admin">Admin</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Department"
                  name="department"
                  value={newUser.department}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Directorate"
                  name="directorate"
                  value={newUser.directorate}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Chief Officer Name"
                  name="chiefOfficerName"
                  value={newUser.chiefOfficerName}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Person Number"
                  name="personNumber"
                  value={newUser.personNumber}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Director Name"
                  name="directorName"
                  value={newUser.directorName}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Departmental Head Name"
                  name="departmentalHeadName"
                  value={newUser.departmentalHeadName}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="HR Director Name"
                  name="HRDirectorName"
                  value={newUser.HRDirectorName}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Profile Picture URL"
                  name="profilePicture"
                  value={newUser.profilePicture}
                  onChange={handleChange}
                  fullWidth
                  variant="outlined"
                />
              </Grid>
            </Grid>
            <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <StyledButton variant="outlined" onClick={() => navigate("/super-admin-dashboard")}>
                Cancel
              </StyledButton>
              <StyledButton variant="contained" color="primary" onClick={handleAddUser}>
                Add User
              </StyledButton>
            </Box>
          </Box>
        </ContentPaper>
      </MainContent>
    </>
  );
};

export default AddUser;