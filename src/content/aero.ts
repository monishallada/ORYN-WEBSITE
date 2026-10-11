/**
 * ORYN Aero — content for the hardware product page.
 *
 * IMPORTANT: specifications are intentionally unset. Do not publish
 * figures until they have been validated through testing. Set a value
 * (string) to display it; `null` renders as "To be established".
 */

export type Spec = { label: string; value: string | null; note?: string };

export const a1Specs: Spec[] = [
  { label: "Configuration", value: "Multirotor development platform" },
  { label: "Flight endurance", value: null },
  { label: "Payload capacity", value: null },
  { label: "Maximum takeoff weight", value: null },
  { label: "Operating range", value: null },
  { label: "Wind tolerance", value: null },
  { label: "Ingress protection", value: null },
  { label: "Sensor payloads", value: null, note: "See sensor compatibility direction" },
  { label: "Onboard compute", value: null },
  { label: "Certifications", value: null, note: "None claimed at this stage" },
];

export type Module = {
  id: string;
  name: string;
  summary: string;
  detail: string;
};

export const a1Modules: Module[] = [
  {
    id: "airframe",
    name: "Airframe",
    summary: "Rigid, serviceable structure",
    detail:
      "A frame designed around access and replaceability — arms, mounts, and covers that can be swapped without rebuilding the aircraft.",
  },
  {
    id: "propulsion",
    name: "Propulsion",
    summary: "Motors, ESCs, propellers",
    detail:
      "Brushless propulsion selected and characterized on the bench before integration, with thrust margins defined by the payloads we intend to carry.",
  },
  {
    id: "power",
    name: "Power",
    summary: "Battery & distribution",
    detail:
      "Isolated power distribution for propulsion, avionics, and payload, with monitoring designed in from the start.",
  },
  {
    id: "flight",
    name: "Flight control",
    summary: "Autopilot & navigation sensors",
    detail:
      "A dedicated flight controller handles stabilization and navigation independently of mission software, keeping the safety-critical loop simple.",
  },
  {
    id: "compute",
    name: "Edge compute",
    summary: "Companion computer",
    detail:
      "A separate companion computer for mission logic, capture management, and — over time — onboard inference.",
  },
  {
    id: "payload",
    name: "Sensor payload",
    summary: "Interchangeable mount",
    detail:
      "A standardized mechanical and electrical interface intended to accept different imaging sensors as the platform matures.",
  },
];

export const sensorDirection = [
  { name: "RGB imaging", status: "Initial focus", body: "High-resolution visible imagery for mapping, detection, and visual inspection." },
  { name: "Multispectral", status: "Planned evaluation", body: "Additional spectral bands for vegetation analysis beyond what visible light reveals." },
  { name: "Thermal", status: "Planned evaluation", body: "Radiometric or relative thermal imaging for water, heat, and night-time observation." },
  { name: "LiDAR", status: "Exploratory", body: "Active ranging for terrain and structure measurement under vegetation." },
];

export const flightControlChain = [
  { id: "sensors", label: "Navigation sensors", body: "IMU · barometer · magnetometer · GNSS" },
  { id: "estimation", label: "State estimation", body: "Sensor fusion for attitude, position, velocity" },
  { id: "control", label: "Control loops", body: "Attitude & position controllers" },
  { id: "mixer", label: "Motor mixing", body: "Commands mapped to individual motors" },
  { id: "esc", label: "ESCs & motors", body: "Propulsion output" },
];

export const companionChain = [
  { id: "mission", label: "Mission logic", body: "Survey patterns · waypoints · capture triggers" },
  { id: "capture", label: "Capture & metadata", body: "Images tagged with position, attitude, time" },
  { id: "edge", label: "Edge inference", body: "Onboard models (future)" },
  { id: "link", label: "Data link", body: "Telemetry & status to ORYN Command" },
];

export type Phase = { id: string; label: string; title: string; body: string; state: "complete" | "current" | "next" | "future" };

export const roadmap: Phase[] = [
  {
    id: "p0",
    label: "Phase 0",
    title: "Research & requirements",
    body: "Defining mission profiles, sensing needs, and operating constraints across target industries.",
    state: "current",
  },
  {
    id: "p1",
    label: "Phase 1",
    title: "A1 development platform",
    body: "Building and bench-testing the first integrated airframe, propulsion, and flight-control stack.",
    state: "current",
  },
  {
    id: "p2",
    label: "Phase 2",
    title: "Integrated sensing & compute",
    body: "Payload interface, capture pipeline, and companion computer integration.",
    state: "next",
  },
  {
    id: "p3",
    label: "Phase 3",
    title: "Controlled flight testing",
    body: "Structured test campaigns to characterize performance — the basis for any published specification.",
    state: "future",
  },
  {
    id: "p4",
    label: "Phase 4",
    title: "Managed service pilots",
    body: "Limited pilot programs with early partners, operated within applicable aviation regulations.",
    state: "future",
  },
];
