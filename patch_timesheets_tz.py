import sys

path = "app/worker/timesheets.tsx"
with open(path, "r") as f:
    content = f.read()

original = content

old = '''      const response = await fetch(
        `${API_URL}/timeclock/range/${workerId}?start=${start
          .toISOString()
          .slice(0, 10)}&end=${end.toISOString().slice(0, 10)}`
      );'''
new = '''      const tzOffset = new Date().getTimezoneOffset();
      const response = await fetch(
        `${API_URL}/timeclock/range/${workerId}?start=${start
          .toISOString()
          .slice(0, 10)}&end=${end.toISOString().slice(0, 10)}&tzOffset=${tzOffset}`
      );'''
assert old in content, "ANCHOR NOT FOUND"
content = content.replace(old, new, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Timesheets screen patched to send tzOffset with range requests.")
