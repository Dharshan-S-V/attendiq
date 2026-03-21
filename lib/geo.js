// lib/geo.js
// ─────────────────────────────────────────────────────────────────────────────
//  ACCURATE HAVERSINE DISTANCE
//  Uses full double-precision math, no premature rounding.
//  Returns distance in meters as a float (rounded only at the end).
// ─────────────────────────────────────────────────────────────────────────────

export function haversine(lat1, lon1, lat2, lon2) {
  // Earth radius in meters (mean radius per WGS-84)
  const R = 6371000;

  // Convert degrees → radians
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Return meters, rounded to 1 decimal place for accuracy
  return Math.round(R * c * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SMART PRESENCE CHECK
//
//  Problem: Phone GPS has ±10–50m natural error. A student standing exactly
//  at the edge of the classroom can be reported 20–40m further away purely
//  due to GPS drift, causing false "absent" verdicts.
//
//  Solution: Add a tolerance buffer = half of the reported GPS accuracy.
//  e.g. student GPS accuracy = 20m  →  effective radius = radius + 10m
//  Cap the buffer at 30m so it can't be abused.
//
//  Also: if accuracy is very poor (>65m) we still give benefit of the doubt
//  by using the full accuracy as buffer (capped at 30m).
// ─────────────────────────────────────────────────────────────────────────────
export function isWithinRange(studentLat, studentLng, classLat, classLng, radiusMeters, gpsAccuracyMeters) {
  const distance = haversine(studentLat, studentLng, classLat, classLng);

  // GPS accuracy buffer — half of reported accuracy, capped at 30m
  const accuracyBuffer = Math.min(Math.round((gpsAccuracyMeters || 0) / 2), 30);

  // Effective radius = set radius + GPS accuracy buffer
  const effectiveRadius = radiusMeters + accuracyBuffer;

  return {
    distance,                  // raw calculated distance (meters)
    effectiveRadius,           // radius used for decision
    accuracyBuffer,            // how much buffer was added
    inRange: distance <= effectiveRadius,
  };
}
