import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Database from '@/services/Database';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, LayoutAnimation, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FlightLogScreen() {
  const router = useRouter();
  const [flights, setFlights] = useState<Database.Flight[]>([]);
  const [totalNM, setTotalNM] = useState(0); 
  const [totalHours, setTotalHours] = useState(0); 
  
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = () => {

    // --- HIER EINFÜGEN ---
    // Diese Zeile löscht die DB bei jedem Laden.
    // Einmal speichern, App neu laden lassen, dann diese Zeile wieder löschen!
    Database.clearDatabase(); 
    // ---------------------
    const data = Database.getFlights();
    setFlights(data);

    const totalMeters = data.reduce((sum, flight) => sum + (flight.distance_flown_meters || 0), 0);
    const nm = Math.round(totalMeters / 1852);
    setTotalNM(nm);

    const totalMins = data.reduce((sum, flight) => sum + (flight.duration_minutes || 0), 0);
    setTotalHours(Math.round(totalMins / 60));
  };

  const handleDelete = (id: number) => {
    Alert.alert("Löschen", "Diesen Flug wirklich löschen?", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Löschen", style: "destructive", onPress: () => {
          Database.deleteFlight(id);
          if (expandedId === id) setExpandedId(null);
          loadData(); 
      }}
    ]);
  };

  const handleEdit = (flight: Database.Flight) => {
    Alert.alert("Info", "Bearbeitungsmodus kommt bald. Du wirst zum Import-Screen geleitet.", [
        { text: "OK", onPress: () => router.push('/addFlight') }
    ]);
  };

  const handleToggleExpand = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const handleOpenLink = async (url: string) => {
    if (!url) return;
    try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            Alert.alert("Fehler", "Link kann nicht geöffnet werden: " + url);
        }
    } catch (err) {
        console.error(err);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      if (dateString.includes('.')) return dateString;
      const date = new Date(dateString);
      return date.toLocaleDateString('de-DE');
    } catch (e) { return dateString; }
  };

  const formatTimeColumn = (mins: number) => {
      if (!mins) return '-';
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} h`;
  };

  const formatDuration = (mins: number) => {
      if (!mins) return '-';
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h > 0) return `${h}h ${m}min`;
      return `${m}min`;
  };

  // --- RENDERING ---
  const renderItem = ({ item }: { item: Database.Flight }) => {
    const isExpanded = expandedId === item.id;
    const distNM = Math.round(item.distance_flown_meters / 1852); 
    const directNM = Math.round(item.distance_direct_meters / 1852);
    const detour = item.distance_direct_meters > 0 
        ? Math.round(((item.distance_flown_meters / item.distance_direct_meters) - 1) * 100) 
        : 0;

    return (
      <View style={styles.rowContainer}>
        {/* HAUPTZEILE (Klickbar) */}
        <TouchableOpacity style={styles.row} onPress={() => handleToggleExpand(item.id)}>
          <Text style={[styles.cell, { flex: 0.35, color: '#888', fontSize: 12 }]}>{item.chronological_id}</Text>
          <Text style={[styles.cell, { flex: 1.1 }]}>{formatDate(item.date)}</Text>
          <View style={{ flex: 1.4, flexDirection: 'row', alignItems: 'center' }}>
             <Text style={[styles.cell, { fontWeight: '700' }]}>{item.departed_code}</Text>
             <Text style={{ marginHorizontal: 4, color: '#aaa', fontSize: 12 }}>➝</Text>
             <Text style={[styles.cell, { fontWeight: '700' }]}>{item.arrived_code}</Text>
          </View>
          <Text style={[styles.cell, { flex: 1.0, color: '#333', fontWeight:'700' }]}>{item.flight_number}</Text>
          <Text style={[styles.cell, { flex: 0.8, fontSize: 12 }]}>{distNM > 0 ? `${distNM} nm` : '-'}</Text>
          <Text style={[styles.cell, { flex: 0.9, fontSize: 12, textAlign: 'right' }]}>
            {formatTimeColumn(item.duration_minutes)}
          </Text>
        </TouchableOpacity>

        {/* DROPDOWN BEREICH */}
        {isExpanded && (
          <View style={styles.dropdown}>
            
            {/* ZEILE 1: Airline | Registration | Model */}
            <View style={styles.infoRow}>
                <View style={[styles.infoBlock, { flex: 1 }]}>
                    <Text style={styles.infoLabel}>Airline</Text>
                    <Text style={styles.infoValue} numberOfLines={1}>{item.airline}</Text>
                </View>
                <View style={[styles.infoBlock, { flex: 0.8 }]}>
                    <Text style={styles.infoLabel}>Registration</Text>
                    <Text style={styles.infoValue}>{item.registration || '-'}</Text>
                </View>
                <View style={[styles.infoBlock, { flex: 1.2 }]}>
                    <Text style={styles.infoLabel}>Model</Text>
                    <Text style={styles.infoValue} numberOfLines={1} adjustsFontSizeToFit>{item.plane_model || '-'}</Text>
                </View>
            </View>

            {/* ZEILE 2: Time | Effizienz | Link */}
            <View style={styles.infoRow}>
                <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>Flight Time</Text>
                    <Text style={styles.infoValue}>{formatDuration(item.duration_minutes)}</Text>
                </View>
                <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>Effizienz</Text>
                    <Text style={styles.infoValue}>{directNM} nm Direct (+{detour}%)</Text>
                </View>
                {item.fr24_url ? (
                    <View style={styles.infoBlock}>
                         <Text style={styles.infoLabel}>FlightRadar24</Text>
                         <TouchableOpacity onPress={() => handleOpenLink(item.fr24_url)}>
                            <Text style={[styles.infoValue, {color: 'blue', textDecorationLine:'underline'}]}>Open Link</Text>
                         </TouchableOpacity>
                    </View>
                ) : <View style={styles.infoBlock} />} 
            </View>

            {/* BUTTONS */}
            <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#64748b'}]} onPress={() => handleEdit(item)}>
                    <IconSymbol name="pencil" size={16} color="white" />
                    <Text style={styles.actionBtnText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#ef4444'}]} onPress={() => handleDelete(item.id)}>
                    <IconSymbol name="trash.fill" size={16} color="white" />
                    <Text style={styles.actionBtnText}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#10b981'}]} onPress={() => router.push('/paths')}>
                    <IconSymbol name="map.fill" size={16} color="white" />
                    <Text style={styles.actionBtnText}>Path</Text>
                </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* DASHBOARD */}
      <View style={styles.topSection}>
        <View style={{position: 'absolute', right: 20, top: 15}}>
             <TouchableOpacity onPress={() => {
                Alert.alert("Reset", "Datenbank komplett löschen?", [{text:"Ja", style:'destructive', onPress:() => { Database.clearDatabase(); loadData(); }}]);
            }}>
               <IconSymbol name="trash" size={20} color="#cbd5e1" />
             </TouchableOpacity>
        </View>

        <ThemedText type="subtitle" style={styles.odoTitle}>Odomile</ThemedText>
        
        <View style={styles.odometerBox}>
            <View style={styles.odometerRow}>
                <Text style={styles.odometerNumber}>{totalNM.toString()}</Text>
                <Text style={styles.odometerUnit}>NM</Text>
            </View>
            <View style={styles.odometerDivider} />
            <View style={styles.odometerRow}>
                <Text style={[styles.odometerNumber, {fontSize: 22}]}>{totalHours.toString()}</Text>
                <Text style={[styles.odometerUnit, {fontSize: 12, marginTop: 4}]}>H</Text>
            </View>
        </View>
      </View>

      {/* FLIGHT LOG LISTE */}
      <View style={styles.logSection}>
        <View style={styles.logHeaderContainer}>
            <ThemedText type="subtitle">
                Flight Log - {flights.length} Entries
            </ThemedText>
        </View>
        
        {/* HEADER ZEILE */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, { flex: 0.35 }]}>#</Text>
          <Text style={[styles.headerCell, { flex: 1.1 }]}>Datum</Text>
          <Text style={[styles.headerCell, { flex: 1.4 }]}>Leg</Text> 
          <Text style={[styles.headerCell, { flex: 1.0 }]}>Flug Nr.</Text>
          <Text style={[styles.headerCell, { flex: 0.8 }]}>Dist.</Text>
          <Text style={[styles.headerCell, { flex: 0.9, textAlign: 'right' }]}>Time</Text>
        </View>

        <FlatList
          data={flights}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    // paddingTop wird durch SafeAreaView gesteuert
  },
  
  // DASHBOARD
  topSection: {
    paddingTop: 20, 
    paddingBottom: 40, 
    backgroundColor: '#f1f5f9', 
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  odoTitle: {
      color: '#64748b',
      textTransform: 'uppercase',
      fontSize: 14,
      letterSpacing: 2,
      fontWeight: '600',
      marginBottom: 10,
  },
  odometerBox: {
      flexDirection: 'column', 
      backgroundColor: '#e2e8f0',
      paddingVertical: 10,
      paddingHorizontal: 15, 
      borderRadius: 8,
      borderWidth: 2,
      borderColor: '#cbd5e1',
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
      alignSelf: 'stretch', 
      marginHorizontal: 50, 
      marginBottom: 20,
  },
  odometerRow: {
      flexDirection: 'row',
      alignItems: 'baseline', 
      width: '100%', 
      paddingHorizontal: 10,
  },
  odometerNumber: {
      flex: 1, 
      textAlign: 'right', 
      fontSize: 36,
      fontWeight: 'bold',
      color: '#0f172a',   
      fontVariant: ['tabular-nums'], 
      marginRight: 8, 
  },
  odometerUnit: {
      width: 35, 
      textAlign: 'left', 
      fontSize: 16,
      fontWeight: '600',
      color: '#475569',
  },
  odometerDivider: {
      height: 1,
      width: '100%', 
      backgroundColor: '#cbd5e1', 
      marginVertical: 4,
  },

  // LOG SECTION
  logSection: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -30, 
    paddingTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
    overflow: 'hidden',
  },
  logHeaderContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f8f9fa',
  },
  headerCell: { fontSize: 11, fontWeight: 'bold', color: '#666', textTransform: 'uppercase' },
  list: { flex: 1 },
  
  rowContainer: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'white',
  },
  cell: { fontSize: 13, color: '#333' },

  // Dropdown
  dropdown: { backgroundColor: '#f8fafc', padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  infoBlock: { flex: 1 }, // Standard flex, kann inline überschrieben werden
  infoLabel: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 },
  infoValue: { fontSize: 13, fontWeight: '500', color: '#334155' },
  
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', gap: 10 },
  actionBtn: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16,
      borderRadius: 8, flex: 1, justifyContent: 'center',
  },
  actionBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12, marginLeft: 6 },
});