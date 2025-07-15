const mongoose = require("mongoose");
const LeaveRoster = require("./models/LeaveRoster");
const Profile = require("./models/Profile");

mongoose.connect("mongodb://localhost:27017/leafdev", { useNewUrlParser: true, useUnifiedTopology: true });

async function cleanLeaveRosters() {
  const invalidRosters = await LeaveRoster.find({ $or: [{ employeeId: null }, { directorate: null }] });
  for (const roster of invalidRosters) {
    console.log(`Removing invalid roster: ${roster._id}`);
    await LeaveRoster.findByIdAndDelete(roster._id);
  }
  console.log("LeaveRoster cleaning complete.");
}

async function updateProfiles() {
  const profilesWithoutDirectorate = await Profile.find({ directorate: null });
  for (const profile of profilesWithoutDirectorate) {
    profile.directorate = "ICT"; // Adjust based on your context
    console.log(`Updating profile ${profile.userId} with directorate: ${profile.directorate}`);
    await profile.save();
  }
  console.log("Profile updates complete.");
}

async function main() {
  try {
    await cleanLeaveRosters();
    await updateProfiles();
  } catch (error) {
    console.error("Error during cleaning:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();