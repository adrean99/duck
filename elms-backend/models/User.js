const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: {type: String, required: true },
    role: { type: String, enum: ["Employee", "Director", "DepartmentalHead", "HRDirector", "Admin"], default: "Employee" },
    profilePicture: { type: String, default: "" }, 
    department: { type: String, required: true },
    profilePicture: { type: String },
    chiefOfficerName: { type: String },
    personNumber: { type: String },
    directorate: { type: String },
    directorName: { type: String },
    departmentalHeadName: { type: String },
    HRDirectorName: { type: String},
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);