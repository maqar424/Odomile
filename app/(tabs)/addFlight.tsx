import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Database from '@/services/Database';
import * as FileProcessor from '@/services/FileProcessor';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function AddFlightScreen() {
  const router = useRouter();
  
  const [csvFile, setCsvFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [kmlFile, setKmlFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  
  const [depCode, setDepCode] = useState('');
  const [arrCode, setArrCode] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAirportChange = (text: string, setter: (val: string) => void) => {
    setter(text.toUpperCase());
  };

  const pickFile = async (type: 'csv' | 'kml') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const file = result.assets[0];
      const fileName = file.name.toLowerCase();

      if (type === 'csv' && !fileName.endsWith('.csv')) {
        Alert.alert("Falsches Format", "Bitte .csv wählen.");
        return;
      }
      if (type === 'kml' && !fileName.endsWith('.kml')) {
        Alert.alert("Falsches Format", "Bitte .kml wählen.");
        return;
      }

      if (type === 'csv') setCsvFile(file);
      else setKmlFile(file);

    } catch (err) {
      Alert.alert("Fehler", "Datei konnte nicht geöffnet werden.");
    }
  };

  const handleImport = async () => {
    if (!csvFile || !kmlFile) {
      Alert.alert("Info", "Bitte erst CSV und KML Datei auswählen.");
      return;
    }
    if (depCode.length < 3 || arrCode.length < 3) {
      Alert.alert("Info", "Bitte Start- und Zielkürzel eingeben (mind. 3 Buchstaben).");
      return;
    }

    setIsProcessing(true);

    try {
      const timestamp = Date.now();
      const safeCsvName = `flight_${timestamp}.csv`;
      const safeKmlName = `flight_${timestamp}.kml`;

      // 1. Dateien sichern
      const savedCsvPath = await FileProcessor.saveFileToAppStorage(csvFile.uri, safeCsvName);
      const savedKmlPath = await FileProcessor.saveFileToAppStorage(kmlFile.uri, safeKmlName);

      // 2. CSV Daten laden
      const flightData = await FileProcessor.processFlightData(savedCsvPath);

      // 3. KML Daten laden
      const metadata = await FileProcessor.extractMetadataFromKml(savedKmlPath);

      // 4. Daten vorbereiten
      const dateToSave = flightData.date ? flightData.date : new Date().toISOString();
      const flightNrToSave = metadata.flightNr || 'Imported';
      const airlineToSave = metadata.airline || 'Unknown Airline';
      
      // NEU: Modell und Reg
      const modelToSave = metadata.planeModel || '-'; 
      const regToSave = metadata.registration || '-';

      // 5. In Datenbank speichern (Reihenfolge muss exakt zu Database.ts passen!)
      Database.addFlight(
        dateToSave,            
        depCode,                  
        arrCode,                  
        airlineToSave,            
        flightNrToSave,
        modelToSave,            // <--- NEU
        regToSave,              // <--- NEU
        flightData.direct,
        flightData.flown,
        flightData.durationMinutes,
        savedCsvPath,
        savedKmlPath,
        metadata.fr24Url
      );

      Alert.alert("Erfolg", `Flug ${flightNrToSave} gespeichert!`, [
        { text: "OK", onPress: () => {
            setCsvFile(null);
            setKmlFile(null);
            setDepCode('');
            setArrCode('');
            router.replace('/'); 
        }}
      ]);

    } catch (error: any) {
      console.error(error);
      Alert.alert("Fehler", "Import fehlgeschlagen: " + error?.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ThemedText type="title" style={styles.title}>Add New Flight</ThemedText>

      <View style={styles.card}>
        <ThemedText type="subtitle" style={styles.cardTitle}>Import Flight Data</ThemedText>
        
        {/* CSV Auswahl */}
        <TouchableOpacity 
          style={[styles.fileButton, csvFile && styles.fileButtonSelected]} 
          onPress={() => pickFile('csv')}
        >
          <IconSymbol name="doc.text" size={24} color={csvFile ? "white" : "#0a7ea4"} />
          <View style={{marginLeft: 10, flex: 1}}>
            <Text style={[styles.fileButtonText, csvFile && {color: 'white'}]}>
              {csvFile ? "CSV ausgewählt" : "CSV Datei wählen"}
            </Text>
            {csvFile && <Text style={{color: '#eee', fontSize: 10}}>{csvFile.name}</Text>}
          </View>
          {csvFile && <IconSymbol name="checkmark.circle.fill" size={20} color="white" />}
        </TouchableOpacity>

        {/* KML Auswahl */}
        <TouchableOpacity 
          style={[styles.fileButton, kmlFile && styles.fileButtonSelected]} 
          onPress={() => pickFile('kml')}
        >
          <IconSymbol name="map" size={24} color={kmlFile ? "white" : "#0a7ea4"} />
          <View style={{marginLeft: 10, flex: 1}}>
            <Text style={[styles.fileButtonText, kmlFile && {color: 'white'}]}>
              {kmlFile ? "KML ausgewählt" : "KML Datei wählen"}
            </Text>
            {kmlFile && <Text style={{color: '#eee', fontSize: 10}}>{kmlFile.name}</Text>}
          </View>
          {kmlFile && <IconSymbol name="checkmark.circle.fill" size={20} color="white" />}
        </TouchableOpacity>

        <View style={styles.separator} />

        {/* Inputs */}
        <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
                <Text style={styles.label}>Departure (z.B. FRA)</Text>
                <TextInput 
                    style={styles.input} 
                    placeholder="DEP" 
                    value={depCode}
                    onChangeText={(t) => handleAirportChange(t, setDepCode)}
                    maxLength={4}
                    autoCapitalize="characters"
                    autoCorrect={false}
                />
            </View>

            <View style={{justifyContent:'flex-end', paddingBottom: 12}}>
                 <IconSymbol name="paperplane.fill" size={20} color="#ccc" />
            </View>

            <View style={styles.inputContainer}>
                <Text style={styles.label}>Arrival (z.B. JFK)</Text>
                <TextInput 
                    style={styles.input} 
                    placeholder="ARR" 
                    value={arrCode}
                    onChangeText={(t) => handleAirportChange(t, setArrCode)}
                    maxLength={4}
                    autoCapitalize="characters"
                    autoCorrect={false}
                />
            </View>
        </View>

        {/* Import Button */}
        <TouchableOpacity 
          style={[styles.importButton, (!csvFile || !kmlFile) && styles.importButtonDisabled]}
          onPress={handleImport}
          disabled={!csvFile || !kmlFile || isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.importButtonText}>Flight Importieren</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 20, paddingTop: 60 },
  title: { marginBottom: 20, textAlign: 'center' },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTitle: { marginBottom: 15 },
  
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  fileButtonSelected: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  fileButtonText: { fontWeight: '600', color: '#0a7ea4' },
  
  separator: { height: 1, backgroundColor: '#eee', marginVertical: 15 },

  inputRow: { flexDirection: 'row', justifyContent: 'space-between' },
  inputContainer: { flex: 0.42 },
  label: { fontSize: 12, color: '#666', marginBottom: 5, fontWeight:'600' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#f9f9f9',
  },

  importButton: { backgroundColor: '#0a7ea4', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  importButtonDisabled: { backgroundColor: '#ccc' },
  importButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});