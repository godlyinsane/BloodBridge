// Run with: npm run create-admin
// Creates (or updates the password of) the ONE admin account, using
// ADMIN_USERNAME and ADMIN_PASSWORD from your .env file.
// There is no public "register as admin" route anywhere in this app —
// this script is the only way an admin account gets created.
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");

async function run() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error("Set ADMIN_USERNAME and ADMIN_PASSWORD in your .env file first.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await Admin.findOne({ username });
  if (existing) {
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`Password updated for existing admin "${username}".`);
  } else {
    await Admin.create({ username, passwordHash });
    console.log(`Admin account "${username}" created.`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
