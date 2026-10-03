import sys

path = "backend/routes/appointments.js"
with open(path, "r") as f:
    content = f.read()

original = content

old = '''  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: { screen: 'home' }, 
  };'''
new = '''  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    priority: 'high',
    channelId: 'default',
    data: { screen: 'home' }, 
  };'''
assert old in content, "ANCHOR NOT FOUND"
content = content.replace(old, new, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Appointment push notifications patched with priority/channel fields.")
