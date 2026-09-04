import { z } from "zod";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

type Profile = {
  ageGroup: "child" | "teen" | "adult" | "older";
  healthCondition: ("none" | "asthma" | "allergies" | "copd" | "stroke" | "pregnancy")[];
  occupation: "indoor" | "outdoor" | "commuter" | "athlete";
};

type WeatherPayload = {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    uv_index_max: number[];
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability: number[];
  };
  timezone: string;
};

type AirPayload = {
  current: {
    us_aqi: number;
    pm2_5: number;
    pm10: number;
    ozone: number;
    dust: number;
  };
  hourly: {
    time: string[];
    us_aqi: number[];
    pm2_5: number[];
    pm10: number[];
  };
};

type GeoResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
};

const profileSchema = z.object({
  ageGroup: z.enum(["child", "teen", "adult", "older"]),
  healthCondition: z.array(z.enum(["none", "asthma", "allergies", "copd", "stroke", "pregnancy"])).min(1),
  occupation: z.enum(["indoor", "outdoor", "commuter", "athlete"]),
});

const locationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  locationName: z.string(),
  timezone: z.string().optional(),
});

const currentSchema = z.object({
  temperature: z.number(),
  feelsLike: z.number(),
  humidity: z.number(),
  precipitation: z.number(),
  wind: z.number(),
  weather: z.string(),
  code: z.number(),
  aqi: z.number(),
  pm25: z.number(),
  pm10: z.number(),
  ozone: z.number(),
  dust: z.number(),
  uv: z.number(),
});

const riskSchema = z.object({
  score: z.number(),
  level: z.enum(["low", "moderate", "high"]),
});

function weatherDescription(code: number) {
  if (code === 0) return "Clear sky";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Misty";
  if ([51, 53, 55, 56, 57].includes(code)) return "Light drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain showers";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorms";
  return "Mixed conditions";
}

function riskFor(aqi: number, temperature: number, uv: number, profile: Profile) {
  let score = 12;
  if (aqi >= 50) score += Math.min(42, (aqi - 35) * 0.55);
  if (aqi >= 100) score += 14;
  if (temperature >= 32) score += Math.min(18, (temperature - 31) * 2.2);
  if (temperature <= 0) score += Math.min(24, Math.abs(temperature) * 0.45);
  if (temperature <= -10) score += 10;
  if (uv >= 6) score += Math.min(14, (uv - 5) * 2.4);
  if (profile.healthCondition.includes("asthma")) score += 13;
  if (profile.healthCondition.includes("allergies")) score += 8;
  if (profile.healthCondition.includes("copd")) score += 15;
  if (profile.healthCondition.includes("stroke")) score += 12;
  if (profile.healthCondition.includes("pregnancy")) score += 10;
  if (profile.ageGroup === "child" || profile.ageGroup === "older") score += 7;
  if (profile.occupation === "outdoor") score += 10;
  if (profile.occupation === "athlete") score += 6;
  if (profile.occupation === "commuter") score += 4;
  const normalized = Math.round(Math.max(8, Math.min(96, score)));
  return {
    score: normalized,
    level: normalized >= 70 ? "high" : normalized >= 42 ? "moderate" : "low",
  } as const;
}

function buildFallbackAdvisory(
  locationName: string,
  current: { aqi: number; temperature: number; uv: number; pm25: number },
  profile: Profile,
  risk: { level: "low" | "moderate" | "high" },
) {
  const condition = profile.healthCondition.includes("none") ? "no reported condition" : profile.healthCondition.join(", ");
  const exposure = profile.occupation === "outdoor" ? "outdoor work" : profile.occupation === "commuter" ? "commuting" : profile.occupation === "athlete" ? "athletic training" : "mostly indoor time";
  const isExtremeCold = current.temperature <= 0;
  const isExtremeHeat = current.temperature >= 35;
  const isPoorAir = current.aqi >= 100;
  const isHighUv = current.uv >= 6;
  const headline = isExtremeCold ? "Take extreme cold precautions" : isExtremeHeat ? "Take heat precautions" : risk.level === "high" ? "Take a more cautious day" : risk.level === "moderate" ? "Plan around the peaks" : "Good conditions for most plans";
  const actions = isExtremeCold ? [
    "Avoid unnecessary outdoor exposure; temperatures this low can cause frostbite and hypothermia quickly.",
    "Dress in multiple insulating layers, including a hat, gloves, scarf, and insulated footwear, and keep exposed skin covered.",
    "Stay indoors where possible and check heating, shelter, and travel conditions before leaving.",
  ] : isExtremeHeat ? [
    "Avoid strenuous outdoor activity during the hottest hours and move plans to the cooler morning or evening.",
    "Drink water regularly, use shade or air conditioning, and wear loose, light-coloured clothing.",
    "Never leave children, older adults, or pets in a parked vehicle, even briefly.",
  ] : [
    isPoorAir ? "Reduce prolonged outdoor time, close windows during pollution peaks, and use a well-fitting mask if you must go out." : "Keep normal plans, but take short breaks from direct sun and heat.",
    profile.healthCondition.includes("asthma") || profile.healthCondition.includes("copd") ? "Keep prescribed respiratory medicines accessible and follow your clinician’s action plan." : "Drink water regularly and choose shade if you are outside.",
    isHighUv ? "Use shade, sunscreen, and eye protection between late morning and mid-afternoon." : "Check conditions again before any long outdoor activity.",
  ];
  const watchFor = isExtremeCold ? "Watch for numbness, pale or hard skin, intense shivering, confusion, or unusual drowsiness." : isExtremeHeat ? "Watch for heavy sweating, dizziness, headache, nausea, confusion, or weakness." : current.pm25 >= 35 ? "Watch for coughing, chest tightness, wheezing, or unusual fatigue." : "Notice any unusual breathing symptoms or heat-related discomfort.";
  const avoid = isExtremeCold ? "Avoid prolonged exposure, wet clothing, and isolated travel without a warm shelter plan." : isExtremeHeat ? "Avoid intense exercise, direct sun, and poorly ventilated spaces during peak heat." : profile.occupation === "outdoor" && current.aqi >= 80 ? "Avoid the longest or hardest outdoor tasks while air quality is elevated." : "Avoid stacking intense exercise with the warmest part of the day.";
  return {
    headline,
    summary: `${locationName} is currently ${current.temperature.toFixed(0)}°C with a US AQI of ${Math.round(current.aqi)}. For someone with ${condition} and ${exposure}, a few simple adjustments can reduce exposure today.`,
    actions,
    watchFor,
    avoid,
  };
}

async function fetchConditions(latitude: number, longitude: number, timezone = "auto") {
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone,
    forecast_days: "2",
    past_days: "7",
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max",
    hourly: "temperature_2m,weather_code,precipitation_probability",
  }).toString();

  const airUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  airUrl.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone,
    forecast_days: "1",
    past_days: "7",
    current: "us_aqi,pm2_5,pm10,ozone,dust",
    hourly: "us_aqi,pm2_5,pm10",
  }).toString();

  const fetchWithTimeout = (url: URL) => fetch(url, { signal: AbortSignal.timeout(12_000) });
  const [weatherResponse, airResponse] = await Promise.all([fetchWithTimeout(weatherUrl), fetchWithTimeout(airUrl)]);
  if (!weatherResponse.ok || !airResponse.ok) {
    throw new Error("Live weather or air quality service is unavailable right now.");
  }
  const weather = (await weatherResponse.json()) as WeatherPayload;
  const air = (await airResponse.json()) as AirPayload;
  return { weather, air };
}

function buildTrend(weather: WeatherPayload, air: AirPayload, profile: Profile) {
  const weatherByTime = new Map(weather.hourly.time.map((time, index) => [time, weather.hourly.temperature_2m[index] ?? 0]));
  const days = new Map<string, { aqi: number[]; pm25: number[]; pm10: number[]; temp: number[]; codes: number[] }>();
  air.hourly.time.forEach((time, index) => {
    const date = time.slice(0, 10);
    const record = days.get(date) ?? { aqi: [], pm25: [], pm10: [], temp: [], codes: [] };
    const aqi = air.hourly.us_aqi[index];
    const pm25 = air.hourly.pm2_5[index];
    const pm10 = air.hourly.pm10[index];
    const temp = weatherByTime.get(time);
    if (typeof aqi === "number") record.aqi.push(aqi);
    if (typeof pm25 === "number") record.pm25.push(pm25);
    if (typeof pm10 === "number") record.pm10.push(pm10);
    if (typeof temp === "number") record.temp.push(temp);
    const code = weather.hourly.weather_code[index];
    if (typeof code === "number") record.codes.push(code);
    days.set(date, record);
  });

  return Array.from(days.entries()).sort(([a], [b]) => a.localeCompare(b)).slice(-7).map(([date, record]) => {
    const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const aqi = Math.max(...record.aqi, 0);
    const temperature = average(record.temp);
    const risk = riskFor(aqi, temperature, 4, profile);
    const codeCounts = new Map<number, number>();
    record.codes.forEach((code) => codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1));
    const majorityCode = Array.from(codeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    return {
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }),
      aqi: Math.round(aqi),
      pm25: Math.round(average(record.pm25) * 10) / 10,
      temperature: Math.round(temperature * 10) / 10,
      maxTemperature: Math.round((record.temp.length ? Math.max(...record.temp) : temperature) * 10) / 10,
      minTemperature: Math.round((record.temp.length ? Math.min(...record.temp) : temperature) * 10) / 10,
      weatherCode: majorityCode,
      risk: risk.level,
    };
  });
}

async function generateAdvisory(
  locationName: string,
  current: { aqi: number; pm25: number; pm10: number; ozone: number; temperature: number; feelsLike: number; humidity: number; wind: number; uv: number; weather: string },
  profile: Profile,
  risk: { score: number; level: "low" | "moderate" | "high" },
) {
  const fallback = buildFallbackAdvisory(locationName, current, profile, risk);
  // For dangerous temperature extremes, prefer deterministic safety guidance over generic generation.
  if (current.temperature <= 0 || current.temperature >= 35) return fallback;
  try {
    const catalog = await listLLMModels();
    const model = catalog.data.find((entry: { id: string }) => entry.id === "gpt-5-mini")?.id;
    const response = await invokeLLM({
      ...(model ? { model } : {}),
      reasoning: { effort: "minimal" },
      maxTokens: 520,
      messages: [
        {
          role: "system",
          content: "You are VayuCare, a cautious public-health communication assistant. Write short, plain-English guidance tailored to every provided condition. Temperature is critical: for temperatures at or below 0°C, prioritize hypothermia/frostbite prevention, insulation, covered skin, shelter, and avoiding unnecessary outdoor exposure; for temperatures at or above 35°C, prioritize heat illness prevention, hydration, shade, cooling, and avoiding strenuous activity. For high AQI or UV, give specific pollution or sun-protection advice. Never diagnose, never prescribe, and never imply a medical emergency is safe. Use only the provided data. Mention that this is general information and recommend a clinician for personal medical decisions. Return JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Create a personalized weather and air-quality advisory for the next several hours.",
            location: locationName,
            conditions: current,
            profile,
            computedRisk: risk,
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "vayucare_advisory",
          strict: true,
          schema: {
            type: "object",
            properties: {
              headline: { type: "string" },
              summary: { type: "string" },
              actions: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 4 },
              watchFor: { type: "string" },
              avoid: { type: "string" },
            },
            required: ["headline", "summary", "actions", "watchFor", "avoid"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== "string") return fallback;
    const parsed = JSON.parse(content) as typeof fallback;
    if (!parsed.headline || !parsed.summary || !Array.isArray(parsed.actions)) return fallback;
    return parsed;
  } catch (error) {
    console.warn("[VayuCare] Advisory generation fell back to rules:", error);
    return fallback;
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  location: router({
    search: publicProcedure.input(z.object({ query: z.string().min(2).max(80) })).query(async ({ input }) => {
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url.search = new URLSearchParams({ name: input.query, count: "6", language: "en", format: "json" }).toString();
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error("Location search is unavailable.");
      const data = (await response.json()) as { results?: GeoResult[] };
      return (data.results ?? []).map((result) => ({
        id: result.id,
        name: result.name,
        latitude: result.latitude,
        longitude: result.longitude,
        country: result.country ?? "",
        region: result.admin1 ?? "",
        timezone: result.timezone ?? "auto",
      }));
    }),
  }),
  dashboard: router({
    get: publicProcedure.input(z.object({ location: locationSchema, profile: profileSchema })).query(async ({ input }) => {
      const { weather, air } = await fetchConditions(input.location.latitude, input.location.longitude, input.location.timezone);
      const uv = weather.daily.uv_index_max?.[weather.daily.uv_index_max.length - 1] ?? 0;
      const current = {
        temperature: weather.current.temperature_2m,
        feelsLike: weather.current.apparent_temperature,
        humidity: weather.current.relative_humidity_2m,
        precipitation: weather.current.precipitation,
        wind: weather.current.wind_speed_10m,
        weather: weatherDescription(weather.current.weather_code),
        code: weather.current.weather_code,
        aqi: air.current.us_aqi,
        pm25: air.current.pm2_5,
        pm10: air.current.pm10,
        ozone: air.current.ozone,
        dust: air.current.dust,
        uv,
      };
      const risk = riskFor(current.aqi, current.temperature, current.uv, input.profile);
      const currentHourKey = weather.current.time.slice(0, 13);
      const currentHourIndex = weather.hourly.time.findIndex((time) => time.slice(0, 13) >= currentHourKey);
      const hourlyStart = currentHourIndex >= 0 ? currentHourIndex : Math.max(0, weather.hourly.time.length - 12);
      return {
        location: { ...input.location, timezone: weather.timezone },
        current,
        hourly: weather.hourly.time.slice(hourlyStart, hourlyStart + 12).map((time, index) => ({
          time,
          temperature: weather.hourly.temperature_2m[hourlyStart + index] ?? 0,
          code: weather.hourly.weather_code[hourlyStart + index] ?? 0,
          precipitationProbability: weather.hourly.precipitation_probability[hourlyStart + index] ?? 0,
        })),
        risk,
        forecast: weather.daily.time.slice(-3).map((date, index) => ({
          date,
          high: weather.daily.temperature_2m_max[weather.daily.time.indexOf(date)] ?? 0,
          low: weather.daily.temperature_2m_min[weather.daily.time.indexOf(date)] ?? 0,
          rain: weather.daily.precipitation_probability_max[weather.daily.time.indexOf(date)] ?? 0,
          uv: weather.daily.uv_index_max[weather.daily.time.indexOf(date)] ?? 0,
        })),
        trend: buildTrend(weather, air, input.profile),
        sourceUpdatedAt: new Date().toISOString(),
      };
    }),
  }),
  advisory: router({
    generate: publicProcedure.input(z.object({ locationName: z.string(), current: currentSchema, profile: profileSchema, risk: riskSchema })).query(async ({ input }) => {
      return generateAdvisory(input.locationName, input.current, input.profile, input.risk);
    }),
  }),
});

export type AppRouter = typeof appRouter;
