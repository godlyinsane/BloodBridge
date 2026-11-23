const jwt = require("jsonwebtoken");

function requireDonor(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Donor login required." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== "donor") return res.status(403).json({ error: "Donor access required." });
    req.donor = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired — please log in again." });
  }
}

module.exports = requireDonor;
