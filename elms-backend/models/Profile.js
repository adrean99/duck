const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  name: { type: String, required: true },
  department: { type: String, required: true },
  phoneNumber: { type: String },
  profilePicture: { type: String },
  chiefOfficerName: { type: String },
  supervisorName: { type: String },
  personNumber: { type: String },
  email: { type: String, required: true },
  sector: { type: String },
  sectionalHeadName: { type: String, required: true },
  departmentalHeadName: { type: String, required: true },
  HRDirectorName: { type: String, required: true},
});

module.exports = mongoose.model("Profile", profileSchema);