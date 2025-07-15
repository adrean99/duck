const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: {type: String, required: true },
    role: { type: String, enum: ["Employee", "Director", "DepartmentalHead", "HRDirector", "Admin"], default: "Employee" },
    profilePicture: { type: String, default: "" }, 
    department: { type: String,
        enum: [
        'Department of Education, Training and Devolution',
      'Department of Agriculture, Livestock and Aquaculture Development',
      'Department of County Public Service & Solid Waste Management',
      'Department of Medical Services and Public Health',
      'Department of Transport, Public Works, Infrastructure and Energy',
      'Department of Lands, Physical Planning, Housing and Urban Development',
      'Department of Finance, Economic Planning &ICT',
      'Department of Water, Irrigation, Environment and Climate Change',
      'Department of Gender, Youth and Social Services',
      'Department of Trade, Tourism, Culture and Cooperative Development'
        ],  required: true },

    chiefOfficerName: { type: String },
    personNumber: { type: String },
    directorate: { type: String,
        enum:[
      'Education and Training', 'Devolution',
      'Crop Resource Management', 'Livestock Production and Fisheries Development', 'Veterinary Services',
      'Public Service', 'Solid Waste Management',
      'Health Finance and Administration', 'HMIS, M&E and Research', 'Health commodities', 'Nursing, Reproductive Health and outreach Services', 'Universal Health Coverage and primary Health Services', 'Environmental Health Services', 'Curative, Preventive and Promotive Health Services',
      'PUBLIC WORKS', 'TRANSPORT AND ROAD', 'ENERGY',
      'Physical Planning and Urban Development', 'Housing', 'Survey',
      'Revenue', 'Accounting', 'Budget Planning', 'Procurement', 'Internal Audit', 'ICT',
      'Water', 'Irrigation', 'Environment and Climate Change',
      'DISASTER MANAGEMENT', 'SOCIAL SERVICES', 'GENDER AND YOUTH',
      'Trade Investment Markets and Enterprise Development', 'Tourism and Culture', 'Cooperative Development'
        ], required: true },
    directorName: { type: String },
    departmentalHeadName: { type: String },
    HRDirectorName: { type: String},
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);