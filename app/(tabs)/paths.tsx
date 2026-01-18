import * as Database from '@/services/Database';
import * as FileProcessor from '@/services/FileProcessor';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

// SD: Standard Textur (schnell)
const TEXTURE_SD = 'https://unpkg.com/three-globe/example/img/earth-day.jpg';

// HD: Hohe Auflösung + wir nutzen zusätzlich eine Bump-Map für 3D-Effekt
const TEXTURE_HD = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'; 
// (Blue Marble wirkt oft schärfer als Earth-Day in 4K wegen des Kontrasts, wir nutzen hier die High-Res Version)

const BUMP_MAP_URL = 'https://unpkg.com/three-globe/example/img/earth-topology.png';

export default function PathsScreen() {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [quality, setQuality] = useState<'SD' | 'HD'>('SD'); 

  useFocusEffect(
    useCallback(() => {
      loadGlobeData();
    }, [quality])
  );

  const loadGlobeData = async () => {
    setLoading(true);
    
    const flights = Database.getFlights();
    const paths = await FileProcessor.loadAllFlightPaths(flights);
    
    const currentTexture = quality === 'HD' ? TEXTURE_HD : TEXTURE_SD;
    // Wir übergeben jetzt auch, ob HD aktiv ist (für Bump Map und PixelRatio)
    const html = generateGlobeHtml(paths, currentTexture, quality === 'HD');
    
    setHtmlContent(html);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0a7ea4" />
          <Text style={{marginTop: 10, color: '#666'}}>
             Lade {quality} Auflösung...
          </Text>
        </View>
      ) : (
        <WebView
            originWhitelist={['*']}
            source={{ html: htmlContent || '' }}
            style={styles.webview}
            onMessage={(event) => console.log("WEBVIEW:", event.nativeEvent.data)}
            javaScriptEnabled={true}
            domStorageEnabled={true}
        />
      )}

      {/* HUD MENU */}
      <SafeAreaView style={styles.menuContainer} edges={['top']}>
        <View style={styles.toggleWrapper}>
            <TouchableOpacity 
                style={[styles.toggleBtn, quality === 'SD' && styles.toggleBtnActive]} 
                onPress={() => setQuality('SD')}
            >
                <Text style={[styles.toggleText, quality === 'SD' && styles.toggleTextActive]}>Eco</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
                style={[styles.toggleBtn, quality === 'HD' && styles.toggleBtnActive]} 
                onPress={() => setQuality('HD')}
            >
                <Text style={[styles.toggleText, quality === 'HD' && styles.toggleTextActive]}>4K</Text>
            </TouchableOpacity>
        </View>
      </SafeAreaView>

    </View>
  );
}

// --- HTML GENERATOR ---
const generateGlobeHtml = (paths: FileProcessor.GlobePath[], textureUrl: string, isHD: boolean) => `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <style> 
        body { margin: 0; padding: 0; background-color: #000; overflow: hidden; width: 100vw; height: 100vh; } 
        #globeViz { width: 100%; height: 100%; }
    </style>
    <script src="https://unpkg.com/globe.gl"></script>
  </head>
  <body>
    <div id="globeViz"></div>
    <script>
      try {
          const FLIGHT_DATA = ${JSON.stringify(paths)};
          const IS_HD = ${isHD};
          const BUMP_URL = '${BUMP_MAP_URL}';

          const world = Globe()
            (document.getElementById('globeViz'))
            
            .globeImageUrl('${textureUrl}')
            .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
            
            // NUR IN HD: Topologie hinzufügen (macht Berge sichtbar -> wirkt schärfer)
            ${isHD ? `.bumpImageUrl(BUMP_URL)` : ''}
            
            .pathsData(FLIGHT_DATA)
            .pathPoints(d => d.coords)
            .pathPointLat(p => p[0])
            .pathPointLng(p => p[1])
            .pathPointAlt(p => p[2])
            .pathColor(() => '#FF00FF') 
            .pathStroke(2)
            .pathDashLength(0.5)
            .pathDashGap(0.05)
            .pathDashAnimateTime(2000); 

          world.pointOfView({ lat: 50, lng: 10, altitude: 2.0 });
          world.controls().autoRotate = false;
          world.controls().minDistance = 101; 
          world.controls().maxDistance = 1000;

          // --- DER ENTSCHEIDENDE FIX FÜR SCHÄRFE ---
          // Wir zwingen den Renderer, die echte Pixel-Dichte des Handys zu nutzen (Retina/High-DPI).
          // Das kostet Leistung, sieht aber knackig aus.
          if (IS_HD) {
              world.renderer().setPixelRatio(window.devicePixelRatio);
          } else {
              // Im Eco Modus sparen wir Batterie mit Standard-Auflösung
              world.renderer().setPixelRatio(1);
          }

      } catch (e) {
          if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage("ERR: " + e.message);
      }
    </script>
  </body>
</html>
`;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent', 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111' 
  },
  menuContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 10,
      pointerEvents: 'box-none', 
  },
  toggleWrapper: {
      flexDirection: 'row',
      backgroundColor: 'rgba(30, 41, 59, 0.8)', 
      borderRadius: 20,
      padding: 4,
      marginTop: 10,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
  },
  toggleBtn: {
      paddingVertical: 6,
      paddingHorizontal: 16,
      borderRadius: 16,
  },
  toggleBtnActive: {
      backgroundColor: '#0a7ea4', 
  },
  toggleText: {
      color: '#94a3b8',
      fontWeight: '600',
      fontSize: 12,
  },
  toggleTextActive: {
      color: 'white',
      fontWeight: 'bold',
  },
});