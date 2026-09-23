import sys

path = "app/worker/dashboard.tsx"
with open(path, "r") as f:
    content = f.read()

original = content

# 1. Replace the two separate fetch functions with one combined fetch
old_functions = '''  const fetchTimeclockStatus = async (currentWorkerId: string) => {
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
  };'''

new_function = '''  const fetchTimeclockSummary = async (currentWorkerId: string) => {
    try {
      const response = await fetch(`${API_URL}/timeclock/summary/${currentWorkerId}`);
      if (!response.ok) return;
      const data = await response.json();
      setTimeclockStatus(data.status);
      setActiveTimeclockAppointmentId(data.activeAppointmentId || null);
      setDailyHours(data.dailyHours || 0);
    } catch (error) {
      console.error("Timeclock summary fetch error:", error);
    }
  };'''

assert old_functions in content, "FUNCTIONS ANCHOR NOT FOUND"
content = content.replace(old_functions, new_function, 1)

# 2. Replace every paired call site (await fetchTimeclockStatus(x); await fetchDailyHours(x);)
old_call_await = '''      await fetchTimeclockStatus(workerId);
      await fetchDailyHours(workerId);'''
new_call_await = '''      await fetchTimeclockSummary(workerId);'''
count = content.count(old_call_await)
assert count > 0, "AWAIT CALL SITE NOT FOUND"
content = content.replace(old_call_await, new_call_await)

old_init_call = '''        await fetchTimeclockStatus(currentWorker._id);
        await fetchDailyHours(currentWorker._id);'''
new_init_call = '''        await fetchTimeclockSummary(currentWorker._id);'''
assert old_init_call in content, "INIT CALL SITE NOT FOUND"
content = content.replace(old_init_call, new_init_call, 1)

old_interval_calls = '''    fetchTimeclockStatus(workerId);
    fetchDailyHours(workerId);'''
new_interval_calls = '''    fetchTimeclockSummary(workerId);'''
assert old_interval_calls in content, "TOP-LEVEL INTERVAL CALL NOT FOUND"
content = content.replace(old_interval_calls, new_interval_calls, 1)

old_inside_interval = '''      fetchTimeclockStatus(workerId);
      fetchDailyHours(workerId);
    }, 20000);'''
new_inside_interval = '''      fetchTimeclockSummary(workerId);
    }, 45000);'''
assert old_inside_interval in content, "INSIDE-INTERVAL CALL NOT FOUND"
content = content.replace(old_inside_interval, new_inside_interval, 1)

# 3. Widen the OTHER polling interval (appointments/unread) in the same block from 20000 to 45000
old_appts_interval = '''    fetchAppointments(workerId);
    fetchUnreadCounts(workerId);
    fetchTimeclockSummary(workerId);

    const interval = setInterval(() => {
      fetchAppointments(workerId);
      fetchUnreadCounts(workerId);
      fetchTimeclockSummary(workerId);
    }, 45000);'''
new_appts_interval = old_appts_interval  # already correct after replacements above, just verifying
if old_appts_interval not in content:
    print("NOTE: appts/unread interval block did not match expected shape after edits — check manually.")
else:
    pass

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Dashboard patched: combined timeclock summary + widened interval to 45s.")
