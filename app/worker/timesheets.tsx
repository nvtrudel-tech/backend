import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";

const API_URL = "http://172.20.10.3:6000/api";

interface WorkerListItem {
  _id: string;
  name: string;
}

interface JobBreakdown {
  appointmentId: string;
  service: string;
  address: string;
  totalHours: number;
}

interface DayBreakdown {
  date: string;
  totalHours: number;
  jobs: JobBreakdown[];
}

export default function TimesheetsScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [workers, setWorkers] = useState<WorkerListItem[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [days, setDays] = useState<DayBreakdown[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(true);
  const [isLoadingRange, setIsLoadingRange] = useState(false);

  useEffect(() => {
    const loadWorkers = async () => {
      try {
        const response = await fetch(`${API_URL}/workers`);
        const data = await response.json();
        setWorkers(data.map((w: any) => ({ _id: w._id, name: w.name })));
      } catch (error) {
        console.error("Failed to load workers:", error);
      } finally {
        setIsLoadingWorkers(false);
      }
    };
    loadWorkers();
  }, []);

  const loadRange = async (workerId: string) => {
    setIsLoadingRange(true);
    setExpandedDay(null);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);

      const response = await fetch(
        `${API_URL}/timeclock/range/${workerId}?start=${start
          .toISOString()
          .slice(0, 10)}&end=${end.toISOString().slice(0, 10)}`
      );
      const data = await response.json();
      setDays(data.days || []);
    } catch (error) {
      console.error("Failed to load range hours:", error);
      setDays([]);
    } finally {
      setIsLoadingRange(false);
    }
  };

  const handleSelectWorker = (workerId: string) => {
    setSelectedWorkerId(workerId);
    loadRange(workerId);
  };

  const weekTotal = days.reduce((sum, d) => sum + d.totalHours, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>
            Timesheets
          </Text>
        </View>

        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.subText, marginBottom: 8 }}>
          Select a worker
        </Text>

        {isLoadingWorkers ? (
          <ActivityIndicator color={colors.primaryButton} style={{ marginVertical: 20 }} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {workers.map((w) => (
              <TouchableOpacity
                key={w._id}
                onPress={() => handleSelectWorker(w._id)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: colors.inputBorder,
                  backgroundColor:
                    selectedWorkerId === w._id ? colors.primaryButton : colors.cardBackground,
                }}
              >
                <Text
                  style={{
                    color: selectedWorkerId === w._id ? "#fff" : colors.text,
                    fontWeight: "600",
                  }}
                >
                  {w.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selectedWorkerId && (
          <>
            <View
              style={{
                backgroundColor: colors.cardBackground,
                borderColor: colors.inputBorder,
                borderWidth: 1,
                borderRadius: 14,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: colors.subText, fontSize: 13, fontWeight: "600" }}>
                Last 7 days total
              </Text>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>
                {weekTotal.toFixed(2)}h
              </Text>
            </View>

            {isLoadingRange ? (
              <ActivityIndicator color={colors.primaryButton} style={{ marginVertical: 20 }} />
            ) : days.length === 0 ? (
              <Text style={{ color: colors.subText, textAlign: "center", marginTop: 20 }}>
                No hours logged in the last 7 days.
              </Text>
            ) : (
              days.map((day) => (
                <View
                  key={day.date}
                  style={{
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.inputBorder,
                    borderWidth: 1,
                    borderRadius: 12,
                    marginBottom: 10,
                    overflow: "hidden",
                  }}
                >
                  <TouchableOpacity
                    onPress={() =>
                      setExpandedDay(expandedDay === day.date ? null : day.date)
                    }
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: 14,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                      {new Date(day.date + "T00:00:00").toLocaleDateString([], {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ color: colors.primaryButton, fontWeight: "700" }}>
                        {day.totalHours.toFixed(2)}h
                      </Text>
                      <Ionicons
                        name={expandedDay === day.date ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={colors.subText}
                      />
                    </View>
                  </TouchableOpacity>

                  {expandedDay === day.date && (
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: colors.inputBorder,
                        padding: 14,
                        paddingTop: 8,
                      }}
                    >
                      {day.jobs.map((job) => (
                        <View
                          key={job.appointmentId}
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            paddingVertical: 6,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.text, fontWeight: "600" }}>
                              {job.service}
                            </Text>
                            {!!job.address && (
                              <Text style={{ color: colors.subText, fontSize: 12 }}>
                                {job.address}
                              </Text>
                            )}
                          </View>
                          <Text style={{ color: colors.text, fontWeight: "600" }}>
                            {job.totalHours.toFixed(2)}h
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
