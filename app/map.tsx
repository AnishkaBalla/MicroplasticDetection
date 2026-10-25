import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ImageBackground,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Keyboard,
  ScrollView,
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

import NavBar from "../components/navbar";

const { width } = Dimensions.get("window");
const titleSize = width < 360 ? 32 : width < 420 ? 39 : 42;
const descriptionSize = width < 360 ? 18 : 20;

//epa website to get the water data
const EPA = "https://data.epa.gov/efservice";

export default function ZipLookup() {

  const [fontsLoaded] = useFonts({
    Gelasio_700Bold_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  //water report stuff
  const [reports, setReports] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");

  if (!fontsLoaded) {
    return null;
  }

  //gets data from the epa, gives back null if something goes wrong
  const getFromEpa = async (path: string) => {
    const url = EPA + "/" + path + "/JSON";
    console.log("EPA URL:", url);
    try {
      const res = await fetch(url);
      const text = await res.text();
      console.log("EPA status:", res.status, text.slice(0, 300));
      if (!res.ok) return null;
      const data = JSON.parse(text);
      if (Array.isArray(data)) return data;
      return null;
    } catch (e) {
      console.log("EPA error:", e);
      return null;
    }
  };

  //gets the water system info for a list of ids
  const getSystemsById = async (ids: string[]) => {
    const systems: any[] = [];
    for (const id of ids.slice(0, 15)) {
      const rows = await getFromEpa("WATER_SYSTEM/PWSID/equals/" + id);
      if (rows) systems.push(...rows);
    }
    return systems;
  };

  const getWaterReport = async (zipCode: string, cityName: string, stateName: string) => {
    setReports([]);
    setReportError("");
    setReportLoading(true);

    try {
      const found: any = {};

      //adds systems to found (no repeats)
      const addSystems = (rows: any[] | null) => {
        if (!rows) return;
        for (const r of rows) {
          if (r.pwsid) found[r.pwsid] = r;
        }
      };

      //ids start with the state letters so this skips other states
      const inState = (id: string) => id && id.startsWith(stateName);

      //try 1: mailing zip of the system
      addSystems(await getFromEpa("WATER_SYSTEM/ZIP_CODE/beginning/" + zipCode));

      //try 2: systems that say they serve this zip
      const zipRows = await getFromEpa("GEOGRAPHIC_AREA/ZIP_CODE_SERVED/equals/" + zipCode);
      const zipIds: string[] = [];
      for (const r of zipRows || []) {
        if (inState(r.pwsid) && !found[r.pwsid] && !zipIds.includes(r.pwsid)) {
          zipIds.push(r.pwsid);
        }
      }
      addSystems(await getSystemsById(zipIds));

      //try 3: search by city name if still have nothing
      if (Object.keys(found).length === 0) {
        const cityUpper = encodeURIComponent(cityName.toUpperCase());
        addSystems(
          await getFromEpa("WATER_SYSTEM/CITY_NAME/equals/" + cityUpper + "/STATE_CODE/equals/" + stateName)
        );

        if (Object.keys(found).length === 0) {
          const cityRows = await getFromEpa("GEOGRAPHIC_AREA/CITY_SERVED/equals/" + cityUpper);
          const cityIds: string[] = [];
          for (const r of cityRows || []) {
            if (inState(r.pwsid) && !cityIds.includes(r.pwsid)) {
              cityIds.push(r.pwsid);
            }
          }
          addSystems(await getSystemsById(cityIds));
        }
      }

      //only active community water systems
      const systems = Object.values(found).filter(
        (s: any) => s.pws_activity_code === "A" && s.pws_type_code === "CWS"
      );

      if (systems.length === 0) {
        setReportError("No water systems found for this ZIP.");
        setReportLoading(false);
        return;
      }

      //biggest ones first, only keep 3
      systems.sort((a: any, b: any) => (b.population_served_count || 0) - (a.population_served_count || 0));
      const top = systems.slice(0, 3);

      const results = [];
      for (const s of top as any[]) {
        const violations = await getFromEpa("VIOLATION/PWSID/equals/" + s.pwsid + "/rows/0:999");

        let source = s.primary_source_code;
        if (source === "GW") source = "Ground water";
        else if (source === "SW") source = "Surface water";
        else if (source === "GWP") source = "Ground water (purchased)";
        else if (source === "SWP") source = "Surface water (purchased)";

        //null means it didn't load, 0 means epa really has none
        let total = null;
        let health = null;
        if (violations) {
          total = violations.length;
          health = violations.filter((v: any) => v.is_health_based_ind === "Y").length;
        }

        results.push({
          pwsid: s.pwsid,
          name: s.pws_name,
          people: s.population_served_count || 0,
          source: source || "Unknown",
          total: total,
          health: health,
        });
      }

      setReports(results);
    } catch (err) {
      setReportError("Could not load water quality data.");
    }

    setReportLoading(false);
  };

  const lookupZip = async (inputZip: string) => {
    setZip(inputZip);

    //clear old stuff while typing
    setCity("");
    setState("");
    setError("");
    setReports([]);
    setReportError("");

    if (inputZip.length !== 5) return;

    Keyboard.dismiss();
    setLoading(true);

    try {
      const response = await fetch("https://api.zippopotam.us/us/" + inputZip);

      if (!response.ok) {
        throw new Error("ZIP code not found");
      }

      const data = await response.json();

      if (data.places && data.places.length > 0) {
        const place = data.places[0];
        const placeName = place["place name"];
        const stateAbbr = place["state abbreviation"];
        setCity(placeName);
        setState(stateAbbr);
        getWaterReport(inputZip, placeName, stateAbbr);
      } else {
        throw new Error("ZIP code not found");
      }
    } catch (err) {
      setError("Invalid or unknown ZIP code.");
    }

    setLoading(false);
  };

  return (
    <ImageBackground
      source={require("../assets/images/water.jpg")}
      style={styles.background}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>
          Water Quality{"\n"}Lookup
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Enter ZIP Code</Text>

          <TextInput
            style={styles.input}
            placeholder="5-digit ZIP code"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            maxLength={5}
            value={zip}
            onChangeText={lookupZip}
          />

          {loading && (
            <ActivityIndicator size="small" color="white" style={styles.loader} />
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {city && state ? (
            <View style={styles.section}>
              <Text style={styles.label}>Location Found:</Text>
              <Text style={styles.locationText}>{city}, {state}</Text>
            </View>
          ) : null}

          {reportLoading && (
            <ActivityIndicator size="small" color="white" style={styles.loader} />
          )}

          {reportError ? <Text style={styles.errorText}>{reportError}</Text> : null}

          {reports.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.label}>Water Systems</Text>

              {reports.map((r) => (
                <View key={r.pwsid} style={styles.reportItem}>
                  <Text style={styles.reportName}>{r.name}</Text>
                  <Text style={styles.reportText}>
                    {r.people.toLocaleString()} people served - {r.source}
                  </Text>

                  {r.total === null ? (
                    <Text style={styles.reportText}>Violation data unavailable</Text>
                  ) : (
                    <>
                      <Text style={styles.reportText}>
                        {r.total} violations on record
                      </Text>
                      <Text style={r.health > 0 ? styles.warningText : styles.reportText}>
                        {r.health} health-based
                      </Text>
                    </>
                  )}
                </View>
              ))}

              <Text style={styles.disclaimer}>
                Source: EPA SDWIS. Data may be incomplete, check your
                utility's yearly water quality report too.
              </Text>
            </View>
          ) : null}
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

  input: {
    height: 50,
    borderRadius: 15,
    paddingHorizontal: 16,
    fontSize: 18,
    textAlign: "center",
    color: "white",
    backgroundColor: "rgba(255,255,255,0.15)",
    fontFamily: 'DMSans_400Regular',
  },

  loader: {
    marginTop: 16,
  },

  errorText: {
    color: "#ff6b6b",
    textAlign: "center",
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
  },

  section: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },

  label: {
    color: "#b0c4d4",
    fontSize: 16,
    marginBottom: 6,
    fontFamily: 'DMSans_400Regular',
  },

  locationText: {
    color: "white",
    fontSize: 26,
    textAlign: "center",
    fontFamily: 'DMSans_500Medium',
  },

  reportItem: {
    marginTop: 14,
    alignItems: "center",
  },

  reportName: {
    color: "white",
    fontSize: 20,
    textAlign: "center",
    fontFamily: 'DMSans_700Bold',
  },

  reportText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    marginTop: 3,
    fontFamily: 'DMSans_400Regular',
  },

  warningText: {
    color: "#ff6b6b",
    fontSize: 16,
    textAlign: "center",
    marginTop: 3,
    fontFamily: 'DMSans_700Bold',
  },

  disclaimer: {
    color: "#b0c4d4",
    fontSize: 13,
    textAlign: "center",
    marginTop: 18,
    fontFamily: 'DMSans_400Regular',
  },
});