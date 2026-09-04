import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  ChevronDown,
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  ExternalLink,
  HeartPulse,
  MapPin,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Thermometer,
  Wind,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const defaultLocation = {
  id: 1277333,
  name: "Bengaluru",
  locationName: "Bengaluru, India",
  latitude: 12.9716,
  longitude: 77.5946,
  country: "India",
  region: "Karnataka",
  timezone: "Asia/Kolkata",
};

const ageLabels = { child: "Child (0-12)", teen: "Teen (13-19)", adult: "Adult (20-60)", older: "Older Adult (60+)" } as const;
const conditionLabels = { none: "No condition", asthma: "Asthma", allergies: "Allergies", copd: "COPD & Bronchitis", stroke: "Stroke & Hypertension", pregnancy: "Pregnancy" } as const;
const occupationLabels = { indoor: "Mostly indoors", outdoor: "Outdoor worker", commuter: "Daily commuter", athlete: "Athlete" } as const;
type ProfileState = {
  ageGroup: keyof typeof ageLabels;
  healthCondition: (keyof typeof conditionLabels)[];
  occupation: keyof typeof occupationLabels;
};
const defaultProfile: ProfileState = { ageGroup: "adult", healthCondition: ["asthma"], occupation: "outdoor" };

function aqiLabel(aqi: number) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for sensitive groups";
  if (aqi <= 200) return "Unhealthy";
  return "Very unhealthy";
}

function aqiColor(aqi: number) {
  if (aqi <= 50) return "#32b47a";
  if (aqi <= 100) return "#e1a72f";
  if (aqi <= 150) return "#f0794b";
  return "#d9516d";
}

function riskTone(level: string) {
  return level === "high" ? "rose" : level === "moderate" ? "amber" : "mint";
}

function formatTime(iso: string | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function greetingForTimezone(timezone?: string) {
  const hourText = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: timezone && timezone !== "auto" ? timezone : undefined,
  }).format(new Date());
  const hour = Number(hourText) % 24;
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function Sparkline({ values, color = "#54c59b" }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
    // Keep the plot in the lower band of the chart so it sits just above the day labels.
    const y = 36 - ((value - min) / Math.max(max - min, 1)) * 12;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 38" preserveAspectRatio="none" className="h-12 w-full overflow-visible" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      {points.split(" ").map((point, index) => { const [cx, cy] = point.split(","); return <circle key={index} cx={cx} cy={cy} r={index === points.split(" ").length - 1 ? "2.8" : "1.8"} fill={color} stroke="white" strokeWidth="0.8" />; })}
    </svg>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <label className="group relative block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 pr-9 text-sm font-medium text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        >
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-400" />
      </span>
    </label>
  );
}

function forecastLabel(code: number) {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Misty";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([95, 96, 99].includes(code)) return "Storm";
  return "Mixed";
}

function CurrentWeatherIcon({ code }: { code: number }) {
  if ([95, 96, 99].includes(code)) return <CloudLightning className="h-8 w-8 text-violet-500" />;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return <CloudRain className="h-8 w-8 text-sky-500" />;
  if ([1, 2, 3].includes(code)) return <CloudSun className="h-8 w-8 text-amber-500" />;
  if ([45, 48].includes(code)) return <Cloud className="h-8 w-8 text-slate-400" />;
  return <SunMedium className="h-8 w-8 text-amber-500" />;
}

function ForecastIcon({ code }: { code: number }) {
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return <CloudRain className="h-7 w-7 text-sky-500" />;
  if ([1, 2, 3, 45, 48].includes(code)) return <CloudRain className="h-7 w-7 text-slate-400" />;
  return <SunMedium className="h-7 w-7 text-amber-500" />;
}

function hourLabel(value: string, index: number) {
  if (index === 0) return "Now";
  const hour = Number(value.slice(11, 13));
  return `${String(hour).padStart(2, "0")}:00`;
}

function SideNav({ active = "overview", onClose }: { active?: string; onClose?: () => void }) {
  const items = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "history", label: "Trend history", icon: ArrowUpRight },
    { id: "profile", label: "Personalization", icon: HeartPulse },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-400 text-slate-950 shadow-[0_8px_25px_rgba(84,197,155,0.35)]"><ShieldCheck className="h-5 w-5" /></div>
        <div>
          <div className="font-display text-lg font-bold tracking-tight text-white">VayuCare</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Health intelligence</div>
        </div>
      </div>
      <div className="px-3 pt-5">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Workspace</p>
        <div className="mt-3 space-y-1">
          {items.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); onClose?.(); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${active === id ? "bg-white/10 text-white shadow-inner" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
              <Icon className={`h-4 w-4 ${active === id ? "text-emerald-300" : "text-slate-500"}`} />
              {label}
              {id === "overview" && <span className="ml-auto h-2 w-2 rounded-full bg-emerald-300" />}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-auto px-5 pb-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300"><Sparkles className="h-3.5 w-3.5" /> Adaptive advice</div>
          <p className="mt-2 text-xs leading-5 text-slate-400">Your guidance changes with your profile, not just the air quality number.</p>
        </div>
        <div className="mt-5 flex items-center gap-2 text-[11px] text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Live sources connected</div>
      </div>
    </div>
  );
}

export default function Home() {
  const [location, setLocation] = useState(defaultLocation);
  const [profile, setProfile] = useState(defaultProfile);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [recentSearches, setRecentSearches] = useState<typeof defaultLocation[]>(() => {
    try { return JSON.parse(localStorage.getItem("vayucare-recent-searches") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("vayucare-recent-searches", JSON.stringify(recentSearches));
  }, [recentSearches]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const greeting = useMemo(() => greetingForTimezone(location.timezone), [location.timezone, clock]);

  const searchInput = useMemo(() => ({ query: searchQuery.trim() }), [searchQuery]);
  const dashboardInput = useMemo(() => ({ location, profile }), [location, profile]);
  const search = trpc.location.search.useQuery(searchInput, { enabled: searchQuery.trim().length >= 2 });
  const dashboard = trpc.dashboard.get.useQuery(dashboardInput, { refetchInterval: 15 * 60 * 1000 });
  const data = dashboard.data;
  const current = data?.current;
  const advisoryInput = useMemo(() => data ? {
    locationName: data.location.locationName,
    current: data.current,
    profile,
    risk: data.risk,
  } : {
    locationName: location.locationName,
    current: {
      temperature: 0, feelsLike: 0, humidity: 0, precipitation: 0, wind: 0,
      weather: "Loading", code: 0, aqi: 0, pm25: 0, pm10: 0, ozone: 0, dust: 0, uv: 0,
    },
    profile,
    risk: { score: 0, level: "low" as const },
  }, [data, location.locationName, profile]);
  const advisory = trpc.advisory.generate.useQuery(advisoryInput, { enabled: Boolean(data), staleTime: 15 * 60 * 1000 });
  const trend = data?.trend ?? [];
  const tone = data ? riskTone(data.risk.level) : "mint";

  const updateProfile = (key: keyof typeof profile, value: string) => {
    setProfile((previous) => ({ ...previous, [key]: value } as typeof profile));
  };

  const updateAgeGroup = (value: string) => {
    setProfile((previous) => {
      const isMinor = value === "child" || value === "teen";
      const conditions = isMinor ? previous.healthCondition.filter((condition) => condition !== "pregnancy") : previous.healthCondition;
      return { ...previous, ageGroup: value, healthCondition: (conditions.length ? conditions : ["none"]) as typeof previous.healthCondition } as typeof profile;
    });
  };

  const toggleCondition = (condition: keyof typeof conditionLabels) => {
    setProfile((previous) => {
      const current = [...previous.healthCondition] as string[];
      if (condition === "none") return { ...previous, healthCondition: ["none"] as const };
      const withoutNone = current.filter((item) => item !== "none");
      const next = withoutNone.includes(condition) ? withoutNone.filter((item) => item !== condition) : [...withoutNone, condition];
      return { ...previous, healthCondition: (next.length ? next : ["none"]) as typeof previous.healthCondition };
    });
  };

  const useNearMe = () => {
    if (!navigator.geolocation) return;
    setNearMeLoading(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setLocation({ ...defaultLocation, id: 0, name: "Near me", locationName: "Near me", latitude: position.coords.latitude, longitude: position.coords.longitude, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "auto" });
      setNearMeLoading(false);
    }, () => setNearMeLoading(false), { enableHighAccuracy: true, timeout: 10000 });
  };

  return (
    <div className="min-h-screen bg-[#f6f8f5] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] bg-[#122b2d] lg:block">
        <SideNav />
      </aside>
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#f6f8f5]/90 backdrop-blur-xl">
          <div className="mx-auto flex h-[74px] max-w-[1480px] items-center justify-between gap-4 px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild><Button size="icon" variant="outline" className="border-slate-200 bg-white lg:hidden"><Menu className="h-5 w-5" /></Button></SheetTrigger>
                <SheetContent side="left" className="w-[270px] border-0 bg-[#122b2d] p-0 text-white"><SideNav onClose={() => setMobileNavOpen(false)} /></SheetContent>
              </Sheet>
              <div className="hidden sm:block"><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Personal health dashboard</p><h1 className="font-display text-xl font-bold tracking-tight text-slate-900">{greeting}, stay ahead of the air.</h1></div>
              <div className="sm:hidden"><p className="font-display text-lg font-bold text-slate-900">VayuCare</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 sm:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live monitoring</div>
            </div>
          </div>
        </header>

        <main id="overview" className="mx-auto max-w-[1480px] px-5 py-7 sm:px-8 sm:py-9">
          <section className="mb-8 grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="relative overflow-visible rounded-[28px] bg-[#183b3c] p-6 text-white shadow-[0_22px_55px_rgba(18,43,45,0.14)] sm:p-8">
              <div className="absolute right-[-16px] top-[-24px] h-40 w-40 rounded-full bg-emerald-300/10 blur-2xl" />
              <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-end">
                <div>
                  <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200"><MapPin className="h-4 w-4" /> Monitoring location</div>
                  <h2 className="font-display text-4xl font-bold tracking-[-0.045em] sm:text-5xl">{location.locationName}</h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Your live conditions, interpreted for <span className="font-semibold text-emerald-200">{profile.healthCondition.map((condition) => conditionLabels[condition as keyof typeof conditionLabels]).join(", ").toLowerCase()}</span> and a <span className="font-semibold text-emerald-200">{occupationLabels[profile.occupation].toLowerCase()}</span> lifestyle.</p>
                </div>
                <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-right backdrop-blur-sm"><div className="text-xs text-slate-400">Last checked</div><div className="mt-1 text-sm font-semibold text-white">{formatTime(data?.sourceUpdatedAt)} local time</div></div>
              </div>
              <div className="relative mt-8 flex flex-wrap gap-2 text-xs text-slate-300"><span className="rounded-full bg-white/10 px-3 py-1.5">{ageLabels[profile.ageGroup]}</span><span className="rounded-full bg-white/10 px-3 py-1.5">{profile.healthCondition.map((condition) => conditionLabels[condition as keyof typeof conditionLabels]).join(", ")}</span><span className="rounded-full bg-white/10 px-3 py-1.5">{occupationLabels[profile.occupation]}</span></div>
            </div>
            <div className="relative z-10 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_35px_rgba(35,55,45,0.06)]">
              <div className="mb-3 flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Change location</p><p className="mt-1 text-xs text-slate-400">Search any city or region</p></div><Search className="h-5 w-5 text-emerald-600" /></div>
              <div className="relative">
                <div className="relative"><Input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} placeholder="Try Mumbai, Delhi, London…" className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 pr-10 text-sm" /><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />{searchQuery && <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }} className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>}</div>
                {searchOpen && searchQuery.trim().length >= 2 && <div className="absolute left-0 right-0 top-14 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">{search.isLoading ? <div className="px-3 py-4 text-xs text-slate-500">Finding places…</div> : search.data?.length ? search.data.map((place) => <button key={place.id} onClick={() => { setLocation({ ...place, locationName: `${place.name}${place.country ? `, ${place.country}` : ""}` }); setRecentSearches((previous) => [{ ...place, locationName: `${place.name}${place.country ? `, ${place.country}` : ""}` }, ...previous.filter((item) => item.id !== place.id)].slice(0, 6)); setSearchQuery(""); setSearchOpen(false); }} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-emerald-50"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span><span className="block text-sm font-semibold text-slate-800">{place.name}</span><span className="block text-xs text-slate-500">{[place.region, place.country].filter(Boolean).join(", ")}</span></span></button>) : <div className="px-3 py-4 text-xs text-slate-500">No matching locations yet.</div>}</div>}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-slate-400"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Weather + AQI refresh every 15 minutes</span><button type="button" onClick={useNearMe} className="font-semibold text-emerald-700 hover:text-emerald-900">{nearMeLoading ? "Locating…" : "Near Me"}</button></div>
<div className="mt-5 border-t border-slate-200 pt-5"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Recent searches</p><span className="text-[11px] text-slate-400">Saved on this device</span></div>{recentSearches.length ? <div className="mt-3 flex flex-wrap gap-2">{recentSearches.map((item) => <button key={item.id} onClick={() => setLocation(item)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">{item.locationName}</button>)}</div> : <p className="mt-2 text-xs text-slate-400">Your searched locations will appear here.</p>}</div>
            </div>
          </section>

          <section id="profile" className="mb-8">            <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_14px_35px_rgba(35,55,45,0.06)]"><div className="flex items-start justify-between"><div><h2 className="font-display text-xl font-bold tracking-tight">Personalization</h2><p className="mt-1 text-sm text-slate-500">Small details make advice more useful.</p></div><div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50"><HeartPulse className="h-5 w-5 text-rose-500" /></div></div><div className="mt-6 grid gap-4 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3"><SelectField label="Age group" value={profile.ageGroup} options={Object.entries(ageLabels).map(([value, label]) => ({ value, label }))} onChange={updateAgeGroup} /><div><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Health conditions</span><div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">{Object.entries(conditionLabels).map(([value, label]) => <button type="button" key={value} disabled={(profile.ageGroup === "child" || profile.ageGroup === "teen") && value === "pregnancy"} onClick={() => toggleCondition(value as keyof typeof conditionLabels)} className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition ${((profile.ageGroup === "child" || profile.ageGroup === "teen") && value === "pregnancy") ? "cursor-not-allowed bg-slate-100 text-slate-300" : profile.healthCondition.includes(value as never) ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-emerald-50"}`}>{label}</button>)}</div></div><SelectField label="Occupation" value={profile.occupation} options={Object.entries(occupationLabels).map(([value, label]) => ({ value, label }))} onChange={(value) => updateProfile("occupation", value)} /></div><div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Profile stays in this browser for this demo.</div></div>
          </section>

          <section className="mb-8 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
            <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_35px_rgba(35,55,45,0.06)] sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="font-display text-xl font-bold tracking-tight">Current conditions</h2><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Live</span></div><p className="mt-1 text-sm text-slate-500">What your body is dealing with right now</p></div><Button variant="outline" size="sm" onClick={() => dashboard.refetch()} className="gap-2 border-slate-200 text-xs"><RefreshCw className={`h-3.5 w-3.5 ${dashboard.isFetching ? "animate-spin" : ""}`} /> Refresh</Button></div>
              {dashboard.isLoading ? <div className="grid h-[250px] place-items-center text-sm text-slate-500">Loading live conditions…</div> : dashboard.error ? <div className="rounded-2xl bg-rose-50 p-5 text-sm text-rose-800">We could not load live conditions. Try refreshing in a moment.</div> : current && <>
                <div className="grid gap-4 sm:grid-cols-[1.05fr_1fr_1fr]">
                  <div className="relative overflow-hidden rounded-2xl bg-[#eaf6ef] p-5"><div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-200/40 blur-xl" /><div className="relative flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Feels like</p><div className="mt-3 font-display text-5xl font-bold tracking-[-0.06em] text-[#183b3c]">{Math.round(current.temperature)}°</div><p className="mt-2 text-sm font-medium text-slate-600">{current.weather}</p></div><SunMedium className="h-8 w-8 text-amber-500" /></div><div className="relative mt-5 flex gap-4 border-t border-emerald-900/10 pt-3 text-xs text-slate-600"><span>Feels {Math.round(current.feelsLike)}°</span><span>·</span><span>{current.humidity}% humidity</span></div></div>
                  <div className="rounded-2xl border border-slate-200 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Air quality</p><div className="mt-3 font-display text-5xl font-bold tracking-[-0.06em]" style={{ color: aqiColor(current.aqi) }}>{Math.round(current.aqi)}</div></div><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100"><Wind className="h-5 w-5 text-slate-500" /></div></div><p className="mt-2 text-sm font-semibold" style={{ color: aqiColor(current.aqi) }}>{aqiLabel(current.aqi)}</p><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.min(100, current.aqi / 2.5)}%`, backgroundColor: aqiColor(current.aqi) }} /></div><p className="mt-2 text-xs text-slate-500">US AQI · PM2.5 {current.pm25.toFixed(1)} μg/m³</p></div>
                  <div className="rounded-2xl border border-slate-200 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">UV index</p><div className="mt-3 font-display text-5xl font-bold tracking-[-0.06em] text-slate-800">{Math.round(current.uv)}</div></div><div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50"><SunMedium className="h-5 w-5 text-amber-500" /></div></div><p className="mt-2 text-sm font-semibold text-amber-700">{current.uv >= 6 ? "High exposure" : current.uv >= 3 ? "Moderate exposure" : "Low exposure"}</p><div className="mt-5 grid grid-cols-2 gap-2 text-xs text-slate-500"><span className="flex items-center gap-1.5"><Droplets className="h-3.5 w-3.5" /> {current.humidity}% humidity</span><span className="flex items-center gap-1.5"><Wind className="h-3.5 w-3.5" /> {Math.round(current.wind)} km/h</span></div></div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><Thermometer className="h-4 w-4 text-rose-400" /><span className="text-xs text-slate-500">PM10 <strong className="ml-1 text-slate-800">{current.pm10.toFixed(1)}</strong></span></div><div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><CloudRain className="h-4 w-4 text-sky-500" /><span className="text-xs text-slate-500">Precipitation <strong className="ml-1 text-slate-800">{current.precipitation.toFixed(1)} mm</strong></span></div><div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><Activity className="h-4 w-4 text-violet-500" /><span className="text-xs text-slate-500">Ozone <strong className="ml-1 text-slate-800">{Math.round(current.ozone)} μg/m³</strong></span></div></div>
                <div className="mt-5 overflow-hidden rounded-2xl bg-[#f7faf8] ring-1 ring-slate-100">
                  <div className="flex items-center justify-between px-4 py-4 sm:px-5"><div><h3 className="font-display text-lg font-bold tracking-tight text-[#183b3c]">Hourly forecast</h3><p className="mt-0.5 text-xs text-slate-500">The next 12 hours for {location.locationName}</p></div><ArrowUpRight className="h-5 w-5 text-slate-400" /></div>
                  <div className="overflow-x-auto px-3 pb-4 sm:px-4"><div className="flex min-w-max gap-1.5">{(data?.hourly ?? []).map((hour, index) => <div key={hour.time} className={`flex w-[76px] shrink-0 flex-col items-center gap-2 rounded-xl px-2 py-3 text-center ${index === 0 ? "bg-white shadow-sm ring-1 ring-emerald-100" : ""}`}><span className="text-xs font-semibold text-slate-500">{hourLabel(hour.time, index)}</span><span className="font-display text-xl font-bold text-[#183b3c]">{Math.round(hour.temperature)}°</span><ForecastIcon code={hour.code} /><span className="text-[11px] font-medium text-slate-500">{forecastLabel(hour.code)}</span><span className="text-xs font-semibold text-sky-600">{hour.precipitationProbability}%</span></div>)}</div></div>
                  <div className="flex items-center gap-2 border-t border-slate-200/70 px-4 py-2.5 text-[11px] text-slate-400"><CloudRain className="h-3.5 w-3.5 text-sky-500" /> Precipitation probability · swipe horizontally for more hours</div>
                </div>
              </>}
            </div>
            <div className={`relative overflow-hidden rounded-[26px] p-6 text-white shadow-[0_14px_35px_rgba(35,55,45,0.09)] ${tone === "rose" ? "bg-[#71394b]" : tone === "amber" ? "bg-[#70572d]" : "bg-[#1f5550]"}`}>
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" /><div className="relative"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/65">Your exposure score</p><div className="mt-3 flex items-baseline gap-2"><span className="font-display text-6xl font-bold tracking-[-0.07em]">{data?.risk.score ?? "—"}</span><span className="text-sm text-white/60">/ 100</span></div></div><div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><HeartPulse className="h-6 w-6 text-emerald-200" /></div></div><div className="mt-2 flex items-center gap-2 text-sm font-semibold"><span className="h-2 w-2 rounded-full bg-emerald-200" /> {data?.risk.level === "high" ? "High attention" : data?.risk.level === "moderate" ? "Moderate attention" : "Low attention"}</div><p className="mt-5 text-sm leading-6 text-white/75">A simple blend of live air, heat, UV, and the profile you shared. It is a planning signal, not a diagnosis.</p><div className="mt-7 border-t border-white/15 pt-4 text-xs text-white/60">Personalized for {profile.healthCondition.map((condition) => conditionLabels[condition]).join(", ").toLowerCase()} + {occupationLabels[profile.occupation].toLowerCase()}</div></div>
            </div>
          </section>

          <section className="mb-8">
            <div className="rounded-[26px] border border-emerald-200/70 bg-[#effaf1] p-6 shadow-[0_14px_35px_rgba(35,55,45,0.05)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-emerald-700" /><h2 className="font-display text-xl font-bold tracking-tight text-[#183b3c]">Your AI health advisory</h2></div><p className="mt-1 text-sm text-slate-600">Plain-English guidance built from your profile and live conditions.</p></div><span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700 shadow-sm">AI-generated</span></div>{advisory.data ? <div className="mt-6"><h3 className="font-display text-2xl font-bold tracking-tight text-[#183b3c]">{advisory.data.headline}</h3><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">{advisory.data.summary}</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{advisory.data.actions.slice(0, 4).map((action, index) => <div key={action} className="flex gap-3 rounded-2xl border border-emerald-200/70 bg-white/75 p-3.5"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-700 text-xs font-bold text-white">{index + 1}</span><span className="text-sm leading-5 text-slate-700">{action}</span></div>)}</div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white/70 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-700"><AlertTriangle className="h-4 w-4" /> Watch for</div><p className="mt-2 text-sm leading-5 text-slate-700">{advisory.data.watchFor}</p></div><div className="rounded-2xl bg-white/70 p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-rose-700"><ArrowDownRight className="h-4 w-4" /> Avoid</div><p className="mt-2 text-sm leading-5 text-slate-700">{advisory.data.avoid}</p></div></div><p className="mt-5 text-[11px] leading-5 text-slate-500">General information only—not a diagnosis or a substitute for clinical advice. If symptoms are severe or sudden, seek urgent medical care.</p></div> : <div className="mt-7 h-48 animate-pulse rounded-2xl bg-white/60" />}</div>
          </section>

          <section id="history" className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_14px_35px_rgba(35,55,45,0.06)]">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="font-display text-xl font-bold tracking-tight">Seven-day exposure trend</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">History</span></div><p className="mt-1 text-sm text-slate-500">A quick daily view of temperature extremes and air quality.</p></div><div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">{trend.length || 0} days tracked</div></div>
            <div className="mt-6 overflow-x-auto pb-2"><div className="flex min-w-max gap-3">{trend.map((day, index) => <div key={day.date} className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${index === trend.length - 1 ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-white"}`}><div className="flex items-start justify-between gap-8"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{index === trend.length - 1 ? "Today" : day.label}</p><p className="mt-1 text-[11px] text-slate-400">{day.date}</p></div><ForecastIcon code={day.weatherCode} /></div><div className="mt-5 grid grid-cols-3 gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Maximum Temperature</p><p className="mt-1 font-display text-xl font-bold text-slate-800">{Math.round(day.maxTemperature)}°</p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Minimum Temperature</p><p className="mt-1 font-display text-xl font-bold text-slate-800">{Math.round(day.minTemperature)}°</p></div><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">AQI</p><p className="mt-1 font-display text-xl font-bold" style={{ color: aqiColor(day.aqi) }}>{day.aqi}</p></div></div><div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-3 text-[11px] text-slate-500"><span>{forecastLabel(day.weatherCode)}</span><span className="font-semibold" style={{ color: aqiColor(day.aqi) }}>{aqiLabel(day.aqi)}</span></div></div>)}</div></div>
          </section>

          <section className="mt-8 overflow-hidden rounded-[26px] border border-slate-200 bg-[#102f32] p-6 text-white shadow-[0_18px_45px_rgba(16,47,50,0.16)]">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-emerald-300" /><h2 className="font-display text-xl font-bold tracking-tight">Weather radar view</h2><span className="rounded-full bg-emerald-300/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200">Live pulse</span></div><p className="mt-1 text-sm text-slate-300">Radar-style precipitation intensity around {location.locationName}.</p></div><div className="rounded-xl bg-white/10 px-3 py-2 text-right text-xs text-slate-300"><div className="font-semibold text-white">{current ? current.weather : "Loading"}</div><div className="mt-0.5">{current ? Math.round(current.temperature) + "° · " + current.precipitation + " mm" : "Awaiting live data"}</div></div></div>
            <div className="mt-6 grid items-center gap-4 lg:grid-cols-[150px_minmax(0,1fr)_150px]">
              <div className="order-2 grid gap-3 lg:order-1"><div className="rounded-xl border border-white/10 bg-white/[0.07] p-3 text-xs text-slate-300"><span className="mb-2 inline-flex h-2 w-2 rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.12)]" /> <strong className="ml-1 text-white">You</strong><p className="mt-1 leading-4">Current location</p></div><div className="rounded-xl border border-white/10 bg-white/[0.07] p-3 text-xs text-slate-300"><span className="mb-2 inline-block h-3 w-3 rounded-full border border-emerald-300/60" /><strong className="ml-1 text-white">Distance zones</strong><p className="mt-1 leading-4">Circular rings around you</p></div></div>
              <div className="relative order-1 h-[330px] overflow-hidden rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(84,197,155,0.22),rgba(10,39,43,0.98)_62%)] lg:order-2"><div className="absolute inset-1/2 h-[270px] w-[270px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/20" /><div className="absolute inset-1/2 h-[190px] w-[190px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/25" /><div className="absolute inset-1/2 h-[110px] w-[110px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/30" /><div className="absolute left-1/2 top-1/2 h-[1px] w-[44%] origin-left -translate-y-1/2 rotate-[-28deg] bg-gradient-to-r from-emerald-200 to-transparent opacity-80" /><div className="absolute left-[30%] top-[38%] h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_18px_6px_rgba(125,211,252,0.45)]" /><div className="absolute left-[63%] top-[57%] h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_6px_rgba(110,231,183,0.4)]" /><div className="absolute left-[51%] top-[49%] grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-emerald-400 text-xs font-bold text-[#102f32] shadow-[0_0_0_8px_rgba(84,197,155,0.18)]">You</div></div>
              <div className="order-3 grid gap-3"><div className="rounded-xl border border-white/10 bg-white/[0.07] p-3 text-xs text-slate-300"><span className="mb-2 inline-block h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_10px_3px_rgba(125,211,252,0.35)]" /><strong className="ml-1 text-white">Rain</strong><p className="mt-1 leading-4">Precipitation intensity</p></div><div className="rounded-xl border border-white/10 bg-white/[0.07] p-3 text-xs text-slate-300"><span className="mb-2 inline-block h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_3px_rgba(110,231,183,0.3)]" /><strong className="ml-1 text-white">Clear-air pulse</strong><p className="mt-1 leading-4">Lower exposure area</p></div></div>
            </div>
          </section>
          <footer className="mt-7 flex flex-col justify-between gap-3 border-t border-slate-200 py-5 text-xs text-slate-500 sm:flex-row sm:items-center"><div>VayuCare · Built for clearer decisions, not generic alerts.</div><div className="flex items-center gap-4"><a className="inline-flex items-center gap-1 hover:text-emerald-700" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather by Open-Meteo <ExternalLink className="h-3 w-3" /></a><a className="inline-flex items-center gap-1 hover:text-emerald-700" href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noreferrer">AQI source <ExternalLink className="h-3 w-3" /></a></div></footer>
        </main>
      </div>
    </div>
  );
}
