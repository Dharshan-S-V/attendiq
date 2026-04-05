// lib/geo.js
// Haversine formula — accurate distance between two GPS coordinates
export function haversine(lat1, lon1, lat2, lon2) {
  const R    = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Strict presence check — NO extra buffer added.
// If admin sets 100m, only students within exactly 100m are marked Present.
// 101m = Absent. This is intentional and correct.
export function checkPresence(studentLat, studentLng, classLat, classLng, radiusMeters) {
  const distance = haversine(studentLat, studentLng, classLat, classLng);
  return {
    distance,
    radius:  radiusMeters,
    inRange: distance <= radiusMeters,
  };
}
