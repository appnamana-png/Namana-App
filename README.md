# Namana Physiotherapy Clinic - Android APK & Web App

Clinical record management, patient case sheets, consultation receipts, monthly analytics, IT returns, and dynamic cloud data synchronization.

---

## 📱 Building the Android APK on GitHub

You can build the APK using either **apk-builder-action** OR the repository's built-in **GitHub Actions workflow**.

---

### Option A: Using `apk-builder-action` (e.g., `appnamana-png/apk-builder-action`)

This repository includes root-level Gradle configurations, wrappers, and delegating scripts so `apk-builder-action` works out of the box.

1. Open your **apk-builder-action** repository on GitHub.
2. Go to **Actions** -> **Build Android APK** -> **Run workflow**.
3. In the input parameters:
   - **Repository URL**: `https://github.com/appnamana-png/NAMANA-APP-APK.git`
   - **Tasks**: `:assembleRelease` (or `assembleRelease` or `assembleDebug`)
4. Click **Run workflow**.
5. When complete, download the APK from the **Artifacts** section.

---

### Option B: Built-in GitHub Actions Workflow (Recommended - 1 Click)

You don't even need an external builder repository! `NAMANA-APP-APK` has a complete built-in GitHub Actions workflow:

1. Open `https://github.com/appnamana-png/NAMANA-APP-APK`.
2. Click the **Actions** tab.
3. In the left sidebar, click **"Build Android APK"**.
4. Click **Run workflow** -> select `both`, `release`, or `debug` -> click **Run workflow**.
5. Once completed, download **`NamanaPhysioClinic-APK`** under **Artifacts** at the bottom.

---

## 💻 Local Development

### 1. Web Preview
```bash
# Install dependencies
npm install

# Start local development server (binds to http://localhost:3000)
npm run dev
```

### 2. Build Web & Sync to Android
```bash
# Builds Vite web assets and syncs them into the native Android folder
npm run build:android
```

### 3. Open in Android Studio
```bash
npm run cap:open
```

### 4. Build APK Locally via Command Line
```bash
# From root directory:
./gradlew assembleDebug

# Or from android/ directory:
cd android
./gradlew assembleDebug
# Generated APK: android/app/build/outputs/apk/debug/app-debug.apk
```
