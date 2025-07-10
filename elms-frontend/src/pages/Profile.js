import { useState, useEffect, useContext } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Badge,
} from "@mui/material";
import { styled } from "@mui/system";
import Sidebar from "../components/Sidebar";

// Styled components
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: "#1976d2",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  zIndex: 1201,
  position: "fixed",
}));

const MainContent = styled(Box)(({ theme }) => ({
  marginTop: "64px",
  height: "calc(100vh - 64px)",
  width: "100%",
  overflow: "auto",
  padding: theme.spacing(3),
  boxSizing: "border-box",
}));
  
export const ProfileTable = ({ profile }) => {
  const getInitial = (name) => (name ? name.charAt(0).toUpperCase() : "U");

  return (
    <Box sx={{ padding: 2, borderRadius: 2, backgroundColor: "#fff", boxShadow: 1 }}>
      <Grid container spacing={3} alignItems="center" justifyContent="center">
        {/* Profile Picture Section */}
        <Grid item xs={12} sm={4}>
          <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              badgeContent={<Box sx={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#4caf50" }} />}
            >
              <Avatar
                src={profile?.profilePicture || ""}
                alt={profile?.name || "User"}
                sx={{ width: 120, height: 120, fontSize: "2rem" }}
              >
                {getInitial(profile?.name)}
              </Avatar>
            </Badge>
          </Box>
          <Typography variant="h6" align="center" sx={{ color: "#1976d2", fontWeight: "bold" }}>
            {profile?.name || "Unnamed User"}
          </Typography>
        </Grid>

        {/* Profile Details in Grid */}
        <Grid item xs={12} sm={8}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Box sx={{ p: 2, backgroundColor: "#f5f5f5", borderRadius: 1, minHeight: 100 }}>
                <Typography variant="subtitle1" sx={{ color: "#666", mb: 1 }}>
                  Department
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {profile?.department || "N/A"}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ p: 2, backgroundColor: "#f5f5f5", borderRadius: 1, minHeight: 100 }}>
                <Typography variant="subtitle1" sx={{ color: "#666", mb: 1 }}>
                  Phone Number
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {profile?.phoneNumber || "N/A"}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ p: 2, backgroundColor: "#f5f5f5", borderRadius: 1, minHeight: 100 }}>
                <Typography variant="subtitle1" sx={{ color: "#666", mb: 1 }}>
                  Chief Officer
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {profile?.chiefOfficerName || "N/A"}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ p: 2, backgroundColor: "#f5f5f5", borderRadius: 1, minHeight: 100 }}>
                <Typography variant="subtitle1" sx={{ color: "#666", mb: 1 }}>
                  Person Number
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {profile?.personNumber || "N/A"}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ p: 2, backgroundColor: "#f5f5f5", borderRadius: 1, minHeight: 100 }}>
                <Typography variant="subtitle1" sx={{ color: "#666", mb: 1 }}>
                  Email
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {profile?.email || "N/A"}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ p: 2, backgroundColor: "#f5f5f5", borderRadius: 1, minHeight: 100 }}>
                <Typography variant="subtitle1" sx={{ color: "#666", mb: 1 }}>
                  Directorate
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {profile?.directorate || "N/A"}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ p: 2, backgroundColor: "#f5f5f5", borderRadius: 1, minHeight: 100 }}>
                <Typography variant="subtitle1" sx={{ color: "#666", mb: 1 }}>
                  Profile Picture URL
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {profile?.profilePicture || "N/A"}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ p: 2, backgroundColor: "#f5f5f5", borderRadius: 1, minHeight: 100 }}>
                <Typography variant="subtitle1" sx={{ color: "#666", mb: 1 }}>
                  Director
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {profile?.directorName || "N/A"}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ p: 2, backgroundColor: "#f5f5f5", borderRadius: 1, minHeight: 100 }}>
                <Typography variant="subtitle1" sx={{ color: "#666", mb: 1 }}>
                  Departmental Head
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {profile?.departmentalHeadName || "N/A"}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ p: 2, backgroundColor: "#f5f5f5", borderRadius: 1, minHeight: 100 }}>
                <Typography variant="subtitle1" sx={{ color: "#666", mb: 1 }}>
                  HR Director
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {profile?.HRDirectorName || "N/A"}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};


const Profile = () => {
  const { token, logout, user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: "",
    department: "",
    phoneNumber: "",
    profilePicture: "",
    chiefOfficerName: "",
    personNumber: "",
    email: "",
    directorate: "",
    directorName: "",
    departmentalHeadName: "",
    HRDirectorName: "",
  });
  const [message, setMessage] = useState({ type: "", text: "" });
  //const [submitting, setSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { addNotification } = useNotifications();
  const localToken = localStorage.getItem("token");
  const localUser = JSON.parse(localStorage.getItem("user") || "null");
  const effectiveToken = token || localToken;
  const effectiveUser = user || localUser;

  //console.log("Profile rendering - Effective Token:", effectiveToken, "User:", effectiveUser);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!effectiveToken) {
        console.log("No effective token, redirecting to /login");
        navigate("/login");
        return;
      }
      setIsLoading(true);
      try {
        const res = await apiClient.get(`/api/profiles/${effectiveUser.id}`, {
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
  }, [addNotification]);

  /* const handleChange = (e) => {
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
  };*/

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
          
          <ProfileTable profile={profile} />
        </Paper>
      </MainContent>
    </div>
  );
};

export default Profile;