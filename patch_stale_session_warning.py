import sys

path = "app/worker/dashboard.tsx"
with open(path, "r") as f:
    content = f.read()

original = content

# 1. Add state for the active session's start time
old_state = '''  const [activeTimeclockAppointmentId, setActiveTimeclockAppointmentId] = useState<string | null>(null);'''
new_state = '''  const [activeTimeclockAppointmentId, setActiveTimeclockAppointmentId] = useState<string | null>(null);
  const [activeTimeclockStartTime, setActiveTimeclockStartTime] = useState<string | null>(null);'''
assert old_state in content, "STATE ANCHOR NOT FOUND"
content = content.replace(old_state, new_state, 1)

# 2. Capture the entry's startTime when fetching status
old_fetch = '''  const fetchTimeclockStatus = async (currentWorkerId: string) => {
    try {
      const response = await fetch(`${API_URL}/timeclock/status/${currentWorkerId}`);
      if (!response.ok) return;
      const data = await response.json();
      setTimeclockStatus(data.status);
      setActiveTimeclockAppointmentId(data.entry?.appointmentId || null);
    } catch (error) {
      console.error("Timeclock status fetch error:", error);
    }
  };'''
new_fetch = '''  const fetchTimeclockStatus = async (currentWorkerId: string) => {
    try {
      const response = await fetch(`${API_URL}/timeclock/status/${currentWorkerId}`);
      if (!response.ok) return;
      const data = await response.json();
      setTimeclockStatus(data.status);
      setActiveTimeclockAppointmentId(data.entry?.appointmentId || null);
      setActiveTimeclockStartTime(data.entry?.startTime || null);
    } catch (error) {
      console.error("Timeclock status fetch error:", error);
    }
  };

  const STALE_SESSION_HOURS = 8;

  const openSessionHours = (() => {
    if (!activeTimeclockStartTime) return 0;
    const ms = Date.now() - new Date(activeTimeclockStartTime).getTime();
    return ms / (1000 * 60 * 60);
  })();

  const handleForceClockOut = async () => {
    if (!workerId) return;
    try {
      const response = await fetch(`${API_URL}/timeclock/clock-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId }),
      });
      if (!response.ok) throw new Error("Failed to clock out");
      await fetchTimeclockStatus(workerId);
      Alert.alert("Clocked Out", "Your open session has been closed.");
    } catch (error) {
      Alert.alert("Error", "Could not clock out.");
    }
  };'''
assert old_fetch in content, "FETCH FUNCTION ANCHOR NOT FOUND"
content = content.replace(old_fetch, new_fetch, 1)

# 3. Insert the warning banner just above "My Jobs"
old_banner_anchor = '''        <Text style={[styles.subHeader, { color: colors.text }]}>My Jobs</Text>

        {appointments.length > 0 ? ('''
new_banner_anchor = '''        {timeclockStatus !== "clocked_out" && openSessionHours > STALE_SESSION_HOURS && (
          <View style={styles.staleSessionBanner}>
            <Ionicons name="warning-outline" size={20} color="#92400e" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.staleSessionText}>
                You've been {timeclockStatus === "on_break" ? "on break" : "clocked in"} for{" "}
                {openSessionHours.toFixed(1)}h. Did you forget to clock out?
              </Text>
            </View>
            <TouchableOpacity
              style={styles.staleSessionButton}
              onPress={handleForceClockOut}
            >
              <Text style={styles.staleSessionButtonText}>Clock Out Now</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={[styles.subHeader, { color: colors.text }]}>My Jobs</Text>

        {appointments.length > 0 ? ('''
assert old_banner_anchor in content, "BANNER ANCHOR NOT FOUND"
content = content.replace(old_banner_anchor, new_banner_anchor, 1)

# 4. Add styles for the banner
old_styles_marker = "const styles = StyleSheet.create({"
new_styles_marker = '''const styles = StyleSheet.create({
  staleSessionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderColor: "#f59e0b",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  staleSessionText: {
    color: "#92400e",
    fontSize: 13,
    fontWeight: "600",
  },
  staleSessionButton: {
    backgroundColor: "#f59e0b",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  staleSessionButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },'''
assert old_styles_marker in content, "STYLES ANCHOR NOT FOUND"
content = content.replace(old_styles_marker, new_styles_marker, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Dashboard patched with stale-session warning banner.")
