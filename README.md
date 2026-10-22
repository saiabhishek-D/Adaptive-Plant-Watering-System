# 🌱 Adaptive Predictive Plant Watering System (Digital Twin Dashboard)

An advanced, real-time web simulation and hardware digital twin for an IoT-based smart plant irrigation system. Built with pure vanilla web technologies (HTML5, modern CSS3, ES6+ JavaScript) and in-browser machine learning (TensorFlow.js).

---

## 📸 Key Features

- **🧠 TensorFlow.js Neural Network Model**:
  - Live in-browser machine learning model predicting soil moisture levels 1–6 hours into the future.
  - Generates predictive insights (e.g., *Target reached in ~3.2 hrs*, *Confidence: 94.8%*).
  - Evaluates rate of change and forecast trends to preemptively prevent dry-out conditions.

- **🎛️ Embedded Hardware Digital Twin**:
  - **Arduino Controller Core**: Real-time simulation loop executing Exponential Moving Average (EMA) filtering ($\alpha = 0.25$) on analog capacitive soil moisture readings ($ADC_{10-bit}$).
  - **Relay & Submersible Pump Emulation**: Hysteresis-driven activation when moisture drops below threshold ($<30\%$) with flow rate and pumping duration telemetry.
  - **Piezo Buzzer Alarm**: Emulates 2.4 kHz audible frequency beeps when critical conditions (critical dry or sensor anomalies) occur.
  - **Hardware Display Emulators**:
    - **SSD1306 OLED (128x64)**: Monochrome blue pixel-rendered display with real-time graphs and telemetry pages.
    - **16x2 Character LCD**: Classic HD44780-style green backlit alphanumeric display with simulated custom glyphs.
  - **Live Serial Monitor**: Emulates 115200 baud UART logging with timestamped ANSI-colored logs, auto-scroll, and pause/resume toggle.

- **🔔 Comprehensive Notification System**:
  - Floating toast notifications for pump start/stop events, low moisture warnings, and anomaly triggers.
  - Non-intrusive sound effects synthesized in real-time via the **Web Audio API** (no external audio files required).
  - Notification history drawer accessible from the top navigation bar.

- **📱 Fully Responsive & Ergonomic UI**:
  - Eye-friendly matte slate and deep forest green color palette designed for low eye strain.
  - Flexible multi-column CSS grid that seamlessly transforms into a single-column layout on mobile devices (down to 320px).
  - Touch-friendly controls, interactive moisture adjustment slider, and auto-simulation drift toggle.

- **🚀 Zero Build Overhead**:
  - No npm, no Webpack/Vite, no frameworks.
  - Open `index.html` directly in any modern browser or launch with VS Code Live Server.

---

## 📂 File Architecture

```
plant-watering/
├── index.html              # Main dashboard entrypoint & semantic HTML layout
├── README.md               # Documentation & project guide
├── .gitignore              # Git ignore rules
├── assets/
│   └── icons.svg           # Scalable SVG sprite icons
├── css/
│   ├── base.css            # CSS variables, typography, reset, grid layouts
│   ├── gauge.css           # SVG arc moisture gauge styles & interactive slider
│   ├── display.css         # SSD1306 OLED & LCD1602 hardware bezels and screens
│   ├── cards.css           # Hardware cards (pump, buzzer, prediction, phase bar)
│   ├── notifications.css   # Floating toast alerts and notification drawer
│   └── animations.css      # Smooth micro-animations and keyframe definitions
└── js/
    ├── main.js             # Application initialization, event routing & master tick
    ├── simulation.js       # Arduino state machine, EMA filter, drift physics
    ├── ml-model.js         # TensorFlow.js neural network model & inference logic
    ├── gauge.js            # SVG gauge rendering and needle animation
    ├── display.js          # OLED & LCD character screen rendering
    ├── cards.js            # Pump telemetry, buzzer card, and prediction cards
    ├── serial.js           # 115200 baud serial monitor stream & logger
    └── notifications.js    # Web Audio chimes, toast alerts & drawer management
```

---

## 🚀 Getting Started

### Method 1: Direct File Launch
Double-click `index.html` or open it with any modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari).

### Method 2: Live Server (Recommended for local development)
1. In VS Code, install the **Live Server** extension (`ritwickdey.liveserver`).
2. Right-click `index.html` and select **"Open with Live Server"**.
3. Access the dashboard at `http://127.0.0.1:5500`.

---

## ⚙️ Hardware Simulation Parameters

| Parameter | Value | Description |
| :--- | :--- | :--- |
| **Baud Rate** | `115200 bps` | UART serial transmission speed |
| **EMA Smoothing ($\alpha$)** | `0.25` | Balances responsiveness and noise suppression |
| **Dry Threshold** | `< 30%` | Triggers relay activation and pump cycle |
| **Wet/Satisfied Threshold** | `> 65%` | Deactivates pump relay and enters monitoring phase |
| **Loop Frequency** | `20 Hz (50ms)` | Digital twin evaluation interval |
| **Prediction Horizon** | `1 – 6 Hours` | ML model forecasting window |

---

## 🛠️ Technologies Used

- **HTML5** & Semantic Markup
- **CSS3** (Custom Properties, CSS Grid, Flexbox, Glassmorphism, Keyframe Animations)
- **Vanilla ES6+ JavaScript** (Modules, Web Audio API, Canvas/SVG manipulation)
- **TensorFlow.js** (In-browser deep learning neural network inference)
