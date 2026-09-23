import sys

path = "backend/models/Message.js"
with open(path, "r") as f:
    content = f.read()

original = content

old = '''    text: {
      type: String,
      trim: true,
      required: true,
    },'''
new = '''    text: {
      type: String,
      trim: true,
      required: false,
      default: "",
    },
    imageBase64: {
      type: String,
      default: null,
    },'''
assert old in content, "ANCHOR NOT FOUND"
content = content.replace(old, new, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Message model patched.")
