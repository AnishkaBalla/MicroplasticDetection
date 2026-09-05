import { View, Pressable, Text } from "react-native";
import { router } from "expo-router";
import {
  StyleSheet,
} from "react-native";

export default function NavBar() {
  return (
    <View
      style={styles.navbar}
    >
      <Pressable onPress={() => router.push("/")}>
        <Text style={styles.navText}>Home</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/detector")}>
        <Text style={styles.navText}>Detector</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/map")}>
        <Text style={styles.navText}>Map</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 18,
    paddingBottom: 30,
    borderTopWidth: 1,
    backgroundColor: "rgba(20, 51, 74, 0.69)",
  },
  navText: {
    color: "white",
    fontSize: 15,
  }
})