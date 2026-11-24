// Run with: node seed.js
// DEMO ONLY: replaces donor records with 15 fictional donors at distinct
// approximate locations around Bilaspur, Chhattisgarh. Never use this to seed
// a production database containing real donor records.
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Donor = require("./models/Donor");
const BloodBank = require("./models/BloodBank");

const DEMO_PASSWORD = "bloodbridge123";
const demoDonors = [
  ["Aarav Sharma", "9811100001", "O+", "Male", 22.0797, 82.1409, "Bilaspur"],
  ["Ananya Verma", "9811100002", "A+", "Female", 22.0912, 82.1551, "Sarkanda"],
  ["Rohan Patel", "9811100003", "B+", "Male", 22.0648, 82.1315, "Vyapar Vihar"],
  ["Priya Singh", "9811100004", "O-", "Female", 22.1021, 82.1684, "Koni"],
  ["Vivek Gupta", "9811100005", "AB+", "Male", 22.0479, 82.1588, "Mangla"],
  ["Meera Joshi", "9811100006", "A-", "Female", 22.0873, 82.1176, "Rajkishore Nagar"],
  ["Karan Yadav", "9811100007", "B-", "Male", 22.0584, 82.1093, "Torwa"],
  ["Sneha Rao", "9811100008", "AB-", "Female", 22.1155, 82.1422, "Uslapur"],
  ["Rahul Mishra", "9811100009", "O+", "Male", 22.0356, 82.1435, "Seepat Road"],
  ["Kavya Nair", "9811100010", "A+", "Female", 22.0738, 82.1831, "Mopka"],
  ["Aditya Reddy", "9811100011", "B+", "Male", 22.1286, 82.1574, "Chilhati"],
  ["Isha Mehta", "9811100012", "O+", "Female", 22.0512, 82.1872, "Deori Khurd"],
  ["Sanjay Chauhan", "9811100013", "A+", "Male", 22.0968, 82.0967, "Lingiyadih"],
  ["Nisha Pandey", "9811100014", "B+", "Female", 22.0251, 82.1208, "Bodri"],
  ["Manoj Agarwal", "9811100015", "O-", "Male", 22.1322, 82.1189, "Gatoura"],
];

const path = require("path");
const fs = require("fs");

let SEED_BANKS = [];
try {
  const jsonDbPath = path.resolve(__dirname, "./data/json-db/bloodbank.json");
  if (fs.existsSync(jsonDbPath)) {
    SEED_BANKS = JSON.parse(fs.readFileSync(jsonDbPath, "utf8"));
  }
} catch (e) {
  console.warn("Could not load local bloodbank.json, falling back to default seed banks.");
}
if (!SEED_BANKS.length) {
  SEED_BANKS = [
    { name: "District Hospital Blood Bank Sehore", city: "Sehore", district: "Sehore", state: "Madhya Pradesh", phone: "07562-226737" },
    { name: "AIIMS Bhopal - Transfusion Medicine & Blood Bank", city: "Bhopal", district: "Bhopal", state: "Madhya Pradesh", phone: "0755-2832363" },
    { name: "Hamidia Hospital Blood Bank (Gandhi Medical College)", city: "Bhopal", district: "Bhopal", state: "Madhya Pradesh", phone: "0755-4329532" },
    { name: "Indian Red Cross Society State Blood Centre Bhopal", city: "Bhopal", district: "Bhopal", state: "Madhya Pradesh", phone: "0755-2550346" },
  ];
}

async function seed() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected. Replacing donor records with fictional Bilaspur demo data...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const donors = demoDonors.map(([name, phone, group, gender, lat, lng, city]) => ({
    name, phone, group, gender, lat, lng, city, state: "Chhattisgarh",
    available: true,
    verified: true,
    bloodGroupStatus: "verified",
    bloodGroupConsent: true,
    lastDonation: new Date(Date.now() - 200 * 86400000),
    donationType: "Free",
    feeAmount: 0,
    passwordHash,
  }));

  for (const donor of donors) {
    await Donor.findOneAndUpdate({ phone: donor.phone }, { $set: donor }, { upsert: true, new: true, runValidators: true });
  }
  console.log(`Upserted ${donors.length} fictional demo donors at distinct Bilaspur locations without deleting existing donors.`);
  console.log(`Demo donor password: "${DEMO_PASSWORD}" (phones are listed in this file).`);

  for (const bank of SEED_BANKS) {
    await BloodBank.findOneAndUpdate({ name: bank.name, city: bank.city }, { $set: bank }, { upsert: true, new: true });
  }
  console.log(`Upserted ${SEED_BANKS.length} verified blood banks into database.`);
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
