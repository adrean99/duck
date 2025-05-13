import { useContext } from "react";
import { List, ListItem, ListItemText, Typography } from "@mui/material";
import { NotificationContext } from "../context/NotificationContext";

const Notifications = () => {
  const { notifications, removeNotification } = useContext(NotificationContext);

  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Notifications
      </Typography>
      {notifications.length === 0 ? (
        <Typography>No notifications available.</Typography>
      ) : (
        <List>
          {notifications.map((notification) => (
            <ListItem key={notification.id} secondaryAction={
              <button
                onClick={() => removeNotification(notification.id)}
                style={{ color: "red", cursor: "pointer" }}
              >
                Dismiss
              </button>
            }>
              <ListItemText
                primary={notification.message}
                secondary={new Date(notification.timestamp).toLocaleString()}
              />
            </ListItem>
          ))}
        </List>
      )}
    </div>
  );
};

export default Notifications;