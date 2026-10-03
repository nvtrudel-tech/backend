import sys

path = "app/worker/dashboard.tsx"
with open(path, "r") as f:
    content = f.read()

original = content

old = '''    if (status === "cancelled") {
      Alert.alert(
        "Confirm Cancellation",
        "Are you sure you want to cancel this job? The customer will be notified.",
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes, Cancel",
            onPress: () => performStatusUpdate(appointmentId, status),
            style: "destructive",
          },
        ]
      );
      return;
    }

    performStatusUpdate(appointmentId, status);
  };'''
new = '''    if (status === "cancelled") {
      Alert.alert(
        "Confirm Cancellation",
        "Are you sure you want to cancel this job? The customer will be notified.",
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes, Cancel",
            onPress: () => performStatusUpdate(appointmentId, status),
            style: "destructive",
          },
        ]
      );
      return;
    }

    if (status === "completed") {
      if (timeclockStatus !== "clocked_out" && activeTimeclockAppointmentId === appointmentId) {
        await handleJobClockOut();
      }
      performStatusUpdate(appointmentId, status);
      return;
    }

    performStatusUpdate(appointmentId, status);
  };'''
assert old in content, "ANCHOR NOT FOUND"
content = content.replace(old, new, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Dashboard patched: Complete button now clocks out the active session for that job.")
