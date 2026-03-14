declare module 'suncalc' {
  export function getTimes(date: Date, lat: number, lng: number): {
    sunrise: Date;
    sunriseEnd: Date;
    sunset: Date;
    sunsetStart: Date;
    solarNoon: Date;
    nadir: Date;
    [key: string]: Date;
  };
  export function getPosition(date: Date, lat: number, lng: number): {
    altitude: number;
    azimuth: number;
  };
}

declare module 'topojson-client' {
  export function feature(topology: unknown, object: unknown): { features?: Array<{ type: string; geometry: unknown }> };
}
