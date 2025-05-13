import { useState } from "react";
import { Drawer, List, ListItem, ListItemIcon, ListItemText, IconButton, Divider } from "@mui/material";
import { Menu, AccountCircle, CalendarToday, NoteAdd, Logout, Event, Notifications as NotificationsIcon } from "@mui/icons-material";
import { Link } from "react-router-dom";
import { styled } from "@mui/system";

// Styled components for Sidebar
const StyledDrawer = styled(Drawer)(({ theme }) => ({
  "& .MuiDrawer-paper": {
    width: 240,
    backgroundColor: "#fff",
    boxShadow: "2px 0 5px rgba(0,0,0,0.1)",
    top: "64px",
    height: "calc(100% - 64px)",
  },
}));

const StyledListItem = styled(ListItem)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  "&:hover": {
    backgroundColor: "#f0f0f0",
  },
}));

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  "&:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
}));

const Sidebar = ({ onLogout }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <StyledIconButton color="inherit" onClick={() => setOpen(true)} aria-label="open menu">
        <Menu />
      </StyledIconButton>
      <StyledDrawer anchor="left" open={open} onClose={() => setOpen(false)}>
        
        <List>
          <StyledListItem component={Link} to="/profile" onClick={() => setOpen(false)}>
            <ListItemIcon>
              <AccountCircle sx={{ color: "#1976d2" }} />
            </ListItemIcon>
            <ListItemText primary="Profile" primaryTypographyProps={{ fontWeight: "medium" }} />
          </StyledListItem>
          <StyledListItem component={Link} to="/apply-leave/short" onClick={() => setOpen(false)}>
            <ListItemIcon>
              <NoteAdd sx={{ color: "#1976d2" }} />
            </ListItemIcon>
            <ListItemText primary="Short Leave" primaryTypographyProps={{ fontWeight: "medium" }} />
          </StyledListItem>
          <StyledListItem component={Link} to="/apply-leave/annual" onClick={() => setOpen(false)}>
            <ListItemIcon>
              <NoteAdd sx={{ color: "#1976d2" }} />
            </ListItemIcon>
            <ListItemText primary="Annual Leave" primaryTypographyProps={{ fontWeight: "medium" }} />
          </StyledListItem>
          <StyledListItem component={Link} to="/leave-calendar" onClick={() => setOpen(false)}>
            <ListItemIcon>
              <CalendarToday sx={{ color: "#1976d2" }} />
            </ListItemIcon>
            <ListItemText primary="Leave Calendar" primaryTypographyProps={{ fontWeight: "medium" }} />
          </StyledListItem>
          <StyledListItem component={Link} to="/leave-roster" onClick={() => setOpen(false)}>
            <ListItemIcon>
              <Event sx={{ color: "#1976d2" }} />
            </ListItemIcon>
            <ListItemText primary="Leave Roster" primaryTypographyProps={{ fontWeight: "medium" }} />
          </StyledListItem>
          <StyledListItem component={Link} to="/notifications" onClick={() => setOpen(false)}>
            <ListItemIcon>
              <NotificationsIcon sx={{ color: "#1976d2" }} />
            </ListItemIcon>
            <ListItemText primary="Notifications" primaryTypographyProps={{ fontWeight: "medium" }} />
          </StyledListItem>
          <Divider />
          <StyledListItem onClick={() => { onLogout(); setOpen(false); }}>
            <ListItemIcon>
              <Logout sx={{ color: "#d32f2f" }} />
            </ListItemIcon>
            <ListItemText primary="Logout" primaryTypographyProps={{ fontWeight: "medium", color: "#d32f2f" }} />
          </StyledListItem>
        </List>
      </StyledDrawer>
    </>
  );
};

export default Sidebar;