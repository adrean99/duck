const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, enum: ["Employee", "Director", "DepartmentalHead", "HRDirector", "Admin"], default: "Employee" },
  department: { type: String, required: true },
  phoneNumber: { type: String },
  profilePicture: { type: String },
  chiefOfficerName: { type: String },
  personNumber: { type: String },
  email: { type: String, required: true },
  directorate: { type: String },
  directorName: { type: String },
  departmentalHeadName: { type: String },
  HRDirectorName: { type: String},
});

module.exports = mongoose.model("Profile", profileSchema);