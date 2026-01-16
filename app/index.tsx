import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function StartScreen() {
  const router = useRouter();

  return (
    // KORREKTUR: Wir nutzen '/(tabs)', da Expo diesen Pfad bereits kennt.
    <Pressable style={styles.container} onPress={() => router.replace('/(tabs)')}>
      
      <View style={styles.topThird}>
        <Text style={styles.titleText}>ODOMILE</Text>
      </View>

      <View style={styles.bottomTwoThirds} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topThird: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomTwoThirds: { flex: 2 },
  titleText: {
    fontSize: 40,
    fontWeight: 'bold',
    letterSpacing: 2,
    color: '#333',
  },
});