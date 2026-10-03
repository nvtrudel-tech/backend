import sys

# 1. app/index.tsx
path = "app/index.tsx"
with open(path, "r") as f:
    content = f.read()
old = '''  const fetchUnreadCounts = async (currentUserId: string) => {
    try {
      const response = await fetch(`${API_URL}/chat/unread/${currentUserId}`);
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
new = '''  const fetchUnreadCounts = async (currentUserId: string) => {
    try {
      const response = await fetch(`${API_URL}/chat/unread/${currentUserId}`);
      if (!response.ok) return;
      const data = await response.json();
      setUnreadCounts(data || {});

      const chatTotal = Object.values(data || {}).reduce(
        (sum: number, n: any) => sum + (Number(n) || 0),
        0
      );

      let notifTotal = 0;
      try {
        const notifRes = await fetch(`${API_URL}/notifications/unread/${currentUserId}`);
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          notifTotal = notifData.count || 0;
        }
      } catch (e) {
        console.error("Notification badge fetch error:", e);
      }

      Notifications.setBadgeCountAsync(chatTotal + notifTotal).catch(() => {});

      if (notifTotal > 0) {
        fetch(`${API_URL}/notifications/clear/${currentUserId}`, { method: "POST" }).catch(() => {});
      }
    } catch (error) {
      console.error("Unread count fetch error:", error);
    }
  };'''
assert old in content, "index.tsx ANCHOR NOT FOUND"
content = content.replace(old, new, 1)
with open(path, "w") as f:
    f.write(content)
print("app/index.tsx patched.")

# 2. app/worker/dashboard.tsx
path = "app/worker/dashboard.tsx"
with open(path, "r") as f:
    content = f.read()
old = '''  const fetchUnreadCounts = async (currentWorkerId: string) => {
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
new = '''  const fetchUnreadCounts = async (currentWorkerId: string) => {
    try {
      const response = await fetch(`${API_URL}/chat/unread/${currentWorkerId}`);
      if (!response.ok) return;
      const data = await response.json();
      setUnreadCounts(data || {});

      const chatTotal = Object.values(data || {}).reduce(
        (sum: number, n: any) => sum + (Number(n) || 0),
        0
      );

      let notifTotal = 0;
      try {
        const notifRes = await fetch(`${API_URL}/notifications/unread/${currentWorkerId}`);
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          notifTotal = notifData.count || 0;
        }
      } catch (e) {
        console.error("Notification badge fetch error:", e);
      }

      Notifications.setBadgeCountAsync(chatTotal + notifTotal).catch(() => {});

      if (notifTotal > 0) {
        fetch(`${API_URL}/notifications/clear/${currentWorkerId}`, { method: "POST" }).catch(() => {});
      }
    } catch (error) {
      console.error("Unread count fetch error:", error);
    }
  };'''
assert old in content, "dashboard.tsx ANCHOR NOT FOUND"
content = content.replace(old, new, 1)
with open(path, "w") as f:
    f.write(content)
print("app/worker/dashboard.tsx patched.")

print("All frontend changes applied successfully.")
