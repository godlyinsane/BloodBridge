const jwt = require("jsonwebtoken");

module.exports = function requireCampOrganizer(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Camp organizer login required." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== "camp-organizer") return res.status(403).json({ error: "Camp organizer access required." });
    req.campOrganizer = { id: payload.id, phone: payload.phone };
    return next();
  } catch {
    return res.status(401).json({ error: "Organizer session expired. Please log in again." });
  }
};
