const express = require('express');
const router = express.Router();
const AuditLog = require('../models/auditLog');
const { verifyToken, hasRole } = require("../middleware/authMiddleware");

router.get("/", verifyToken, hasRole(["HRDirector", "Admin"]), async (req, res) => {
  try {
    const { action, userId, userRole, additionalDataSearch, startDate, endDate, page = 1, limit = 20 } = req.query;
    let query = {};

    if (action) query.action = { $regex: action, $options: 'i' };
    if (userId) query.userId = userId;
    if (userRole) query.userRole = userRole;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    let auditLogs;
    if (additionalDataSearch) {
      auditLogs = await AuditLog.aggregate([
        {
          $addFields: {
            additionalDataStr: { $toString: "$additionalData" }
          }
        },
        {
          $match: {
            ...query,
            additionalDataStr: { $regex: additionalDataSearch, $options: 'i' }
          }
        },
        { $sort: { timestamp: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: parseInt(limit) }
      ]);
    } else {
      auditLogs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));
    }

    const total = additionalDataSearch
      ? (await AuditLog.aggregate([
          {
            $addFields: {
              additionalDataStr: { $toString: "$additionalData" }
            }
          },
          {
            $match: {
              ...query,
              additionalDataStr: { $regex: additionalDataSearch, $options: 'i' }
            }
          },
          { $count: "total" }
        ]))[0]?.total || 0
      : await AuditLog.countDocuments(query);

    res.status(200).json({ auditLogs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});


/*router.get('/', async (req, res) => {
  try {
    const { action, userId, startDate, endDate } = req.query;
    const query = {};
    if (action) query.action = new RegExp(action, 'i');
    if (userId) query.userId = userId;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    const logs = await AuditLog.find(query).sort({ timestamp: -1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});
*/
router.post('/', async (req, res) => {
  try {
    const { action, userId, details } = req.body;
    const log = new AuditLog({ action, userId, details });
    await log.save();
    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;