import sys

path = "app/worker/dashboard.tsx"
with open(path, "r") as f:
    content = f.read()

original = content

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
new = '''  const fetchUnreadCounts = async (currentWorkerId: string) => {
    try {
      const response = await fetch(`${API_URL}/chat/unread/${currentWorkerId}`);
      if (!response.ok) return;
      const data = await response.json();
      setUnreadCounts(data || {});

      const total = Object.values(data || {}).reduce(
        (sum: number, n: any) => sum + (Number(n) || 0),
        0
      );
      Notifications.setBadgeCountAsync(total).catch(() => {});
    } catch (error) {
      console.error("Unread count fetch error:", error);
    }
  };'''
assert old in content, "ANCHOR NOT FOUND"
content = content.replace(old, new, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Worker dashboard patched to sync app icon badge.")
