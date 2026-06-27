// Ghana national outline — simplified polygon (lng, lat), counter-clockwise.
// Bounding box approx: lng -3.25 to 1.20, lat 4.74 to 11.17
export const GHANA_OUTLINE: [number, number][] = [
  // Starting southern coast (west to east)
  [-3.25, 4.74],
  [-2.8, 4.74],
  [-2.4, 4.78],
  [-1.95, 4.74],
  [-1.6, 4.74],
  [-1.25, 4.88],
  [-0.9, 4.8],
  [-0.6, 4.74],
  [-0.25, 4.74],
  [0.0, 4.83],
  [0.3, 4.9],
  [0.55, 5.05],
  [0.57, 5.3],
  [0.72, 5.78],
  [0.88, 6.07],
  [1.19, 6.1],
  [1.2, 6.3],
  [1.07, 6.55],
  [0.75, 6.77],
  [0.53, 7.0],
  [0.36, 7.28],
  [0.47, 7.6],
  [0.55, 7.9],
  [0.5, 8.2],
  [0.38, 8.5],
  [0.2, 8.82],
  [-0.05, 9.07],
  [-0.1, 9.4],
  [0.0, 9.75],
  [0.1, 10.1],
  [0.22, 10.65],
  [0.35, 10.9],
  [0.52, 11.0],
  [0.52, 11.17],
  // Northern border (east to west)
  [0.1, 11.17],
  [-0.2, 11.17],
  [-0.55, 11.1],
  [-0.9, 11.1],
  [-1.2, 11.1],
  [-1.45, 11.0],
  [-1.8, 11.05],
  [-2.1, 10.95],
  [-2.35, 10.74],
  [-2.6, 10.6],
  [-2.8, 10.45],
  [-2.9, 10.2],
  [-2.88, 9.95],
  [-2.8, 9.75],
  [-2.68, 9.5],
  // Western border (north to south)
  [-2.75, 9.2],
  [-2.9, 8.95],
  [-3.05, 8.65],
  [-3.15, 8.3],
  [-3.2, 8.0],
  [-3.25, 7.8],
  [-3.25, 7.5],
  [-3.2, 7.2],
  [-3.15, 6.95],
  [-3.1, 6.7],
  [-3.05, 6.4],
  [-3.0, 6.1],
  [-3.1, 5.8],
  [-3.2, 5.5],
  [-3.25, 5.2],
  [-3.25, 4.9],
  [-3.25, 4.74],
];

export function pointInPoly(
  lng: number,
  lat: number,
  poly: [number, number][],
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0],
      yi = poly[i][1];
    const xj = poly[j][0],
      yj = poly[j][1];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
