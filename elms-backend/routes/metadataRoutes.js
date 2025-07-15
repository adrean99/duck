const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, async (req, res) => {
  try {
    if (!['Admin', 'Director', 'DepartmentalHead', 'HRDirector'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized: Privileged role required' });
    }

    const metadata = {
      departments: [
        "Department of Education, Training and Devolution",
        "Department of Agriculture, Livestock and Aquaculture Development",
        "Department of County Public Service & Solid Waste Management",
        "Department of Medical Services and Public Health",
        "Department of Transport, Public Works, Infrastructure and Energy",
        "Department of Lands, Physical Planning, Housing and Urban Development",
        "Department of Finance, Economic Planning &ICT",
        "Department of Water, Irrigation, Environment and Climate Change",
        "Department of Gender, Youth and Social Services",
        "Department of Trade, Tourism, Culture and Cooperative Development"
      ],
      directorates: {
        "Department of Education, Training and Devolution": ["Education and Training", "Devolution"],
        "Department of Agriculture, Livestock and Aquaculture Development": ["Crop Resource Management", "Livestock Production and Fisheries Development", "Veterinary Services"],
        "Department of County Public Service & Solid Waste Management": ["Public Service", "Solid Waste Management"],
        "Department of Medical Services and Public Health": ["Health Finance and Administration", "HMIS, M&E and Research", "Health commodities", "Nursing, Reproductive Health and outreach Services", "Universal Health Coverage and primary Health Services", "Environmental Health Services", "Curative, Preventive and Promotive Health Services"],
        "Department of Transport, Public Works, Infrastructure and Energy": ["PUBLIC WORKS", "TRANSPORT AND ROAD", "ENERGY"],
        "Department of Lands, Physical Planning, Housing and Urban Development": ["Physical Planning and Urban Development", "Housing", "Survey"],
        "Department of Finance, Economic Planning &ICT": ["Revenue", "Accounting", "Budget Planning", "Procurement", "Internal Audit", "ICT"],
        "Department of Water, Irrigation, Environment and Climate Change": ["Water", "Irrigation", "Environment and Climate Change"],
        "Department of Gender, Youth and Social Services": ["DISASTER MANAGEMENT", "SOCIAL SERVICES", "GENDER AND YOUTH"],
        "Department of Trade, Tourism, Culture and Cooperative Development": ["Trade Investment Markets and Enterprise Development", "Tourism and Culture", "Cooperative Development"]
      }
    };

    res.status(200).json(metadata);
  } catch (err) {
    console.error('Error fetching metadata:', err);
    res.status(500).json({ error: 'Failed to fetch metadata', details: err.message });
  }
});

module.exports = router;