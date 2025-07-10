const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const authHeader = req.header("Authorization");
  console.log("🔍 Token received:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("No valid Bearer token provided");
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    console.log("Token missing after Bearer");
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded);
    req.user = decoded.user || decoded; // Handle flat payload
    console.log("Set req.user:", req.user);
    if (!req.user.id) {
      console.log("Token lacks id field:", decoded);
      return res.status(401).json({ msg: "Token lacks user ID" });
    }
    next();
  } catch (err) {
    console.error("❌ Token verification failed:", err.message);
    return res.status(401).json({ msg: "Token is not valid" });
  }
}

const hasRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: `Access restricted to roles: ${roles.join(", ")}` });
  }
  next();
};

const isAdmin = hasRole(["Admin"]);
const isDirector = hasRole(["Director"]);
const isDepartmentalHead =hasRole(["DepartmentalHead"]);
const isHRDirector = hasRole(["HRDirector"]);

module.exports = { verifyToken, hasRole, isAdmin, isDirector,  isDepartmentalHead, isHRDirector };