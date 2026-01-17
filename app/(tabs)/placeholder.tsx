import { StyleSheet, Text, View } from 'react-native';

// WICHTIG: Das "export default" ist zwingend nötig!
export default function PlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hier ist der Placeholder Tab</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});