import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  useWindowDimensions,
  ImageBackground,
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import axios from "axios";

import {
  useFonts,
  Gelasio_700Bold_Italic,
} from '@expo-google-fonts/gelasio';

import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

import NavBar from "../components/navbar";

const ROBOFLOW_API_KEY = "AKrZEoO8K7XZpvolzvHz";
const ROBOFLOW_MODEL_ID = "microplastics-03kqm-8igkw/1";

const { width } = Dimensions.get("window");
const titleSize = width < 360 ? 32 : width < 420 ? 39 : 42;
const descriptionSize = width < 360 ? 18 : 20;

interface MetricData {
  safety_score: number;
  rating: string;
  particle_count: number;
  density_percentage: number;
}

interface PredictionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  class: string;
  confidence: number;
}

export default function DetectorScreen() {
  const { width: screenWidth } = useWindowDimensions();

  //image has to fit inside the card (85% of screen minus the padding)
  const imageSize = Math.min(380, Math.max(1, screenWidth * 0.85 - 50));

  const [fontsLoaded] = useFonts({
    Gelasio_700Bold_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  const [image, setImage] = useState<string | null>(null);
  const [imageWidth, setImageWidth] = useState<number>(1);
  const [imageHeight, setImageHeight] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<MetricData | null>(null);
  const [boxes, setBoxes] = useState<PredictionBox[]>([]);
  const [base64Data, setBase64Data] = useState<string | null>(null);

  if (!fontsLoaded) {
    return null;
  }

  //lets the user pick a picture from their gallery
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true, //need base64 to send it to roboflow
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const selectedAsset = result.assets[0];
      setImage(selectedAsset.uri);
      setBase64Data(selectedAsset.base64 || null);
      setImageWidth(selectedAsset.width || 1000);
      setImageHeight(selectedAsset.height || 1000);
      setResults(null);
      setBoxes([]);
    }
  };

  //sends the picture to roboflow and figures out the safety score
  const analyzeWithRoboflowDirectly = async () => {
    if (!image || !base64Data) {
      Alert.alert("Missing Image", "Please pick an image from your gallery first.");
      return;
    }
    setLoading(true);

    const cleanUrl = "https://detect.roboflow.com/" + ROBOFLOW_MODEL_ID;

    try {
      const response = await axios({
        method: "POST",
        url: cleanUrl,
        params: {
          api_key: ROBOFLOW_API_KEY,
          format: "json"
        },
        data: base64Data,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      });

      const json = response.data;

      if (json.error) {
        Alert.alert("Roboflow Error", json.error.message || "Invalid configuration.");
        setLoading(false);
        return;
      }

      const predictions: PredictionBox[] = json.predictions || [];

      //add up the area of all the boxes to get the density
      const totalImageArea = imageWidth * imageHeight;
      let totalMicroplasticArea = 0;

      predictions.forEach((box) => {
        totalMicroplasticArea += (box.width * box.height);
      });

      const densityPercentage = (totalMicroplasticArea / totalImageArea) * 100;
      const particleCount = predictions.length;

      //starts at 100, minus 1.5 per particle and minus 5 per 1% of density
      const baseScore = 100.0 - (particleCount * 1.5) - (densityPercentage * 5.0);

      //keep the score between 0 and 100
      const safetyScore = Math.max(0.0, Math.min(100.0, baseScore));

      //rating depends on the score
      let rating = "";
      if (safetyScore >= 80) {
        rating = "Excellent / Safe";
      } else if (safetyScore >= 45) {
        rating = "Caution / Moderate Contamination";
      } else {
        rating = "Danger / High Contamination";
      }

      setResults({
        safety_score: Math.round(safetyScore * 10) / 10,
        rating: rating,
        particle_count: particleCount,
        density_percentage: Math.round(densityPercentage * 1000) / 1000
      });
      setBoxes(predictions);

    } catch (error: any) {
      Alert.alert("Network Failure", "Failed to get data from Roboflow Cloud.");
      console.log("Axios Error Details:", error.message);
    } finally {
      setLoading(false);
    }
  };

  //green for safe, orange for caution, red for danger
  const getRatingColor = (rating: string) => {
    if (rating.includes('Safe')) return '#4CAF50';
    if (rating.includes('Caution')) return '#FF9800';
    return '#F44336';
  };

  return (
    <ImageBackground
      source={require("../assets/images/water.jpg")}
      style={styles.background}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <Text style={styles.title}>
          Detector
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Water Sample</Text>

          <TouchableOpacity activeOpacity={0.75} style={styles.button} onPress={pickImage}>
            <Text style={styles.buttonText}>Select water {"\n"}sample picture</Text>
          </TouchableOpacity>

          {image && (
            <View style={[styles.imageContainer, { width: imageSize, height: imageSize }]}>
              <Image source={{ uri: image }} style={styles.image} />

              {/* bounding boxes around each microplastic */}
              {boxes.map((box, index) => {
                const scaleX = imageSize / imageWidth;
                const scaleY = imageSize / imageHeight;

                return (
                  <View
                    key={index}
                    style={[
                      styles.boundingBox,
                      {
                        left: (box.x - box.width / 2) * scaleX,
                        top: (box.y - box.height / 2) * scaleY,
                        width: box.width * scaleX,
                        height: box.height * scaleY,
                      },
                    ]}
                  />
                );
              })}
            </View>
          )}

          {image && !loading && !results && (
            <TouchableOpacity
              activeOpacity={0.75}
              style={[styles.button, styles.analyzeButton]}
              onPress={analyzeWithRoboflowDirectly}
            >
              <Text style={styles.buttonText}>Scan Contamination Metrics</Text>
            </TouchableOpacity>
          )}

          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.loadingText}>
                Connecting to microplastic detection model...
              </Text>
            </View>
          )}

          {results && (
            <View style={styles.resultsBox}>
              <Text style={styles.resultsTitle}>Analysis Breakdown</Text>

              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Safety Score:</Text>
                <Text style={[styles.metricValue, { fontSize: 24, color: getRatingColor(results.rating) }]}>
                  {results.safety_score} / 100
                </Text>
              </View>

              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Verdict:</Text>
                <Text style={[styles.metricValue, styles.verdict, { color: getRatingColor(results.rating) }]}>
                  {results.rating}
                </Text>
              </View>

              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Particles Detected:</Text>
                <Text style={styles.metricValue}>{results.particle_count}</Text>
              </View>

              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Density Area Ratio:</Text>
                <Text style={styles.metricValue}>{results.density_percentage}%</Text>
              </View>
            </View>
          )}
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

  scrollView: {
    flex: 1,
  },

  container: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: 90,
    paddingBottom: 140,
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

  button: {
    backgroundColor: '#3F8F78',
    justifyContent: 'center',
    minHeight: 58,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#9ED8BD',
    width: '90%',
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#061A2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },

  analyzeButton: {
    backgroundColor: '#2E7D69',
    marginTop: 15,
  },

  buttonText: {
    color: "white",
    fontSize: descriptionSize,
    textAlign: "center",
    lineHeight: descriptionSize + 8,
    fontFamily: 'DMSans_700Bold',
  },

  imageContainer: {
    marginVertical: 20,
    alignSelf: 'center',
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
  },

  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FF1744',
    backgroundColor: 'rgba(255, 23, 68, 0.15)',
  },

  loadingBox: {
    marginVertical: 20,
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 10,
    color: '#b0c4d4',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'DMSans_400Regular',
  },

  resultsBox: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
  },

  resultsTitle: {
    color: 'white',
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 15,
    fontFamily: 'DMSans_500Medium',
  },

  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },

  metricLabel: {
    fontSize: 16,
    color: '#b0c4d4',
    fontFamily: 'DMSans_400Regular',
  },

  metricValue: {
    fontSize: 18,
    color: 'white',
    marginLeft: 20,
    fontFamily: 'DMSans_700Bold',
  },

  verdict: {
    flex: 1,
    textAlign: 'right',
  },
});