const jwt = require("jsonwebtoken");

function requireRareDonor(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Login required." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== "rareDonor") return res.status(403).json({ error: "Rare donor access required." });
    req.rareDonor = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired — please log in again." });
  }
}

module.exports = requireRareDonor;
