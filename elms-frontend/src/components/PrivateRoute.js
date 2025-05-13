
const PrivateRoute = ({ children, allowedRoles }) => {
  const { token, user } = useContext(AuthContext);
  const localToken = localStorage.getItem("token");
  const effectiveToken = token || localToken;
  const effectiveUser = user || JSON.parse(localStorage.getItem("user") || "{}");

  console.log("PrivateRoute - token:", token, "localToken:", localToken, "effectiveToken:", effectiveToken);
  console.log("PrivateRoute - user:", user, "effectiveUser:", effectiveUser);
  console.log("PrivateRoute: Access granted to", allowedRoles);

  if (!effectiveToken) {
    return <Navigate to="/login" />;
  }

  if (!allowedRoles.includes(effectiveUser.role)) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
};

export default PrivateRoute;