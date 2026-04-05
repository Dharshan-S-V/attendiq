// lib/geo.js

// ─── Haversine formula ─── accurate for all distances on Earth
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Geofence presence check (radius-expansion method) ───
//
// GPS coordinates have inherent error on BOTH sides:
//   • Student phone GPS: error ≈ reported accuracy (5-30m indoors)
//   • Admin laptop GPS:  error ≈ 10-20m (unknown, not stored)
//
// APPROACH: Instead of trusting raw distance, we EXPAND the acceptance
// radius by the combined GPS uncertainty. This is how professional
// geofencing systems (Google, Apple) handle GPS inaccuracy.
//
//   effectiveRadius = adminRadius + studentAccuracy + ADMIN_UNCERTAINTY
//   present?        = rawDistance ≤ effectiveRadius
//
// ADMIN_UNCERTAINTY: fixed estimate for the admin's GPS error when
// they clicked "Use My Location". Conservative value of 20m covers
// most indoor scenarios.
//
// Example (phone on keyboard, 10m set radius):
//   rawDistance = 22m, studentAccuracy = 15m
//   effectiveRadius  = 10 + 15 + 20 = 45m
//   22 ≤ 45 → Present ✅
//
// Example (student in another building, 10m set radius):
//   rawDistance = 120m, studentAccuracy = 10m
//   effectiveRadius  = 10 + 10 + 20 = 40m
//   120 > 40 → Absent ❌
//
const ADMIN_UNCERTAINTY = 20; // meters — covers admin GPS error

export function checkPresence(studentLat, studentLng, classLat, classLng, radiusMeters, accuracy = 0) {
  const rawDistance = haversine(studentLat, studentLng, classLat, classLng);
  const rawRounded = Math.round(rawDistance);

  // Expand the admin-set radius by combined GPS uncertainty
  const effectiveRadius = radiusMeters + accuracy + ADMIN_UNCERTAINTY;

  return {
    rawDistance: rawRounded,        // Haversine distance (admin audit only)
    distance: rawRounded,        // same as raw — no manipulation
    accuracy: Math.round(accuracy),
    radius: radiusMeters,       // what admin originally set
    effectiveRadius: Math.round(effectiveRadius),  // expanded by GPS error
    inRange: rawDistance <= effectiveRadius,
  };
}
