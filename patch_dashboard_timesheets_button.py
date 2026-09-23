import sys

path = "app/worker/dashboard.tsx"
with open(path, "r") as f:
    content = f.read()

original = content

old = '''        <View style={styles.headerIcons}>
          <ThemeToggle />
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>'''
new = '''        <View style={styles.headerIcons}>
          {workerProfile?.isEmployer && (
            <TouchableOpacity onPress={() => router.push("/worker/timesheets")}>
              <Ionicons name="time-outline" size={26} color={colors.text} />
            </TouchableOpacity>
          )}
          <ThemeToggle />
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>'''
assert old in content, "BUTTON ANCHOR NOT FOUND"
content = content.replace(old, new, 1)

if content == original:
    print("NO CHANGES MADE")
    sys.exit(1)

with open(path, "w") as f:
    f.write(content)

print("Dashboard patched with Timesheets button.")
