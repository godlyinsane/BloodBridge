// Which donor groups can give TO a given recipient group
const CAN_RECEIVE_FROM = {
  "O+": ["O+", "O-"],
  "O-": ["O-"],
  "A+": ["A+", "A-", "O+", "O-"],
  "A-": ["A-", "O-"],
  "B+": ["B+", "B-", "O+", "O-"],
  "B-": ["B-", "O-"],
  "AB+": ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"],
  "AB-": ["A-", "B-", "AB-", "O-"],
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function daysSince(date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

// Minimum gap (in days) required between donations, per Indian national blood-centre
// guidelines (e-RaktKosh / Clinical Establishments rules): men every 90 days,
// women every 120 days. "Other" defaults to the more conservative 120-day gap.
const MIN_GAP_DAYS = { Male: 90, Female: 120, Other: 120 };

function minGapDays(gender) {
  return MIN_GAP_DAYS[gender] || 90;
}

function isEligibleToDonate(gender, lastDonation) {
  return daysSince(lastDonation) >= minGapDays(gender);
}

// Days remaining until eligible again (0 if already eligible)
function daysUntilEligible(gender, lastDonation) {
  const remaining = minGapDays(gender) - daysSince(lastDonation);
  return Math.max(0, remaining);
}

module.exports = { CAN_RECEIVE_FROM, haversineKm, daysSince, MIN_GAP_DAYS, minGapDays, isEligibleToDonate, daysUntilEligible };
