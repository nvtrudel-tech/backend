import sys

path = "app/worker/dashboard.tsx"
with open(path, "r") as f:
    content = f.read()

original = content

old = '''  const fetchTimeclockSummary = async (currentWorkerId: string) => {
    try {
      const response = await fetch(`${API_URL}/timeclock/summary/${currentWorkerId}`);'''
new = '''  const fetchTimeclockSummary = async (currentWorkerId: string) => {
    try {
      const tzOffset = new Date().getTimezoneOffset();
      const response = await fetch(
        `${API_URL}/timeclock/summary/${currentWorkerId}?tzOffset=${tzOffset}`
      );'''
assert old in content, "ANCHOR NOT FOUND"
content = content.replace(old, new, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Dashboard patched to send tzOffset with timeclock summary requests.")
