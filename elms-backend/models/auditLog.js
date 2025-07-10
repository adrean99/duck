const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  userId: { type: String, required: true },
  details: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  userName: { type: String, required: true },
  userRole: { type:String, required: true}, 

});

auditLogSchema.index({ timestamp: -1 });
module.exports = mongoose.model('AuditLog', auditLogSchema);