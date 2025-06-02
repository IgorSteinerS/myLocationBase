import { useState, useEffect, useCallback } from "react";
import { FlatList, StyleSheet, View, Alert } from "react-native"; // Import Alert for user feedback
import {
  Appbar,
  Button,
  List,
  PaperProvider,
  Switch,
  Text,
  MD3LightTheme as DefaultTheme,
} from "react-native-paper";
import myColors from "./assets/colors.json";
import myColorsDark from "./assets/colorsDark.json";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('locations.db'); 

export default function App() {
  const [isSwitchOn, setIsSwitchOn] = useState(false); // variável para controle do darkMode
  const [isLoading, setIsLoading] = useState(false); // variável para controle do loading do button
  const [locations, setLocations] = useState(null); // variável para armazenar as localizações
  // Carrega tema default da lib RN PAPER com customização das cores. Para customizar o tema, veja:
  // https://callstack.github.io/react-native-paper/docs/guides/theming/#creating-dynamic-theme-colors
  const [theme, setTheme] = useState({
    ...DefaultTheme,
    myOwnProperty: true,
    colors: myColors.colors,
  });

  // load darkMode from AsyncStorage
  async function loadDarkMode() {
  try {
    const isDarkMode = await AsyncStorage.getItem('darkMode');
    if (isDarkMode !== null) {
      setIsSwitchOn(JSON.parse(isDarkMode));
    }
  } catch (error) {
    console.error('Failed to load dark mode.');
  }
}

  async function onToggleSwitch() {
    const newValue = !isSwitchOn;
    setIsSwitchOn(newValue);
    try {
      await AsyncStorage.setItem('darkMode', JSON.stringify(newValue));
    } catch (error) {
      console.error('Failed to save dark mode.');
    }
  }

  async function getLocation() {
    setIsLoading(true); // Indica que a operação está em andamento
    console.log('Iniciando captura de localização...');

    try {
        console.log('Solicitando permissão de localização...');
        let { status } = await Location.requestForegroundPermissionsAsync();
        console.log('Status da permissão:', status);
      if (status !== 'granted') {
        Alert.alert(
          'Permissão de Localização',
          'Permissão para acessar a localização foi negada. Por favor, habilite-a nas configurações do seu dispositivo.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('Obtendo posição atual...');
      let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      console.log('Localização obtida:', location);
      const latitude = location.coords.latitude;
      const longitude = location.coords.longitude;

      console.log(`Latitude: ${latitude}, Longitude: ${longitude}`);

      console.log('Salvando localização...');
      await saveLocation(latitude, longitude);
      console.log('Localização salva no DB.');

      console.log('Recarregando localizações da lista...');
      await loadLocations(); 
      console.log('Localizações recarregadas.');
      
    } catch (error) {
      console.error('Erro geral na função getLocation:', error);
      Alert.alert('Erro', `Não foi possível capturar a localização. Detalhes: ${error.message || error}. Tente novamente.`);
    } finally {
      setIsLoading(false); // Finaliza a operação, independentemente do sucesso ou falha
      console.log('Finalizando captura de localização. isLoading:', isLoading);
    }
  }


  async function createTable() {
    try {
      // Para criar tabelas, 'execSync' é ideal pois não retorna dados específicos
      await db.withTransactionAsync(() => { // Não passamos 'tx' aqui
        db.execSync('CREATE TABLE IF NOT EXISTS locations (id INTEGER PRIMARY KEY AUTOINCREMENT, latitude REAL, longitude REAL);');
      });
      console.log('Tabela de localizações criada ou já existe!');
    } catch (error) {
      console.error('Erro ao criar tabela:', error);
      throw error;
    }
  }

  async function saveLocation(latitude, longitude) {
    try {
      let insertedId; // Variável para armazenar o ID
      await db.withTransactionAsync(() => {
        const result = db.runSync('INSERT INTO locations (latitude, longitude) values (?, ?);', [latitude, longitude]);
        insertedId = result.lastInsertRowId; // Atribui o ID à variável externa
      });
      console.log('Localização salva, ID:', insertedId);
    } catch (error) {
      console.error('Erro ao salvar localização:', error);
      throw error;
    }
  }



  async function loadLocations() {
    try {
      let fetchedData = []; // Variável para armazenar os dados carregados
      await db.withTransactionAsync(() => {
        fetchedData = db.getAllSync('SELECT * FROM locations;'); // Atribui os dados à variável externa
      });

      console.log('Localizações carregadas:', fetchedData);
      setLocations(fetchedData);
    } catch (error) {
      console.error('Erro ao carregar localizações:', error);
      throw error;
    }
  }

  // Use Effect para carregar o darkMode e as localizações salvas no banco de dados
  // É executado apenas uma vez, quando o componente é montado
  useEffect(() => {
    async function initializeData() {
      createTable();
      await loadDarkMode();
      await loadLocations(); // Agora você pode usar await aqui
    }
    initializeData();
  }, []);

  // Efetiva a alteração do tema dark/light quando a variável isSwitchOn é alterada
  // É executado sempre que a variável isSwitchOn é alterada
  useEffect(() => {
    if (isSwitchOn) {
      setTheme({ ...theme, colors: myColorsDark.colors });
    } else {
      setTheme({ ...theme, colors: myColors.colors });
    }
  }, [isSwitchOn]);

  return (
    <PaperProvider theme={theme}>
      <Appbar.Header>
        <Appbar.Content title="My Location BASE" />
      </Appbar.Header>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={styles.containerDarkMode}>
          <Text>Dark Mode</Text>
          <Switch value={isSwitchOn} onValueChange={onToggleSwitch} />
        </View>
        <Button
          style={styles.containerButton}
          icon="map"
          mode="contained"
          loading={isLoading}
          onPress={getLocation}
        >
          Capturar localização
        </Button>

        <FlatList
          style={styles.containerList}
          data={locations}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <List.Item
              title={`Localização ${item.id}`}
              description={`Latitude: ${item.latitude.toFixed(6)} | Longitude: ${item.longitude.toFixed(6)}`}
            />
          )}
          ListEmptyComponent={() => <Text style={styles.emptyListText}>Nenhuma localização registrada ainda.</Text>}
        />
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  containerDarkMode: {
    margin: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  containerButton: {
    margin: 10,
  },
  containerList: {
    margin: 10,
    height: "100%",
  },
});

