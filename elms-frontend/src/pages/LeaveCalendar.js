import { useEffect, useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import "react-big-calendar/lib/css/react-big-calendar.css";
import apiClient from "../utils/apiClient";
import { useNavigate } from "react-router-dom";

const locales = { "en-US": require("date-fns/locale/en-US") };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const LeaveCalendar = () => {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate(); // Add navigate hook

  // Check for token and redirect if missing
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("No token found, redirecting to login");
      navigate("/login");
    }
  }, [navigate]);
  // Fetch all leave requests

    const fetchLeaves = async () => {
      try {
        const response = await apiClient.get("/api/leaves/employee");
        console.log("Fetched leaves:", response.data);

        // Check if the data is an array
        const leaves = Array.isArray(response.data) ? response.data : [];

        if (leaves.length > 0) {
          const formattedEvents = leaves.map((leave) => ({
            title: `${leave.employeeId?.name || "Unknown Employee"} - ${leave.status}`,
            start: new Date(leave.startDate),
            end: new Date(leave.endDate),
            allDay: true,
            status: leave.status, // Store status for potential styling
          }));
          setEvents(formattedEvents);
          setError(null);
        } else {
          console.log("No leave data found.");
          setError("No leave requests found.");
        }
      } catch (error) {
        console.error("Error fetching leave data:", error);
        console.error("Error response:", error.response);
        console.error("Error message:", error.message);
        setError("Failed to fetch leave data. Please try again later.");
      }
    };
    useEffect(() => {
      const token = localStorage.getItem("token");
      if (!token) return;
    fetchLeaves();
  }, []);

  // Custom event styling based on status (optional)
  const eventStyleGetter = (event) => {
    let backgroundColor;
    switch (event.status) {
      case "Approved":
        backgroundColor = "#28a745"; // Green
        break;
      case "Pending":
        backgroundColor = "#ffc107"; // Yellow
        break;
      case "Rejected":
        backgroundColor = "#dc3545"; // Red
        break;
      default:
        backgroundColor = "#3174ad"; // Default blue
    }
    return {
      style: {
        backgroundColor,
        borderRadius: "5px",
        opacity: 0.8,
        color: "white",
        border: "0px",
        display: "block",
      },
    };
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Leave Calendar</h2>
      {error ? (
        <div className="text-red-500 mb-4">{error}</div>
      ) : (
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 500 }}
          eventPropGetter={eventStyleGetter} // Apply custom styles
        />
      )}
    </div>
  );
};

export default LeaveCalendar;