import React from "react";
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  Dimensions,
} from "react-native";

import {
  useFonts,
  Gelasio_700Bold_Italic,
} from '@expo-google-fonts/gelasio';

import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { ScrollView } from 'react-native';
import NavBar from "../components/navbar";
const { width } = Dimensions.get("window");
const titleSize = width < 360 ? 32 : width < 420 ? 39 : 42;
const descriptionSize = width < 360 ? 18 : 20;
export default function Map() {

  const [fontsLoaded] = useFonts({
    Gelasio_700Bold_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  return (
    <ImageBackground
      source={require("../assets/images/water.jpg")}
      style={styles.background}
    >
      <ScrollView 
       contentContainerStyle={styles.container}
       showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>
          Microplastic{"\n"}Detection
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Purpose</Text>
        </View>
      </ScrollView>
      <NavBar />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },

  container: {
    flex: 1,
    alignItems: "center",
    paddingTop: 90,
  },

  title: {
    fontSize: titleSize,
    maxWidth: "90%",
    color: "white",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: titleSize + 8,
    alignSelf: "center",
    fontFamily: 'Gelasio_700Bold_Italic',
  },

  card: {
    width: "85%",
    backgroundColor: "rgba(0,20,35,0.9)",
    borderRadius: 25,
    padding: 25,
  },

  cardTitle: {
    color: "white",
    fontSize: 30,
    textAlign: "center",
    marginBottom: 20,
    fontFamily: 'DMSans_400Regular',
  },

  description: {
    color: "white",
    fontSize: descriptionSize,
    textAlign: "center",
    lineHeight: descriptionSize + 8,
    fontFamily: 'DMSans_400Regular',
    maxWidth: "90%",
    alignSelf: "center",
  },
});