import * as FileSystem from 'expo-file-system/legacy';

const fsAny = FileSystem as any;
const R = 6371000; 
const docDir = fsAny.documentDirectory || '';
const FLIGHT_DATA_DIR = docDir + 'my_flight_logs/';

const toRad = (value: number) => (value * Math.PI) / 180;

const getSurfaceDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const ensureDirExists = async () => {
  if (!fsAny.documentDirectory) return;
  const dirInfo = await FileSystem.getInfoAsync(FLIGHT_DATA_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(FLIGHT_DATA_DIR, { intermediates: true });
  }
};

export const saveFileToAppStorage = async (sourceUri: string, fileName: string): Promise<string> => {
  await ensureDirExists();
  const destinationUri = FLIGHT_DATA_DIR + fileName;
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
  } catch (error) {
    const content = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
    await FileSystem.writeAsStringAsync(destinationUri, content, { encoding: FileSystem.EncodingType.Base64 });
  }
  return destinationUri;
};

// ... Imports und Konstanten bleiben gleich ...

export interface KmlMetadata {
  fr24Url: string;
  flightNr: string;
  airline: string;
  planeModel: string; // Neu
  registration: string; // Neu
}

export const extractMetadataFromKml = async (kmlUri: string): Promise<KmlMetadata> => {
  try {
    const content = await FileSystem.readAsStringAsync(kmlUri);
    
    // 1. Link, Flugnummer, Airline wie gehabt
    const linkMatch = content.match(/href="(https?:\/\/www\.flightradar24\.com\/flight\/[^"]+)"/);
    const nameMatch = content.match(/<name>([A-Z0-9]+\/[A-Z0-9]+)<\/name>/); 
    const airlineMatch = content.match(/<br\/>([A-Za-z ]+)<\/div>/); 

    // 2. NEU: Flugzeug und Registration suchen
    // Sucht nach: "Aircraft: Airbus A321-131 (D-AIRP)"
    // Group 1: Airbus A321-131
    // Group 2: D-AIRP
    const aircraftMatch = content.match(/Aircraft: (.*?) \((.*?)\)/);

    let flightNr = '';
    if (nameMatch) flightNr = nameMatch[1].split('/')[0]; 
    
    let airline = '';
    if (airlineMatch) airline = airlineMatch[1].trim();

    // Default Werte
    let planeModel = '';
    let registration = '';

    if (aircraftMatch) {
        planeModel = aircraftMatch[1].trim();  // z.B. "Airbus A321-131"
        registration = aircraftMatch[2].trim(); // z.B. "D-AIRP"
    }

    return {
      fr24Url: linkMatch ? linkMatch[1] : '',
      flightNr,
      airline,
      planeModel,
      registration
    };
  } catch (error) {
    console.warn("KML Warnung:", error);
    return { fr24Url: '', flightNr: '', airline: '', planeModel: '', registration: '' };
  }
};

// ... Rest der Datei (processFlightData etc.) bleibt unverändert ...
// Du musst nur "export interface FlightData..." und "processFlightData" von vorhin behalten.

export interface FlightData {
  direct: number;
  flown: number;
  date: string;
  durationMinutes: number; // NEU
}

interface TrackPoint {
  lat: number;
  lon: number;
  alt: number; 
  timestamp: number; // NEU: wir brauchen den Zeitstempel
}

export const processFlightData = async (csvUri: string): Promise<FlightData> => {
  const content = await FileSystem.readAsStringAsync(csvUri);
  const lines = content.split('\n');

  let totalDistanceFlown = 0;
  let points: TrackPoint[] = [];
  let flightDate = '';

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(',');
    if (parts.length < 6) continue; 

    // Index 0 ist Timestamp (Unix), Index 1 ist UTC-String
    const timestampRaw = parts[0]; 
    if (!flightDate && parts[1]) flightDate = parts[1];

    const latRaw = parts[3].replace('"', '');
    const lonRaw = parts[4].replace('"', '');
    const altRaw = parts[5]; 

    const lat = parseFloat(latRaw);
    const lon = parseFloat(lonRaw);
    const altFeet = parseFloat(altRaw);
    const ts = parseInt(timestampRaw, 10); // Unix Timestamp

    if (isNaN(lat) || isNaN(lon)) continue;

    // Wir speichern nur Punkte mit logischen Werten
    points.push({ lat, lon, alt: altFeet * 0.3048, timestamp: ts });
  }

  if (points.length < 2) {
      return { direct: 0, flown: 0, date: flightDate, durationMinutes: 0 };
  }

  // --- ZEIT BERECHNUNG ---
  // Wir suchen den ersten und letzten Punkt, bei dem das Flugzeug "in der Luft" war (> 50m Höhe als Puffer)
  let startTime = 0;
  let endTime = 0;

  // Pfad-Berechnung & Zeitfindung
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    if (p1.alt > 0 && p2.alt > 0) {
      // Wenn wir noch keine Startzeit haben, ist dies der Start (Takeoff)
      if (startTime === 0) startTime = p1.timestamp;
      // Wir aktualisieren das Ende immer weiter, solange wir in der Luft sind
      endTime = p2.timestamp;

      const distH = getSurfaceDistance(p1.lat, p1.lon, p2.lat, p2.lon);
      const distV = Math.abs(p2.alt - p1.alt);
      const dist3D = Math.sqrt(distH * distH + distV * distV);

      if (dist3D > 5) totalDistanceFlown += dist3D;
    }
  }

  // Dauer in Minuten
  let durationMinutes = 0;
  if (startTime > 0 && endTime > startTime) {
      durationMinutes = Math.round((endTime - startTime) / 60);
  }

  const start = points[0];
  const end = points[points.length - 1];
  const directDistance = getSurfaceDistance(start.lat, start.lon, end.lat, end.lon);

  return {
    direct: Math.round(directDistance),
    flown: Math.round(totalDistanceFlown),
    date: flightDate,
    durationMinutes 
  };
};