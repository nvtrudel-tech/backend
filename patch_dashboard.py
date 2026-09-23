import re, sys

path = "app/worker/dashboard.tsx"
with open(path, "r") as f:
    content = f.read()

original = content

# 1. Add new state after existing state declarations
old = '''  const [appointments, setAppointments] = useState<any[]>([]);
  const [clockedIn, setClockedIn] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});'''
new = old + '''

  const [timeclockStatus, setTimeclockStatus] = useState<"clocked_out" | "clocked_in" | "on_break">("clocked_out");
  const [activeTimeclockAppointmentId, setActiveTimeclockAppointmentId] = useState<string | null>(null);
  const [dailyHours, setDailyHours] = useState<number>(0);'''
assert old in content, "ANCHOR 1 NOT FOUND"
content = content.replace(old, new, 1)

# 2. Add fetch + handler functions after fetchUnreadCounts
old = '''  const fetchUnreadCounts = async (currentWorkerId: string) => {
    try {
      const response = await fetch(`${API_URL}/chat/unread/${currentWorkerId}`);
      if (!response.ok) return;
      const data = await response.json();
      setUnreadCounts(data || {});
    } catch (error) {
      console.error("Unread count fetch error:", error);
    }
  };'''
new = old + '''

  const fetchTimeclockStatus = async (currentWorkerId: string) => {
    try {
      const response = await fetch(`${API_URL}/timeclock/status/${currentWorkerId}`);
      if (!response.ok) return;
      const data = await response.json();
      setTimeclockStatus(data.status);
      setActiveTimeclockAppointmentId(data.entry?.appointmentId || null);
    } catch (error) {
      console.error("Timeclock status fetch error:", error);
    }
  };

  const fetchDailyHours = async (currentWorkerId: string) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetch(`${API_URL}/timeclock/daily/${currentWorkerId}?date=${today}`);
      if (!response.ok) return;
      const data = await response.json();
      setDailyHours(data.totalHours || 0);
    } catch (error) {
      console.error("Daily hours fetch error:", error);
    }
  };

  const handleJobClockIn = async (appointmentId: string) => {
    if (!workerId) return;
    try {
      const response = await fetch(`${API_URL}/timeclock/clock-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId, appointmentId }),
      });
      if (!response.ok) throw new Error("Failed to clock in");
      const data = await response.json();
      if (data.flaggedPreviousEntry) {
        Alert.alert(
          "Heads up",
          "You had an open clock-in from a previous job that wasn't closed. It's been flagged for review."
        );
      }
      await fetchTimeclockStatus(workerId);
      await fetchDailyHours(workerId);
    } catch (error) {
      Alert.alert("Error", "Could not clock in to this job.");
    }
  };

  const handleBreakStart = async () => {
    if (!workerId) return;
    try {
      const response = await fetch(`${API_URL}/timeclock/break-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId }),
      });
      if (!response.ok) throw new Error("Failed to start break");
      await fetchTimeclockStatus(workerId);
      await fetchDailyHours(workerId);
    } catch (error) {
      Alert.alert("Error", "Could not start break.");
    }
  };

  const handleBreakEnd = async () => {
    if (!workerId) return;
    try {
      const response = await fetch(`${API_URL}/timeclock/break-end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId }),
      });
      if (!response.ok) throw new Error("Failed to end break");
      await fetchTimeclockStatus(workerId);
      await fetchDailyHours(workerId);
    } catch (error) {
      Alert.alert("Error", "Could not end break.");
    }
  };

  const handleJobClockOut = async () => {
    if (!workerId) return;
    try {
      const response = await fetch(`${API_URL}/timeclock/clock-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId }),
      });
      if (!response.ok) throw new Error("Failed to clock out");
      await fetchTimeclockStatus(workerId);
      await fetchDailyHours(workerId);
    } catch (error) {
      Alert.alert("Error", "Could not clock out.");
    }
  };'''
assert old in content, "ANCHOR 2 NOT FOUND"
content = content.replace(old, new, 1)

# 3. Call the new fetches during initial load
old = '''        await fetchAppointments(currentWorker._id);
        await fetchUnreadCounts(currentWorker._id);
        await registerForPushNotificationsAsync(currentWorker._id);
        await getInitialLocation(currentWorker._id);'''
new = '''        await fetchAppointments(currentWorker._id);
        await fetchUnreadCounts(currentWorker._id);
        await registerForPushNotificationsAsync(currentWorker._id);
        await getInitialLocation(currentWorker._id);
        await fetchTimeclockStatus(currentWorker._id);
        await fetchDailyHours(currentWorker._id);'''
assert old in content, "ANCHOR 3 NOT FOUND"
content = content.replace(old, new, 1)

# 4. Poll the new fetches alongside appointments/unread counts
old = '''    fetchAppointments(workerId);
    fetchUnreadCounts(workerId);

    const interval = setInterval(() => {
      fetchAppointments(workerId);
      fetchUnreadCounts(workerId);
    }, 20000);'''
new = '''    fetchAppointments(workerId);
    fetchUnreadCounts(workerId);
    fetchTimeclockStatus(workerId);
    fetchDailyHours(workerId);

    const interval = setInterval(() => {
      fetchAppointments(workerId);
      fetchUnreadCounts(workerId);
      fetchTimeclockStatus(workerId);
      fetchDailyHours(workerId);
    }, 20000);'''
assert old in content, "ANCHOR 4 NOT FOUND"
content = content.replace(old, new, 1)

# 5. Add "Today's Hours" card next to Shift card
old = '''        <View
          style={[
            styles.quickInfoCard,
            { backgroundColor: colors.background, borderColor: colors.inputBorder },
          ]}
        >
          <Text style={[styles.quickInfoLabel, { color: colors.subText }]}>Shift</Text>
          <Text
            style={[
              styles.quickInfoValue,
              { color: clockedIn ? "#10b981" : "#ef4444" },
            ]}
          >
            {clockedIn ? "Clocked In" : "Clocked Out"}
          </Text>
        </View>
      </View>
    </View>
  );'''
new = '''        <View
          style={[
            styles.quickInfoCard,
            { backgroundColor: colors.background, borderColor: colors.inputBorder },
          ]}
        >
          <Text style={[styles.quickInfoLabel, { color: colors.subText }]}>Shift</Text>
          <Text
            style={[
              styles.quickInfoValue,
              { color: clockedIn ? "#10b981" : "#ef4444" },
            ]}
          >
            {clockedIn ? "Clocked In" : "Clocked Out"}
          </Text>
        </View>

        <View
          style={[
            styles.quickInfoCard,
            { backgroundColor: colors.background, borderColor: colors.inputBorder },
          ]}
        >
          <Text style={[styles.quickInfoLabel, { color: colors.subText }]}>Today's Hours</Text>
          <Text style={[styles.quickInfoValue, { color: colors.text }]}>
            {dailyHours.toFixed(2)}h
          </Text>
        </View>
      </View>
    </View>
  );'''
assert old in content, "ANCHOR 5 NOT FOUND"
content = content.replace(old, new, 1)

# 6. Insert per-job clock-in/break/clock-out controls after the chat button block
old = '''              {canChat(job) && (
                <TouchableOpacity
                  style={[styles.chatButton, { backgroundColor: colors.primaryButton }]}
                  onPress={() => openJobChat(job)}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
                  <Text style={styles.chatButtonText}>Chat with Customer</Text>

                  {(unreadCounts[job._id] || 0) > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {unreadCounts[job._id] > 99 ? "99+" : unreadCounts[job._id]}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}'''
new = old + '''

              {(job.status.toLowerCase() === "confirmed" ||
                job.status.toLowerCase() === "en_route") && (
                <View style={styles.timeclockRow}>
                  {activeTimeclockAppointmentId === job._id ? (
                    <>
                      {timeclockStatus === "clocked_in" && (
                        <>
                          <TouchableOpacity
                            style={[styles.timeclockButton, { backgroundColor: "#f59e0b" }]}
                            onPress={handleBreakStart}
                          >
                            <Text style={styles.timeclockButtonText}>Start Break</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.timeclockButton, { backgroundColor: "#ef4444" }]}
                            onPress={handleJobClockOut}
                          >
                            <Text style={styles.timeclockButtonText}>Clock Out</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {timeclockStatus === "on_break" && (
                        <TouchableOpacity
                          style={[styles.timeclockButton, { backgroundColor: "#10b981" }]}
                          onPress={handleBreakEnd}
                        >
                          <Text style={styles.timeclockButtonText}>End Break</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    timeclockStatus === "clocked_out" && (
                      <TouchableOpacity
                        style={[styles.timeclockButton, { backgroundColor: "#10b981" }]}
                        onPress={() => handleJobClockIn(job._id)}
                      >
                        <Text style={styles.timeclockButtonText}>Clock In to Job</Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              )}'''
assert old in content, "ANCHOR 6 NOT FOUND"
content = content.replace(old, new, 1)

# 7. Add styles for the new timeclock buttons
old = '''  unreadBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});'''
new = '''  unreadBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  timeclockRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  timeclockButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  timeclockButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
});'''
assert old in content, "ANCHOR 7 NOT FOUND"
content = content.replace(old, new, 1)

if content == original:
    print("NO CHANGES MADE - something is wrong")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("All 7 patches applied successfully.")
