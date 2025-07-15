const AuditLog = require("../models/auditLog");

const logAction = async (action, user, additionalData = {}) => {
  try {
    // Check if user is defined and has required properties
    if (!user || typeof user !== 'object' || !user._id) {
      console.warn(`Cannot log action "${action}": User is undefined or missing _id. Additional data:`, additionalData);
      return; // Exit early if user data is invalid
    }
    console.log(`Action logged: ${action} by user ${user._id}`, { user, ...additionalData });

    const auditLog = new AuditLog({
      action,
      userId: user._id,
      userName: user.name || 'Unknown', // Fallback for missing name
      userRole: user.role || 'Unknown', // Fallback for missing title
      additionalData,
      timestamp: new Date(), // Optional: Add timestamp for clarity
    });

    await auditLog.save();
    console.log(`Action logged successfully: ${action} by user ${user._id}`);
  } catch (error) {
    console.error("Error logging action:", {
      action,
      userId: user ? user._id : 'undefined',
      error: error.message,
      stack: error.stack,
    });
  }
};

module.exports = { logAction };