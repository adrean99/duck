const express = require("express");
const router = express.Router();
const { departmentData, allDirectorates } = require("../departmentData");

router.get("/metadata", (req, res) => {
  res.json({
    departments: Object.keys(departmentData),
    directorates: allDirectorates,
  });
});

module.exports = router;