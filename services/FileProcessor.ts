import * as FileSystem from 'expo-file-system/legacy';

// ---------------------------------------------------------
// KONFIGURATION
// ---------------------------------------------------------
const fsAny = FileSystem as any;
const R = 6371000; // Erdradius in Metern

const docDir = fsAny.documentDirectory || '';
const FLIGHT_DATA_DIR = docDir + 'my_flight_logs/';

const toRad = (value: number) => (value * Math.PI) / 180;

// Haversine Formel
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

// Ordner erstellen
const ensureDirExists = async () => {
  if (!fsAny.documentDirectory) return;
  const dirInfo = await FileSystem.getInfoAsync(FLIGHT_DATA_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(FLIGHT_DATA_DIR, { intermediates: true });
  }
};

// ---------------------------------------------------------
// DATEI MANAGEMENT
// ---------------------------------------------------------

export const saveFileToAppStorage = async (sourceUri: string, fileName: string): Promise<string> => {
  await ensureDirExists();
  const destinationUri = FLIGHT_DATA_DIR + fileName;
  
  try {
    await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
  } catch (error) {
    try {
        const content = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.writeAsStringAsync(destinationUri, content, { encoding: FileSystem.EncodingType.Base64 });
    } catch (writeError) {
        throw writeError;
    }
  }
  return destinationUri;
};

// ---------------------------------------------------------
// KML PARSING (METADATEN)
// ---------------------------------------------------------

export interface KmlMetadata {
  fr24Url: string;
  flightNr: string;
  airline: string;
  planeModel: string;
  registration: string;
}

export const extractMetadataFromKml = async (kmlUri: string): Promise<KmlMetadata> => {
  try {
    const content = await FileSystem.readAsStringAsync(kmlUri);
    
    // 1. FR24 Link suchen
    const linkMatch = content.match(/href="(https?:\/\/www\.flightradar24\.com\/flight\/[^"]+)"/);
    
    // 2. Flugnummer
    const nameMatch = content.match(/<name>([A-Z0-9]+\/[A-Z0-9]+)<\/name>/); 
    let flightNr = '';
    if (nameMatch) {
        flightNr = nameMatch[1].split('/')[0]; 
    }

    // 3. Airline (oft nach <br/>)
    const airlineMatch = content.match(/<br\/>([A-Za-z0-9 ]+)<\/div>/); 
    let airline = '';
    if (airlineMatch) {
        airline = airlineMatch[1].trim();
    }

    // 4. Flugzeug Modell suchen
    let planeModel = '';
    const modelMatch = content.match(/Aircraft[\s\S]*?<br>\s*<span[^>]*>([\s\S]*?)<\/span>/i);
    if (modelMatch) {
        planeModel = modelMatch[1].trim();
    }

    // 5. Registration suchen
    let registration = '';
    const regMatch = content.match(/Registration<br>\s*<span[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i);
    if (regMatch) {
        registration = regMatch[1].trim();
    }

    return {
      fr24Url: linkMatch ? linkMatch[1] : '',
      flightNr,
      airline,
      planeModel,
      registration
    };

  } catch (error) {
    console.warn("KML Parsing Fehler:", error);
    return { fr24Url: '', flightNr: '', airline: '', planeModel: '', registration: '' };
  }
};

// ---------------------------------------------------------
// CSV PARSING & ALGORITHMUS
// ---------------------------------------------------------

export interface FlightData {
  direct: number;
  flown: number;
  date: string;
  durationMinutes: number;
}

interface TrackPoint {
  lat: number;
  lon: number;
  alt: number; 
  timestamp: number; 
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

    const timestampRaw = parts[0]; 
    if (!flightDate && parts[1]) {
        flightDate = parts[1]; 
    }

    const latRaw = parts[3].replace('"', '');
    const lonRaw = parts[4].replace('"', '');
    const altRaw = parts[5]; 

    const lat = parseFloat(latRaw);
    const lon = parseFloat(lonRaw);
    const altFeet = parseFloat(altRaw);
    const ts = parseInt(timestampRaw, 10); 

    if (isNaN(lat) || isNaN(lon)) continue;

    points.push({ lat, lon, alt: altFeet * 0.3048, timestamp: ts });
  }

  if (points.length < 2) {
      return { direct: 0, flown: 0, date: flightDate, durationMinutes: 0 };
  }

  let startTime = 0;
  let endTime = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    if (p1.alt > 0 && p2.alt > 0) {
      if (startTime === 0) startTime = p1.timestamp;
      endTime = p2.timestamp;

      const distH = getSurfaceDistance(p1.lat, p1.lon, p2.lat, p2.lon);
      const distV = Math.abs(p2.alt - p1.alt);
      const dist3D = Math.sqrt(distH * distH + distV * distV);

      if (dist3D > 5) {
        totalDistanceFlown += dist3D;
      }
    }
  }

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

// ---------------------------------------------------------
// GLOBUS DATA LOADER (NEU HINZUGEFÜGT)
// ---------------------------------------------------------

// ... (restlicher Code oben bleibt gleich) ...

// GLOBUS DATA LOADER
export interface GlobePath {
  coords: [number, number, number][]; // [lat, lon, alt]
  label: string;
  color: string;
}

export const loadAllFlightPaths = async (flights: any[]): Promise<GlobePath[]> => {
  const paths: GlobePath[] = [];

  for (const flight of flights) {
    if (!flight.csv_path) continue;

    try {
      const content = await FileSystem.readAsStringAsync(flight.csv_path);
      const lines = content.split('\n');
      
      const coords: [number, number, number][] = [];
      
      // Downsampling: Nur jeden 20. Punkt
      const STEP = 20; 

      for (let i = 1; i < lines.length; i += STEP) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length < 6) continue;

        const lat = parseFloat(parts[3].replace('"', ''));
        const lon = parseFloat(parts[4].replace('"', ''));
        const altFeet = parseFloat(parts[5]);
        
        // HIER WAR DIE ÄNDERUNG:
        // Alt: * 0.4 (Rakete)
        // Neu: * 0.07 (Flugzeug - sichtbar, aber flach)
        const altNormalized = (altFeet / 45000) * 0.07; 

        if (!isNaN(lat) && !isNaN(lon)) {
           coords.push([lat, lon, Math.max(0, altNormalized)]);
        }
      }

      if (coords.length > 0) {
        paths.push({
          coords: coords,
          label: `${flight.departed_code} -> ${flight.arrived_code}`,
          color: 'rgba(0, 255, 255, 0.8)' // Cyan
        });
      }

    } catch (e) {
      console.warn("Konnte Pfad nicht laden für:", flight.id, e);
    }
  }

  return paths;
};