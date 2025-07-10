const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  directorates: [{ type: String, required: true }]
});

module.exports = mongoose.model('Department', departmentSchema);