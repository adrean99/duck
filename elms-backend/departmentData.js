const departmentData = {
  "Department of Education, Training and Devolution": [
    "Education and Training",
    "Devolution"
  ],
  "Department of Agriculture, Livestock and Aquaculture Development": [
    "Crop Resource Management",
    "Livestock Production and Fisheries Development",
    "Veterinary Services"
  ],
  "Department of County Public Service & Solid Waste Management": [
    "Public Service",
    "Solid Waste Management"
  ],
  "Department of Medical Services and Public Health": [
    "Health Finance and Administration",
    "HMIS, M&E and Research",
    "Health commodities",
    "Nursing, Reproductive Health and outreach Services",
    "Universal Health Coverage and primary Health Services",
    "Environmental Health Services",
    "Curative, Preventive and Promotive Health Services"
  ],
  "Department of Transport, Public Works, Infrastructure and Energy": [
    "PUBLIC WORKS",
    "TRANSPORT AND ROAD",
    "ENERGY"
  ],
  "Department of Lands, Physical Planning, Housing and Urban Development": [
    "Physical Planning and Urban Development",
    "Housing",
    "Survey"
  ],
  "Department of Finance, Economic Planning &ICT": [
    "Revenue",
    "Accounting",
    "Budget Planning",
    "Procurement",
    "Internal Audit",
    "ICT"
  ],
  "Department of Water, Irrigation, Environment and Climate Change": [
    "Water",
    "Irrigation",
    "Environment and Climate Change"
  ],
  "Department of Gender, Youth and Social Services": [
    "DISASTER MANAGEMENT",
    "SOCIAL SERVICES",
    "GENDER AND YOUTH"
  ],
  "Department of Trade, Tourism, Culture and Cooperative Development": [
    "Trade Investment Markets and Enterprise Development",
    "Tourism and Culture",
    "Cooperative Development"
  ]
};

const allDirectorates = Object.values(departmentData).flat();

module.exports = { departmentData, allDirectorates };