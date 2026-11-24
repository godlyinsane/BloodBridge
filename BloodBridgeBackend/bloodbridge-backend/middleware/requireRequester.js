const jwt = require("jsonwebtoken");

function requireRequester(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Requester login required." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== "requester") return res.status(403).json({ error: "Requester account access required." });
    req.requester = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired — please log in again." });
  }
}
module.exports = requireRequester;
