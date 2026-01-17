import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

export default function StartScreen() {
  const router = useRouter();

  return (
    // Wir brauchen keine <View> Boxen mehr für die Drittel.
    // Der Pressable selbst ist jetzt der Container, der alles zentriert.
    <Pressable style={styles.container} onPress={() => router.replace('/(tabs)')}>
      
      <Text style={styles.titleText}>ODOMILE</Text>

    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,                // 1. Nimm den ganzen Bildschirmplatz
    backgroundColor: '#fff', // 2. Weißer Hintergrund
    
    // HIER PASSIERT DIE MAGIE:
    justifyContent: 'center', // 3. Schiebe den Inhalt vertikal in die Mitte
    alignItems: 'center',     // 4. Schiebe den Inhalt horizontal in die Mitte
  },
  titleText: {
    fontSize: 40,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#333',
  },
  // Die Styles 'topThird' und 'bottomTwoThirds' kannst du löschen, 
  // da wir sie oben im HTML-Teil (JSX) entfernt haben.
});