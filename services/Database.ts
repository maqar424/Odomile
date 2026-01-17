import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('flights.db');

export interface Flight {
  id: number;
  date: string;
  departed_code: string;
  arrived_code: string;
  airline: string;
  flight_number: string;
  // NEUE FELDER
  plane_model: string;
  registration: string;
  // -----------
  distance_direct_meters: number;
  distance_flown_meters: number;
  duration_minutes: number;
  csv_path: string;
  kml_path: string;
  fr24_url: string;
  chronological_id?: number; 
}

export const initDatabase = () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS flights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL, 
      departed_code TEXT NOT NULL,
      arrived_code TEXT NOT NULL,
      airline TEXT,
      flight_number TEXT,
      plane_model TEXT,     -- Neu
      registration TEXT,    -- Neu
      distance_direct_meters INTEGER,
      distance_flown_meters INTEGER,
      duration_minutes INTEGER,
      csv_path TEXT,
      kml_path TEXT,
      fr24_url TEXT
    );
  `);
};

export const addFlight = (
  date: string,
  departed: string,
  arrived: string,
  airline: string,
  flightNr: string,
  // NEUE PARAMETER
  planeModel: string,
  registration: string,
  // --------------
  distDirect: number,
  distFlown: number,
  duration: number,
  csvPath: string,
  kmlPath: string,
  fr24Url: string
) => {
  initDatabase(); 

  const statement = db.prepareSync(
    `INSERT INTO flights (date, departed_code, arrived_code, airline, flight_number, plane_model, registration, distance_direct_meters, distance_flown_meters, duration_minutes, csv_path, kml_path, fr24_url) 
     VALUES ($date, $departed, $arrived, $airline, $flightNr, $model, $reg, $distDirect, $distFlown, $duration, $csvPath, $kmlPath, $fr24Url)`
  );

  try {
    statement.executeSync({
      $date: date,
      $departed: departed,
      $arrived: arrived,
      $airline: airline,
      $flightNr: flightNr,
      $model: planeModel,    // Neu
      $reg: registration,    // Neu
      $distDirect: distDirect,
      $distFlown: distFlown,
      $duration: duration,
      $csvPath: csvPath,
      $kmlPath: kmlPath,
      $fr24Url: fr24Url
    });
  } finally {
    statement.finalizeSync();
  }
};

// ... Rest (getFlights, deleteFlight, clearDatabase) bleibt gleich ...
// Kopiere hier einfach die bestehenden Funktionen rein oder lass sie so.
export const getFlights = (): Flight[] => {
  try {
    const query = `
      SELECT *, 
      ROW_NUMBER() OVER (ORDER BY date ASC) as chronological_id 
      FROM flights 
      ORDER BY date DESC
    `;
    const allRows = db.getAllSync(query);
    return allRows as Flight[];
  } catch (e) {
    return [];
  }
};

export const deleteFlight = (id: number) => {
  db.execSync(`DELETE FROM flights WHERE id = ${id}`);
};

export const clearDatabase = () => {
  db.execSync('DROP TABLE IF EXISTS flights');
  initDatabase();
};