
import { useState, useMemo, useEffect } from "react";

// ─── TIMEZONE DATA ────────────────────────────────────────────────────────────
const TIMEZONES = [
  { label: "PT — Pacific Time",        tz: "America/Los_Angeles" },
  { label: "MT — Mountain Time",       tz: "America/Denver" },
  { label: "CT — Central Time",        tz: "America/Chicago" },
  { label: "ET — Eastern Time",        tz: "America/New_York" },
  { label: "GMT — London",             tz: "Europe/London" },
  { label: "CET — Paris / Berlin",     tz: "Europe/Paris" },
  { label: "AEST — Sydney",            tz: "Australia/Sydney" },
  { label: "JST — Tokyo",              tz: "Asia/Tokyo" },
  { label: "BRT — São Paulo",          tz: "America/Sao_Paulo" },
  { label: "GST — Dubai",              tz: "Asia/Dubai" },
];

// Parse "3:30 PM CET" style strings into a UTC Date given a reference date string "YYYY-MM-DD"
// Returns null for "TBC" or "All day"
function parseSessionTime(dateStr, timeStr) {
  if (!timeStr || timeStr === "TBC" || timeStr.toLowerCase().includes("all day")) return null;
  // Extract numeric time and meridiem
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const mins = parseInt(match[2]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  // Determine source timezone from suffix
  const upper = timeStr.toUpperCase();
  let srcTz = "America/Los_Angeles"; // default PT
  if (upper.includes("ET"))   srcTz = "America/New_York";
  else if (upper.includes("CT"))  srcTz = "America/Chicago";
  else if (upper.includes("MT"))  srcTz = "America/Denver";
  else if (upper.includes("PT"))  srcTz = "America/Los_Angeles";
  else if (upper.includes("CET") || upper.includes("CEST")) srcTz = "Europe/Paris";
  else if (upper.includes("GMT") || upper.includes("BST"))  srcTz = "Europe/London";
  else if (upper.includes("AEDT") || upper.includes("AEST")) srcTz = "Australia/Sydney";
  else if (upper.includes("JST")) srcTz = "Asia/Tokyo";
  else if (upper.includes("BRT")) srcTz = "America/Sao_Paulo";

  try {
    // Build an ISO string in the source timezone, convert to UTC via Intl
    const naive = `${dateStr}T${String(hours).padStart(2,"0")}:${String(mins).padStart(2,"0")}:00`;
    // Use Intl to find offset of srcTz at that moment
    const tmpDate = new Date(naive + "Z"); // treat as UTC temporarily
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: srcTz, hour: "numeric", minute: "numeric", hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit"
    });
    // Binary search isn't needed — use a simpler offset approach
    // Get the UTC offset for srcTz at the approximate date
    const probe = new Date(`${dateStr}T12:00:00Z`);
    const srcStr = probe.toLocaleString("en-US", { timeZone: srcTz, hour12: false, hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
    // Use offsetFromTz utility
    const offsetMs = getOffsetMs(srcTz, probe);
    const utcMs = probe.setHours(0,0,0,0) + hours * 3600000 + mins * 60000 - offsetMs;
    // Actually just do it properly:
    const d = new Date(`${dateStr}T${String(hours).padStart(2,"0")}:${String(mins).padStart(2,"0")}:00`);
    const off = getOffsetMs(srcTz, d);
    return new Date(d.getTime() - off);
  } catch {
    return null;
  }
}

function getOffsetMs(tz, date) {
  // Returns UTC offset in ms for a given timezone at a given date
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const tzStr  = date.toLocaleString("en-US", { timeZone: tz,  hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return Date.parse(tzStr.replace(/(\d+)\/(\d+)\/(\d+),/, "$3-$1-$2")) -
         Date.parse(utcStr.replace(/(\d+)\/(\d+)\/(\d+),/, "$3-$1-$2"));
}

function formatInTz(utcDate, tz, showDate = false) {
  if (!utcDate) return null;
  try {
    const opts = { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true };
    if (showDate) Object.assign(opts, { weekday: "short", month: "short", day: "numeric" });
    return new Intl.DateTimeFormat("en-US", opts).format(utcDate);
  } catch { return null; }
}

function tzAbbr(tz) {
  try {
    const s = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).format(new Date());
    return s.split(", ")[1] || tz;
  } catch { return tz; }
}

// ─── SERIES META ─────────────────────────────────────────────────────────────
const SERIES_META = {
  "IMSA":           { color: "#E8502A" },
  "IndyCar":        { color: "#4A7FC1" },
  "NASCAR":         { color: "#FFB800" },
  "WEC":            { color: "#00A859" },
  "F1":             { color: "#E8002D" },
  "SRO":            { color: "#6B3FA0" },
  "Formula Drift":  { color: "#D4162A" },
  "GridLife":       { color: "#3DAA4E" },
  "ELMS":           { color: "#1B5EA6" },
  "Off-Road":       { color: "#B86B1B" },
  "Pikes Peak":     { color: "#C4832A" },
  "Ferrari Chall.": { color: "#CC0000" },
  "Car Week":       { color: "#B59A5C" },
  "24hr":           { color: "#0D7A5F" },
  "Cultural":       { color: "#666666" },
  "Personal":       { color: "#7B68EE" },
};

// ─── EVENTS ──────────────────────────────────────────────────────────────────
const BASE_EVENTS = [
  { id:1,  year:2026, series:"Off-Road",       name:"Mint 400",                               circuit:"Las Vegas Desert, NV",            country:"USA",       date:"2026-03-07", endDate:"2026-03-09", intl:false, camp:false, status:"done",
    sessions:[{label:"Race Day",date:"2026-03-09",time:"7:00 AM PT"}] },
  { id:2,  year:2026, series:"Ferrari Chall.", name:"Ferrari Challenge at Thermal",            circuit:"The Thermal Club, CA",            country:"USA",       date:"2026-03-14", endDate:"2026-03-16", intl:false, camp:false, status:"done",
    sessions:[{label:"Race 1",date:"2026-03-15",time:"10:00 AM PT"},{label:"Race 2",date:"2026-03-16",time:"10:00 AM PT"}] },
  { id:3,  year:2026, series:"IndyCar",        name:"Acura Grand Prix of Long Beach",          circuit:"Streets of Long Beach, CA",       country:"USA",       date:"2026-04-11", endDate:"2026-04-13", intl:false, camp:false, status:"done",
    sessions:[{label:"Practice 1",date:"2026-04-11",time:"11:30 AM PT"},{label:"Qualifying",date:"2026-04-12",time:"10:00 AM PT"},{label:"Race",date:"2026-04-13",time:"12:45 PM PT"}] },
  { id:4,  year:2026, series:"IMSA",           name:"IMSA Laguna Seca",                        circuit:"WeatherTech Raceway Laguna Seca", country:"USA",       date:"2026-05-02", endDate:"2026-05-04", intl:false, camp:true,  status:"done",
    sessions:[{label:"Practice",date:"2026-05-02",time:"9:00 AM PT"},{label:"Qualifying",date:"2026-05-03",time:"10:00 AM PT"},{label:"Race",date:"2026-05-04",time:"12:10 PM PT"}] },
  { id:5,  year:2026, series:"24hr",           name:"Nürburgring 24hr",                        circuit:"Nürburgring Nordschleife",        country:"Germany",   date:"2026-05-23", endDate:"2026-05-25", intl:true,  camp:true,  status:"done",
    sessions:[{label:"Qualifying",date:"2026-05-23",time:"5:00 PM CET"},{label:"Race Start",date:"2026-05-24",time:"3:30 PM CET"},{label:"Race Finish",date:"2026-05-25",time:"3:30 PM CET"}] },
  { id:6,  year:2026, series:"SRO",            name:"GT World Challenge Europe — Paul Ricard", circuit:"Circuit Paul Ricard",             country:"France",    date:"2026-06-07", endDate:"2026-06-08", intl:true,  camp:true,  status:"upcoming",
    sessions:[{label:"Race 1",date:"2026-06-07",time:"3:00 PM CET"},{label:"Race 2",date:"2026-06-08",time:"1:00 PM CET"}] },
  { id:7,  year:2026, series:"WEC",            name:"24 Heures du Mans",                       circuit:"Circuit de la Sarthe",            country:"France",    date:"2026-06-14", endDate:"2026-06-15", intl:true,  camp:true,  status:"upcoming",
    sessions:[{label:"Test Day",date:"2026-06-07",time:"9:00 AM CET"},{label:"Practice 1",date:"2026-06-11",time:"2:00 PM CET"},{label:"Hyperpole",date:"2026-06-12",time:"10:00 PM CET"},{label:"Race Start",date:"2026-06-14",time:"4:00 PM CET"},{label:"Race Finish",date:"2026-06-15",time:"4:00 PM CET"}] },
  { id:8,  year:2026, series:"Pikes Peak",     name:"Pikes Peak International Hill Climb",     circuit:"Pikes Peak, CO",                 country:"USA",       date:"2026-06-22", endDate:"2026-06-22", intl:false, camp:false, status:"upcoming",
    sessions:[{label:"Race Day",date:"2026-06-22",time:"7:30 AM MT"}] },
  { id:9,  year:2026, series:"IMSA",           name:"Sahlen's Six Hours of the Glen",          circuit:"Watkins Glen International",      country:"USA",       date:"2026-07-05", endDate:"2026-07-06", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Practice",date:"2026-07-04",time:"9:40 AM ET"},{label:"Qualifying",date:"2026-07-05",time:"9:05 AM ET"},{label:"Race",date:"2026-07-05",time:"10:10 AM ET"}] },
  { id:10, year:2026, series:"Formula Drift",  name:"Formula Drift — Monroe, WA",              circuit:"Evergreen Speedway",              country:"USA",       date:"2026-07-11", endDate:"2026-07-12", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Practice & Qualifying",date:"2026-07-11",time:"10:00 AM PT"},{label:"Top 32 / Finals",date:"2026-07-12",time:"12:00 PM PT"}] },
  { id:11, year:2026, series:"IMSA",           name:"IMSA Road America",                       circuit:"Road America",                    country:"USA",       date:"2026-08-01", endDate:"2026-08-03", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Practice",date:"2026-08-01",time:"9:35 AM CT"},{label:"Qualifying",date:"2026-08-02",time:"9:05 AM CT"},{label:"Race",date:"2026-08-02",time:"12:05 PM CT"}] },
  { id:12, year:2026, series:"Off-Road",       name:"Crandon World Championship",              circuit:"Crandon International Raceway",   country:"USA",       date:"2026-08-09", endDate:"2026-08-10", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Day 1 Races",date:"2026-08-09",time:"10:00 AM CT"},{label:"Day 2 Races",date:"2026-08-10",time:"10:00 AM CT"}] },
  { id:13, year:2026, series:"Car Week",       name:"Monterey Car Week",                       circuit:"Monterey Peninsula",              country:"USA",       date:"2026-08-13", endDate:"2026-08-17", intl:false, camp:false, status:"upcoming",
    sessions:[{label:"Rolex Motorsports Reunion",date:"2026-08-14",time:"All day"},{label:"Pebble Beach Concours",date:"2026-08-17",time:"8:00 AM PT"}] },
  { id:14, year:2026, series:"NASCAR",         name:"NASCAR at Watkins Glen",                  circuit:"Watkins Glen International",      country:"USA",       date:"2026-08-22", endDate:"2026-08-24", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Practice",date:"2026-08-22",time:"10:05 AM ET"},{label:"Qualifying",date:"2026-08-23",time:"11:00 AM ET"},{label:"Cup Race",date:"2026-08-24",time:"3:00 PM ET"}] },
  { id:15, year:2026, series:"IndyCar",        name:"Firestone Grand Prix Monterey",           circuit:"WeatherTech Raceway Laguna Seca", country:"USA",       date:"2026-09-12", endDate:"2026-09-14", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Practice 1",date:"2026-09-12",time:"11:00 AM PT"},{label:"Qualifying",date:"2026-09-13",time:"11:00 AM PT"},{label:"Race",date:"2026-09-14",time:"1:00 PM PT"}] },
  { id:16, year:2026, series:"SRO",            name:"GT World Challenge America — Sonoma",     circuit:"Sonoma Raceway",                  country:"USA",       date:"2026-09-20", endDate:"2026-09-21", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Race 1",date:"2026-09-20",time:"11:00 AM PT"},{label:"Race 2",date:"2026-09-21",time:"11:00 AM PT"}] },
  { id:17, year:2026, series:"GridLife",       name:"GridLife Laguna Seca",                    circuit:"WeatherTech Raceway Laguna Seca", country:"USA",       date:"2026-10-03", endDate:"2026-10-05", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Day 1",date:"2026-10-03",time:"All day"},{label:"Day 2",date:"2026-10-04",time:"All day"},{label:"Day 3",date:"2026-10-05",time:"All day"}] },
  { id:18, year:2026, series:"IMSA",           name:"Petit Le Mans",                           circuit:"Michelin Raceway Road Atlanta",   country:"USA",       date:"2026-10-17", endDate:"2026-10-18", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Practice",date:"2026-10-16",time:"10:00 AM ET"},{label:"Qualifying",date:"2026-10-17",time:"12:35 PM ET"},{label:"Race",date:"2026-10-18",time:"11:10 AM ET"}] },
  { id:19, year:2026, series:"Cultural",       name:"SEMA Show",                               circuit:"Las Vegas Convention Center",     country:"USA",       date:"2026-11-04", endDate:"2026-11-07", intl:false, camp:false, status:"upcoming",
    sessions:[{label:"Show Days",date:"2026-11-04",time:"All day"}] },
  { id:20, year:2027, series:"IMSA",           name:"Rolex 24 at Daytona",                     circuit:"Daytona International Speedway",  country:"USA",       date:"2027-01-30", endDate:"2027-02-01", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Roar Test Days",date:"2027-01-10",time:"TBC"},{label:"Practice/Qual",date:"2027-01-30",time:"8:00 AM ET"},{label:"Race Start",date:"2027-01-31",time:"1:35 PM ET"},{label:"Race Finish",date:"2027-02-01",time:"1:35 PM ET"}] },
  { id:21, year:2027, series:"Off-Road",       name:"King of the Hammers",                     circuit:"Johnson Valley OHV, CA",          country:"USA",       date:"2027-02-05", endDate:"2027-02-08", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Ultra4 Car Race",date:"2027-02-07",time:"8:00 AM PT"}] },
  { id:22, year:2027, series:"24hr",           name:"Bathurst 12 Hour",                        circuit:"Mount Panorama",                  country:"Australia", date:"2027-02-06", endDate:"2027-02-07", intl:true,  camp:true,  status:"upcoming",
    sessions:[{label:"Practice",date:"2027-02-05",time:"9:05 AM AEDT"},{label:"Top 10 Shootout",date:"2027-02-06",time:"12:05 PM AEDT"},{label:"Race Start",date:"2027-02-06",time:"5:15 PM AEDT"},{label:"Race Finish",date:"2027-02-07",time:"5:15 PM AEDT"}] },
  { id:23, year:2027, series:"Off-Road",       name:"Mint 400",                                circuit:"Las Vegas Desert, NV",            country:"USA",       date:"2027-03-06", endDate:"2027-03-08", intl:false, camp:false, status:"upcoming",
    sessions:[{label:"Race Day",date:"2027-03-08",time:"7:00 AM PT"}] },
  { id:24, year:2027, series:"IMSA",           name:"Mobil 1 Twelve Hours of Sebring",         circuit:"Sebring International Raceway",   country:"USA",       date:"2027-03-19", endDate:"2027-03-22", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Practice 1",date:"2027-03-19",time:"1:00 PM ET"},{label:"Qualifying",date:"2027-03-20",time:"7:30 PM ET"},{label:"Race",date:"2027-03-22",time:"10:10 AM ET"}] },
  { id:25, year:2027, series:"SRO",            name:"GT World Challenge Europe — Brands Hatch", circuit:"Brands Hatch",                  country:"UK",        date:"2027-04-17", endDate:"2027-04-20", intl:true,  camp:true,  status:"upcoming",
    sessions:[{label:"Race 1",date:"2027-04-19",time:"1:00 PM GMT"},{label:"Race 2",date:"2027-04-20",time:"12:00 PM GMT"}] },
  { id:26, year:2027, series:"IndyCar",        name:"Acura Grand Prix of Long Beach",          circuit:"Streets of Long Beach, CA",       country:"USA",       date:"2027-04-11", endDate:"2027-04-13", intl:false, camp:false, status:"upcoming",
    sessions:[{label:"Practice",date:"2027-04-11",time:"11:30 AM PT"},{label:"Qualifying",date:"2027-04-12",time:"10:00 AM PT"},{label:"Race",date:"2027-04-13",time:"12:45 PM PT"}] },
  { id:27, year:2027, series:"Formula Drift",  name:"Formula Drift Long Beach",                circuit:"Streets of Long Beach, CA",       country:"USA",       date:"2027-04-09", endDate:"2027-04-10", intl:false, camp:false, status:"upcoming",
    sessions:[{label:"Practice & Qualifying",date:"2027-04-09",time:"10:00 AM PT"},{label:"Top 32 / Finals",date:"2027-04-10",time:"12:00 PM PT"}] },
  { id:28, year:2027, series:"IMSA",           name:"IMSA Laguna Seca",                        circuit:"WeatherTech Raceway Laguna Seca", country:"USA",       date:"2027-05-08", endDate:"2027-05-11", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Practice",date:"2027-05-09",time:"9:00 AM PT"},{label:"Qualifying",date:"2027-05-10",time:"10:00 AM PT"},{label:"Race",date:"2027-05-11",time:"12:10 PM PT"}] },
  { id:29, year:2027, series:"WEC",            name:"WEC 6 Hours of Spa",                      circuit:"Circuit de Spa-Francorchamps",    country:"Belgium",   date:"2027-05-08", endDate:"2027-05-10", intl:true,  camp:true,  status:"upcoming",
    sessions:[{label:"Practice 1",date:"2027-05-08",time:"3:30 PM CET"},{label:"Qualifying",date:"2027-05-09",time:"6:00 PM CET"},{label:"Race",date:"2027-05-10",time:"1:30 PM CET"}] },
  { id:30, year:2027, series:"24hr",           name:"Nürburgring 24hr",                        circuit:"Nürburgring Nordschleife",        country:"Germany",   date:"2027-05-29", endDate:"2027-06-01", intl:true,  camp:true,  status:"upcoming",
    sessions:[{label:"Qualifying Race",date:"2027-05-29",time:"5:00 PM CET"},{label:"Race Start",date:"2027-05-31",time:"3:30 PM CET"},{label:"Race Finish",date:"2027-06-01",time:"3:30 PM CET"}] },
  { id:31, year:2027, series:"Cultural",       name:"Goodwood Festival of Speed",              circuit:"Goodwood Estate",                country:"UK",        date:"2027-06-03", endDate:"2027-06-06", intl:true,  camp:false, status:"upcoming",
    sessions:[{label:"Hill Climb Days",date:"2027-06-04",time:"All day"}] },
  { id:32, year:2027, series:"WEC",            name:"24 Heures du Mans",                       circuit:"Circuit de la Sarthe",            country:"France",    date:"2027-06-12", endDate:"2027-06-13", intl:true,  camp:true,  status:"upcoming",
    sessions:[{label:"Test Day",date:"2027-06-06",time:"9:00 AM CET"},{label:"Practice 1",date:"2027-06-10",time:"2:00 PM CET"},{label:"Hyperpole",date:"2027-06-11",time:"10:00 PM CET"},{label:"Race Start",date:"2027-06-12",time:"4:00 PM CET"},{label:"Race Finish",date:"2027-06-13",time:"4:00 PM CET"}] },
  { id:33, year:2027, series:"Pikes Peak",     name:"Pikes Peak International Hill Climb",     circuit:"Pikes Peak, CO",                 country:"USA",       date:"2027-06-20", endDate:"2027-06-20", intl:false, camp:false, status:"upcoming",
    sessions:[{label:"Race Day",date:"2027-06-20",time:"7:30 AM MT"}] },
  { id:34, year:2027, series:"IMSA",           name:"Sahlen's Six Hours of the Glen",          circuit:"Watkins Glen International",      country:"USA",       date:"2027-07-03", endDate:"2027-07-06", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Practice",date:"2027-07-04",time:"9:40 AM ET"},{label:"Qualifying",date:"2027-07-05",time:"9:05 AM ET"},{label:"Race",date:"2027-07-05",time:"10:10 AM ET"}] },
  { id:35, year:2027, series:"Formula Drift",  name:"Formula Drift — Monroe, WA",              circuit:"Evergreen Speedway",              country:"USA",       date:"2027-07-11", endDate:"2027-07-12", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Practice & Qualifying",date:"2027-07-11",time:"10:00 AM PT"},{label:"Top 32 / Finals",date:"2027-07-12",time:"12:00 PM PT"}] },
  { id:36, year:2027, series:"24hr",           name:"Spa 24 Hours",                            circuit:"Circuit de Spa-Francorchamps",    country:"Belgium",   date:"2027-07-31", endDate:"2027-08-03", intl:true,  camp:true,  status:"upcoming",
    sessions:[{label:"Practice",date:"2027-07-31",time:"2:00 PM CET"},{label:"Qualifying",date:"2027-08-01",time:"5:30 PM CET"},{label:"Race Start",date:"2027-08-02",time:"4:30 PM CET"},{label:"Race Finish",date:"2027-08-03",time:"4:30 PM CET"}] },
  { id:37, year:2027, series:"WEC",            name:"WEC 6 Hours of São Paulo",                circuit:"Autodromo José Carlos Pace",      country:"Brazil",    date:"2027-07-25", endDate:"2027-07-27", intl:true,  camp:false, status:"upcoming",
    sessions:[{label:"Practice 1",date:"2027-07-25",time:"10:00 AM BRT"},{label:"Qualifying",date:"2027-07-26",time:"3:30 PM BRT"},{label:"Race",date:"2027-07-27",time:"12:00 PM BRT"}] },
  { id:38, year:2027, series:"IMSA",           name:"IMSA Road America",                       circuit:"Road America",                    country:"USA",       date:"2027-08-07", endDate:"2027-08-09", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Practice",date:"2027-08-07",time:"9:35 AM CT"},{label:"Qualifying",date:"2027-08-08",time:"9:05 AM CT"},{label:"Race",date:"2027-08-08",time:"12:05 PM CT"}] },
  { id:39, year:2027, series:"Off-Road",       name:"Crandon World Championship",              circuit:"Crandon International Raceway",   country:"USA",       date:"2027-08-09", endDate:"2027-08-10", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Day 1 Races",date:"2027-08-09",time:"10:00 AM CT"},{label:"Day 2 Races",date:"2027-08-10",time:"10:00 AM CT"}] },
  { id:40, year:2027, series:"Car Week",       name:"Monterey Car Week",                       circuit:"Monterey Peninsula",              country:"USA",       date:"2027-08-13", endDate:"2027-08-17", intl:false, camp:false, status:"upcoming",
    sessions:[{label:"Rolex Motorsports Reunion",date:"2027-08-14",time:"All day"},{label:"Pebble Beach Concours",date:"2027-08-17",time:"8:00 AM PT"}] },
  { id:41, year:2027, series:"SRO",            name:"GT World Challenge America — Indianapolis", circuit:"Indianapolis Motor Speedway RC", country:"USA",       date:"2027-08-21", endDate:"2027-08-24", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Race 1",date:"2027-08-23",time:"11:00 AM ET"},{label:"Race 2",date:"2027-08-24",time:"11:00 AM ET"}] },
  { id:42, year:2027, series:"F1",             name:"Formula 1 Italian Grand Prix",            circuit:"Autodromo Nazionale Monza",       country:"Italy",     date:"2027-09-05", endDate:"2027-09-07", intl:true,  camp:true,  status:"upcoming",
    sessions:[{label:"Practice 1",date:"2027-09-05",time:"1:30 PM CET"},{label:"Practice 2",date:"2027-09-05",time:"5:00 PM CET"},{label:"Qualifying",date:"2027-09-06",time:"3:00 PM CET"},{label:"Race",date:"2027-09-07",time:"3:00 PM CET"}] },
  { id:43, year:2027, series:"IndyCar",        name:"Firestone Grand Prix Monterey",           circuit:"WeatherTech Raceway Laguna Seca", country:"USA",       date:"2027-09-11", endDate:"2027-09-14", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Practice 1",date:"2027-09-12",time:"11:00 AM PT"},{label:"Qualifying",date:"2027-09-13",time:"11:00 AM PT"},{label:"Race",date:"2027-09-14",time:"1:00 PM PT"}] },
  { id:44, year:2027, series:"WEC",            name:"WEC 6 Hours of Fuji",                     circuit:"Fuji Speedway",                   country:"Japan",     date:"2027-09-12", endDate:"2027-09-14", intl:true,  camp:false, status:"upcoming",
    sessions:[{label:"Practice 1",date:"2027-09-12",time:"10:00 AM JST"},{label:"Qualifying",date:"2027-09-13",time:"10:10 AM JST"},{label:"Race",date:"2027-09-14",time:"11:00 AM JST"}] },
  { id:45, year:2027, series:"SRO",            name:"GT World Challenge Europe — Nürburgring", circuit:"Nürburgring GP Circuit",          country:"Germany",   date:"2027-09-25", endDate:"2027-09-28", intl:true,  camp:true,  status:"upcoming",
    sessions:[{label:"Race 1",date:"2027-09-27",time:"1:00 PM CET"},{label:"Race 2",date:"2027-09-28",time:"12:00 PM CET"}] },
  { id:46, year:2027, series:"GridLife",       name:"GridLife Laguna Seca",                    circuit:"WeatherTech Raceway Laguna Seca", country:"USA",       date:"2027-10-01", endDate:"2027-10-05", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Day 1",date:"2027-10-03",time:"All day"},{label:"Day 2",date:"2027-10-04",time:"All day"},{label:"Day 3",date:"2027-10-05",time:"All day"}] },
  { id:47, year:2027, series:"IMSA",           name:"Petit Le Mans",                           circuit:"Michelin Raceway Road Atlanta",   country:"USA",       date:"2027-10-16", endDate:"2027-10-18", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Practice",date:"2027-10-16",time:"10:00 AM ET"},{label:"Qualifying",date:"2027-10-17",time:"12:35 PM ET"},{label:"Race",date:"2027-10-18",time:"11:10 AM ET"}] },
  { id:48, year:2027, series:"F1",             name:"Formula 1 US Grand Prix",                 circuit:"Circuit of the Americas",         country:"USA",       date:"2027-10-17", endDate:"2027-10-19", intl:false, camp:true,  status:"upcoming",
    sessions:[{label:"Practice 1",date:"2027-10-17",time:"1:30 PM CT"},{label:"Qualifying",date:"2027-10-18",time:"3:00 PM CT"},{label:"Race",date:"2027-10-19",time:"3:00 PM CT"}] },
  { id:49, year:2027, series:"F1",             name:"Formula 1 São Paulo GP",                  circuit:"Autodromo José Carlos Pace",      country:"Brazil",    date:"2027-11-07", endDate:"2027-11-09", intl:true,  camp:false, status:"upcoming",
    sessions:[{label:"Sprint Qualifying",date:"2027-11-07",time:"3:30 PM BRT"},{label:"Sprint Race",date:"2027-11-08",time:"11:00 AM BRT"},{label:"Qualifying",date:"2027-11-08",time:"3:00 PM BRT"},{label:"Race",date:"2027-11-09",time:"2:00 PM BRT"}] },
  { id:50, year:2027, series:"Off-Road",       name:"Baja 1000",                               circuit:"Ensenada to La Paz, Mexico",      country:"Mexico",    date:"2027-11-18", endDate:"2027-11-22", intl:true,  camp:true,  status:"upcoming",
    sessions:[{label:"Race Start",date:"2027-11-19",time:"TBC"}] },
  { id:51, year:2027, series:"ELMS",           name:"ELMS 4 Hours of Portimão",                circuit:"Autódromo Internacional do Algarve", country:"Portugal", date:"2027-04-12", endDate:"2027-04-13", intl:true, camp:true, status:"upcoming",
    sessions:[{label:"Qualifying",date:"2027-04-12",time:"3:15 PM GMT"},{label:"Race",date:"2027-04-13",time:"3:00 PM GMT"}] },
  { id:52, year:2027, series:"ELMS",           name:"ELMS 4 Hours of Imola",                   circuit:"Autodromo Enzo e Dino Ferrari",   country:"Italy",     date:"2027-05-16", endDate:"2027-05-18", intl:true,  camp:true,  status:"upcoming",
    sessions:[{label:"Qualifying",date:"2027-05-17",time:"11:45 AM CET"},{label:"Race",date:"2027-05-18",time:"3:00 PM CET"}] },
  { id:53, year:2027, series:"ELMS",           name:"ELMS 4 Hours of Monza",                   circuit:"Autodromo Nazionale Monza",       country:"Italy",     date:"2027-09-18", endDate:"2027-09-21", intl:true,  camp:true,  status:"upcoming",
    sessions:[{label:"Qualifying",date:"2027-09-20",time:"11:45 AM CET"},{label:"Race",date:"2027-09-21",time:"3:00 PM CET"}] },
];

const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [activeYear, setActiveYear] = useState(2026);
  const [view, setView] = useState("timeline"); // timeline | calendar | grid
  const [filters, setFilters] = useState({ series: [], country: "", camp: false, intl: false, search: "", hidePersonal: false });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [tzOpen, setTzOpen] = useState(false);
  const [myTz, setMyTz] = useState("America/Los_Angeles");
  const [compareTz, setCompareTz] = useState("");
  const [customEvents, setCustomEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({ name:"", circuit:"", country:"USA", date:"", endDate:"", series:"IMSA", intl:false, camp:false, notes:"", personal:false });
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [attendance, setAttendance] = useState(() => {
    try { return JSON.parse(localStorage.getItem("rcAttendance") || "{}"); } catch { return {}; }
  });

  useEffect(() => { try { localStorage.setItem("rcAttendance", JSON.stringify(attendance)); } catch {} }, [attendance]);

  const allEvents = useMemo(() => [...BASE_EVENTS, ...customEvents], [customEvents]);

  const filtered = useMemo(() => {
    return allEvents.filter(e => {
      if (e.year !== activeYear) return false;
      if (filters.hidePersonal && e.series === "Personal") return false;
      if (filters.series.length && !filters.series.includes(e.series)) return false;
      if (filters.country && e.country !== filters.country) return false;
      if (filters.camp && !e.camp) return false;
      if (filters.intl && !e.intl) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!e.name.toLowerCase().includes(q) && !e.circuit.toLowerCase().includes(q) && !e.series.toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a,b) => new Date(a.date) - new Date(b.date));
  }, [allEvents, activeYear, filters]);

  const byMonth = useMemo(() => {
    const m = {};
    filtered.forEach(e => {
      const mo = new Date(e.date + "T12:00:00").getMonth();
      if (!m[mo]) m[mo] = [];
      m[mo].push(e);
    });
    return m;
  }, [filtered]);

  const toggleSeries = s => setFilters(f => ({ ...f, series: f.series.includes(s) ? f.series.filter(x=>x!==s) : [...f.series, s] }));
  const toggleAttendance = id => setAttendance(a => ({ ...a, [id]: !a[id] }));

  const addCustomEvent = () => {
    if (!newEvent.name || !newEvent.date) return;
    const id = Date.now();
    const series = newEvent.personal ? "Personal" : newEvent.series;
    setCustomEvents(prev => [...prev, { ...newEvent, series, id, year: parseInt(newEvent.date.split("-")[0]) || activeYear, status:"upcoming", sessions:[] }]);
    setNewEvent({ name:"", circuit:"", country:"USA", date:"", endDate:"", series:"IMSA", intl:false, camp:false, notes:"", personal:false });
    setAdminOpen(false);
  };

  const ALL_SERIES = [...new Set(allEvents.map(e=>e.series))].sort();
  const ALL_COUNTRIES = [...new Set(allEvents.map(e=>e.country))].sort();
  const attendedCount = allEvents.filter(e=>e.year===activeYear&&attendance[e.id]).length;

  return (
    <div style={{ minHeight:"100vh", background:"#0C0C0E", color:"#E8E6E1", fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      {/* HEADER */}
      <header style={{ borderBottom:"1px solid #1E1E22", padding:"0 20px", display:"flex", alignItems:"center", justifyContent:"space-between", height:52, position:"sticky", top:0, background:"#0C0C0E", zIndex:50, gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:26, height:26, borderRadius:5, background:"linear-gradient(135deg,#E8502A,#B02010)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0 }}>RC</div>
          <span style={{ fontSize:15, fontWeight:600, letterSpacing:-0.3 }}>RaceCal</span>
          <span style={{ fontSize:10, color:"#444", marginLeft:2 }}>v0.2</span>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
          <button onClick={()=>setTzOpen(true)} style={btnSty("#1A1A20","#6A9FD8")} title="Timezone settings">
            🕐 {tzAbbr(myTz)}{compareTz ? ` · ${tzAbbr(compareTz)}` : ""}
          </button>
          <div style={{ display:"flex", background:"#141416", border:"1px solid #2A2A2E", borderRadius:6, overflow:"hidden" }}>
            {[["timeline","☰"],["calendar","⊡"],["grid","⊞"]].map(([v,icon])=>(
              <button key={v} onClick={()=>{ setView(v); if(v==="calendar") setCalMonth(new Date().getMonth()); }} style={{ padding:"5px 10px", background:view===v?"#2A2A2E":"transparent", border:"none", color:view===v?"#E8E6E1":"#666", fontSize:12, cursor:"pointer" }}>{icon} {v}</button>
            ))}
          </div>
          <button onClick={()=>setAdminOpen(true)} style={btnSty("#1A2A1A","#3DAA4E")}>+ Add</button>
        </div>
      </header>

      <div style={{ display:"flex", minHeight:"calc(100vh - 52px)" }}>
        {/* SIDEBAR */}
        <aside style={{ width:210, flexShrink:0, borderRight:"1px solid #1E1E22", padding:"16px 14px", display:"flex", flexDirection:"column", gap:16, position:"sticky", top:52, height:"calc(100vh - 52px)", overflowY:"auto" }}>
          <div>
            <SectionLabel>Year</SectionLabel>
            <div style={{ display:"flex", gap:5 }}>
              {[2026,2027].map(y=>(
                <button key={y} onClick={()=>setActiveYear(y)} style={{ flex:1, padding:"5px 0", borderRadius:5, border:`1px solid ${activeYear===y?"#E8502A":"#2A2A2E"}`, background:activeYear===y?"#1A1210":"transparent", color:activeYear===y?"#E8502A":"#888", fontSize:13, fontWeight:600, cursor:"pointer" }}>{y}</button>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Search</SectionLabel>
            <input value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value}))} placeholder="Event, circuit…" style={inpSty} />
          </div>

          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <SectionLabel style={{ marginBottom:0 }}>Series</SectionLabel>
              {filters.series.length>0 && <span onClick={()=>setFilters(f=>({...f,series:[]}))} style={{ fontSize:10, color:"#E8502A", cursor:"pointer" }}>clear</span>}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
              {ALL_SERIES.map(s => {
                const c = (SERIES_META[s]||{color:"#888"}).color;
                const on = filters.series.includes(s);
                return (
                  <button key={s} onClick={()=>toggleSeries(s)} style={{ display:"flex", alignItems:"center", gap:7, padding:"4px 7px", borderRadius:4, border:`1px solid ${on?c+"60":"#1E1E22"}`, background:on?c+"18":"transparent", cursor:"pointer", textAlign:"left" }}>
                    <div style={{ width:7, height:7, borderRadius:2, background:c, flexShrink:0 }} />
                    <span style={{ fontSize:11, color:on?"#E8E6E1":"#777" }}>{s}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <SectionLabel>Country</SectionLabel>
            <select value={filters.country} onChange={e=>setFilters(f=>({...f,country:e.target.value}))} style={inpSty}>
              <option value="">All countries</option>
              {ALL_COUNTRIES.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            <Toggle label="Campable only"      value={filters.camp}         onChange={v=>setFilters(f=>({...f,camp:v}))} />
            <Toggle label="International only" value={filters.intl}         onChange={v=>setFilters(f=>({...f,intl:v}))} />
            <Toggle label="Hide personal"      value={filters.hidePersonal} onChange={v=>setFilters(f=>({...f,hidePersonal:v}))} />
          </div>

          <div style={{ marginTop:"auto", borderTop:"1px solid #1E1E22", paddingTop:12, display:"flex", flexDirection:"column", gap:6 }}>
            <StatR label="Showing"      value={filtered.length} />
            <StatR label="Attended"     value={attendedCount}   accent="#E8502A" />
            <StatR label="International" value={filtered.filter(e=>e.intl).length} accent="#3DAA4E" />
            <StatR label="Campable"     value={filtered.filter(e=>e.camp).length}  accent="#B86B1B" />
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ flex:1, padding:"18px 20px", overflowY:"auto", minWidth:0 }}>
          {view === "timeline" && (
            <TimelineView byMonth={byMonth} attendance={attendance} onSelect={setSelectedEvent} onToggleAttend={toggleAttendance} myTz={myTz} compareTz={compareTz} />
          )}
          {view === "calendar" && (
            <CalendarView events={filtered} year={activeYear} month={calMonth} setMonth={setCalMonth} attendance={attendance} onSelect={setSelectedEvent} onToggleAttend={toggleAttendance} myTz={myTz} />
          )}
          {view === "grid" && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:10 }}>
              {filtered.map(e=><EventCard key={e.id} event={e} attended={attendance[e.id]} onSelect={()=>setSelectedEvent(e)} onToggleAttend={()=>toggleAttendance(e.id)} />)}
              {filtered.length===0 && <div style={{ gridColumn:"1/-1", textAlign:"center", color:"#555", padding:"60px 0", fontSize:14 }}>No events match.</div>}
            </div>
          )}
        </main>
      </div>

      {/* MODALS */}
      {selectedEvent && (
        <Modal onClose={()=>setSelectedEvent(null)}>
          <EventDetail event={selectedEvent} attended={attendance[selectedEvent.id]} onToggleAttend={()=>toggleAttendance(selectedEvent.id)} myTz={myTz} compareTz={compareTz} />
        </Modal>
      )}

      {adminOpen && (
        <Modal onClose={()=>setAdminOpen(false)}>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:14 }}>Add event</div>
          <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
            <Field label="Event name"><input style={inpSty} value={newEvent.name} onChange={e=>setNewEvent(p=>({...p,name:e.target.value}))} placeholder="e.g. Silverstone Classic" /></Field>
            <Field label="Circuit / Venue"><input style={inpSty} value={newEvent.circuit} onChange={e=>setNewEvent(p=>({...p,circuit:e.target.value}))} placeholder="e.g. Silverstone Circuit" /></Field>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
              <Field label="Start date"><input type="date" style={inpSty} value={newEvent.date} onChange={e=>setNewEvent(p=>({...p,date:e.target.value}))} /></Field>
              <Field label="End date"><input type="date" style={inpSty} value={newEvent.endDate} onChange={e=>setNewEvent(p=>({...p,endDate:e.target.value}))} /></Field>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9 }}>
              <Field label="Series">
                <select style={inpSty} value={newEvent.series} onChange={e=>setNewEvent(p=>({...p,series:e.target.value}))}>
                  {Object.keys(SERIES_META).filter(s=>s!=="Personal").map(s=><option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Country"><input style={inpSty} value={newEvent.country} onChange={e=>setNewEvent(p=>({...p,country:e.target.value}))} /></Field>
            </div>
            <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
              {[["camp","⛺ Campable"],["intl","✈ International"],["personal","👤 Personal event"]].map(([k,lbl])=>(
                <label key={k} style={{ display:"flex", gap:6, alignItems:"center", fontSize:12, color:"#AAA", cursor:"pointer" }}>
                  <input type="checkbox" checked={newEvent[k]} onChange={e=>setNewEvent(p=>({...p,[k]:e.target.checked}))} /> {lbl}
                </label>
              ))}
            </div>
            <Field label="Notes"><input style={inpSty} value={newEvent.notes} onChange={e=>setNewEvent(p=>({...p,notes:e.target.value}))} placeholder="Shot list, gear, contacts…" /></Field>
            <div style={{ display:"flex", gap:8, marginTop:4 }}>
              <button onClick={()=>setAdminOpen(false)} style={{ ...btnSty("#1E1E22"), flex:1 }}>Cancel</button>
              <button onClick={addCustomEvent} style={{ ...btnSty("#1A2A1A","#3DAA4E"), flex:1 }}>Save event</button>
            </div>
          </div>
        </Modal>
      )}

      {tzOpen && (
        <Modal onClose={()=>setTzOpen(false)}>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:6 }}>Timezone settings</div>
          <div style={{ fontSize:12, color:"#666", marginBottom:16 }}>Session times will be converted and displayed in your chosen timezone. Optionally add a second timezone to compare side-by-side.</div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <Field label="My timezone (primary)">
              <select style={inpSty} value={myTz} onChange={e=>setMyTz(e.target.value)}>
                {TIMEZONES.map(t=><option key={t.tz} value={t.tz}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Compare timezone (optional — shows side-by-side)">
              <select style={inpSty} value={compareTz} onChange={e=>setCompareTz(e.target.value)}>
                <option value="">None</option>
                {TIMEZONES.filter(t=>t.tz!==myTz).map(t=><option key={t.tz} value={t.tz}>{t.label}</option>)}
              </select>
            </Field>
            {/* Live preview */}
            <div style={{ background:"#0C0C0E", border:"1px solid #1E1E22", borderRadius:7, padding:"10px 12px" }}>
              <div style={{ fontSize:10, color:"#555", marginBottom:6, textTransform:"uppercase", letterSpacing:1 }}>Preview — Le Mans Race Start</div>
              <TzPreview myTz={myTz} compareTz={compareTz} />
            </div>
            <button onClick={()=>setTzOpen(false)} style={{ ...btnSty("#1A2A28","#3DAA4E"), width:"100%", padding:"8px" }}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── TIMEZONE PREVIEW ────────────────────────────────────────────────────────
function TzPreview({ myTz, compareTz }) {
  // Le Mans race start: June 14 2026 4:00 PM CET
  const utc = parseSessionTime("2026-06-14", "4:00 PM CET");
  if (!utc) return null;
  const myTime = formatInTz(utc, myTz, true);
  const cmpTime = compareTz ? formatInTz(utc, compareTz, true) : null;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
      <TzRow label={tzAbbr(myTz)} time={myTime} primary />
      {cmpTime && <TzRow label={tzAbbr(compareTz)} time={cmpTime} />}
    </div>
  );
}

function TzRow({ label, time, primary }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
      <span style={{ color: primary ? "#E8502A" : "#888" }}>{label}</span>
      <span style={{ color: primary ? "#E8E6E1" : "#AAA", fontWeight: primary ? 600 : 400 }}>{time}</span>
    </div>
  );
}

// ─── TIMELINE VIEW ───────────────────────────────────────────────────────────
function TimelineView({ byMonth, attendance, onSelect, onToggleAttend, myTz, compareTz }) {
  if (!Object.keys(byMonth).length) return <div style={{ textAlign:"center", color:"#555", padding:"60px 0", fontSize:14 }}>No events match your filters.</div>;
  return (
    <div>
      {Object.keys(byMonth).sort((a,b)=>Number(a)-Number(b)).map(mo => (
        <div key={mo} style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"#444", textTransform:"uppercase", marginBottom:10, paddingBottom:8, borderBottom:"1px solid #1A1A1E" }}>
            {MONTHS_LONG[Number(mo)]}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {byMonth[mo].map(e=><EventRow key={e.id} event={e} attended={attendance[e.id]} onSelect={()=>onSelect(e)} onToggleAttend={()=>onToggleAttend(e.id)} myTz={myTz} compareTz={compareTz} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── CALENDAR VIEW ───────────────────────────────────────────────────────────
function CalendarView({ events, year, month, setMonth, attendance, onSelect, myTz }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const today = new Date();

  const eventsByDay = useMemo(() => {
    const m = {};
    events.forEach(e => {
      const start = new Date(e.date + "T12:00:00");
      const end = e.endDate ? new Date(e.endDate + "T12:00:00") : start;
      if (start.getFullYear() === year && start.getMonth() === month) {
        const d = start.getDate();
        if (!m[d]) m[d] = [];
        m[d].push(e);
      }
      // Also mark multi-day span days
      if (e.endDate && end.getMonth() === month && end.getFullYear() === year) {
        let cur = new Date(start);
        cur.setDate(cur.getDate()+1);
        while (cur <= end) {
          if (cur.getMonth() === month) {
            const d = cur.getDate();
            if (!m[d]) m[d] = [];
            if (!m[d].find(x=>x.id===e.id)) m[d].push(e);
          }
          cur.setDate(cur.getDate()+1);
        }
      }
    });
    return m;
  }, [events, year, month]);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      {/* Month nav */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <button onClick={()=>setMonth(m=>(m+11)%12)} style={btnSty("#141416")}>← Prev</button>
        <span style={{ fontSize:16, fontWeight:600 }}>{MONTHS_LONG[month]} {year}</span>
        <button onClick={()=>setMonth(m=>(m+1)%12)} style={btnSty("#141416")}>Next →</button>
      </div>

      {/* DOW headers */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:4 }}>
        {DOW.map(d=><div key={d} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:"#444", padding:"4px 0", letterSpacing:1 }}>{d}</div>)}
      </div>

      {/* Grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {cells.map((d,i) => {
          if (!d) return <div key={`e${i}`} style={{ minHeight:90, background:"#0A0A0C", borderRadius:5 }} />;
          const dayEvents = eventsByDay[d] || [];
          const isToday = today.getFullYear()===year && today.getMonth()===month && today.getDate()===d;
          return (
            <div key={d} style={{ minHeight:90, background:"#111113", borderRadius:5, border:`1px solid ${isToday?"#E8502A40":"#1A1A1E"}`, padding:"5px 4px", position:"relative" }}>
              <div style={{ fontSize:11, fontWeight:isToday?700:400, color:isToday?"#E8502A":"#555", marginBottom:3, textAlign:"right" }}>{d}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                {dayEvents.slice(0,3).map(e => {
                  const c = (SERIES_META[e.series]||{color:"#888"}).color;
                  return (
                    <div key={e.id} onClick={()=>onSelect(e)} style={{ fontSize:10, padding:"2px 5px", borderRadius:3, background:c+"25", color:c, cursor:"pointer", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", borderLeft:`2px solid ${c}`, lineHeight:1.4 }} title={e.name}>
                      {e.name}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && <div style={{ fontSize:9, color:"#555", paddingLeft:4 }}>+{dayEvents.length-3} more</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend for this month */}
      {Object.keys(eventsByDay).length > 0 && (
        <div style={{ marginTop:16, borderTop:"1px solid #1A1A1E", paddingTop:12 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#444", letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>This month</div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {events.filter(e=>{ const mo = new Date(e.date+"T12:00:00").getMonth(); return mo===month; }).map(e=>(
              <div key={e.id} onClick={()=>onSelect(e)} style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"5px 8px", borderRadius:5, background:"#111113" }}>
                <div style={{ width:6, height:6, borderRadius:2, background:(SERIES_META[e.series]||{color:"#888"}).color, flexShrink:0 }} />
                <span style={{ fontSize:12, color:"#AAA", flex:1 }}>{e.name}</span>
                <span style={{ fontSize:11, color:"#555" }}>{new Date(e.date+"T12:00:00").getDate()}{e.endDate ? `–${new Date(e.endDate+"T12:00:00").getDate()}` : ""}</span>
                {attendance[e.id] && <span style={{ fontSize:10, color:"#E8502A" }}>✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EVENT ROW ───────────────────────────────────────────────────────────────
function EventRow({ event:e, attended, onSelect, onToggleAttend, myTz, compareTz }) {
  const meta = SERIES_META[e.series] || { color:"#888" };
  const d = new Date(e.date + "T12:00:00");
  // Get first real session time for inline display
  const firstSession = e.sessions?.find(s => s.time && s.time !== "TBC" && !s.time.toLowerCase().includes("all day"));
  let inlineTz = null;
  if (firstSession && myTz) {
    const utc = parseSessionTime(firstSession.date || e.date, firstSession.time);
    if (utc) inlineTz = formatInTz(utc, myTz);
  }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"44px 4px 1fr auto", alignItems:"stretch", background:"#111113", border:"1px solid #1E1E22", borderRadius:7, overflow:"hidden", cursor:"pointer" }}
      onMouseEnter={ev=>ev.currentTarget.style.borderColor="#2E2E36"}
      onMouseLeave={ev=>ev.currentTarget.style.borderColor="#1E1E22"}
      onClick={onSelect}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"8px 0", gap:1 }}>
        <div style={{ fontSize:9, color:"#555", textTransform:"uppercase", letterSpacing:1 }}>{MONTHS_SHORT[d.getMonth()]}</div>
        <div style={{ fontSize:20, fontWeight:700, color:"#E8E6E1", lineHeight:1 }}>{d.getDate()}</div>
      </div>
      <div style={{ background:meta.color, opacity:0.85 }} />
      <div style={{ padding:"9px 12px" }}>
        <div style={{ fontSize:13, fontWeight:500, color:e.series==="Personal"?"#B8A8FF":"#E8E6E1", marginBottom:3 }}>{e.name}</div>
        <div style={{ display:"flex", gap:7, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontSize:10, fontWeight:700, padding:"1px 5px", borderRadius:3, background:meta.color+"22", color:meta.color }}>{e.series}</span>
          <span style={{ fontSize:11, color:"#555" }}>📍 {e.circuit}</span>
          {e.intl && <span style={{ fontSize:10, color:"#3DAA4E" }}>✈</span>}
          {e.camp && <span style={{ fontSize:10, color:"#B86B1B" }}>⛺</span>}
          {inlineTz && <span style={{ fontSize:10, color:"#6A9FD8" }}>🕐 {inlineTz} {tzAbbr(myTz)}</span>}
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"0 10px" }}
        onClick={ev=>{ ev.stopPropagation(); onToggleAttend(); }}>
        <div style={{ width:26, height:26, borderRadius:5, border:`1.5px solid ${attended?"#E8502A":"#2E2E36"}`, background:attended?"#E8502A22":"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:attended?"#E8502A":"#444" }}>
          {attended?"✓":"○"}
        </div>
      </div>
    </div>
  );
}

// ─── EVENT CARD ──────────────────────────────────────────────────────────────
function EventCard({ event:e, attended, onSelect, onToggleAttend }) {
  const meta = SERIES_META[e.series] || { color:"#888" };
  const d = new Date(e.date + "T12:00:00");
  return (
    <div style={{ background:"#111113", border:"1px solid #1E1E22", borderRadius:9, overflow:"hidden", cursor:"pointer" }} onClick={onSelect}>
      <div style={{ height:3, background:meta.color }} />
      <div style={{ padding:"11px 13px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:7 }}>
          <span style={{ fontSize:10, fontWeight:700, padding:"2px 6px", borderRadius:3, background:meta.color+"22", color:meta.color }}>{e.series}</span>
          <div onClick={ev=>{ ev.stopPropagation(); onToggleAttend(); }} style={{ width:22, height:22, borderRadius:4, border:`1.5px solid ${attended?"#E8502A":"#2E2E36"}`, background:attended?"#E8502A22":"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:attended?"#E8502A":"#444", cursor:"pointer" }}>
            {attended?"✓":"○"}
          </div>
        </div>
        <div style={{ fontSize:13, fontWeight:600, color:"#E8E6E1", marginBottom:3, lineHeight:1.3 }}>{e.name}</div>
        <div style={{ fontSize:11, color:"#555", marginBottom:7 }}>{e.circuit}</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", fontSize:11, color:"#888" }}>
          <span>{d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
          {e.intl && <span style={{ color:"#3DAA4E" }}>✈ {e.country}</span>}
          {e.camp && <span style={{ color:"#B86B1B" }}>⛺</span>}
        </div>
      </div>
    </div>
  );
}

// ─── EVENT DETAIL MODAL ──────────────────────────────────────────────────────
function EventDetail({ event:e, attended, onToggleAttend, myTz, compareTz }) {
  const meta = SERIES_META[e.series] || { color:"#888" };
  const start = new Date(e.date + "T12:00:00");
  const end = e.endDate ? new Date(e.endDate + "T12:00:00") : null;
  return (
    <div>
      <div style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:14 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, fontWeight:700, color:meta.color, marginBottom:3, letterSpacing:0.3 }}>{e.series} · {e.country}</div>
          <div style={{ fontSize:17, fontWeight:700, color:"#E8E6E1", lineHeight:1.25 }}>{e.name}</div>
          <div style={{ fontSize:12, color:"#555", marginTop:3 }}>{e.circuit}</div>
        </div>
        <button onClick={onToggleAttend} style={{ padding:"7px 12px", borderRadius:6, border:`1.5px solid ${attended?"#E8502A":"#2E2E36"}`, background:attended?"#E8502A22":"transparent", color:attended?"#E8502A":"#777", fontSize:11, cursor:"pointer", whiteSpace:"nowrap", fontWeight:600 }}>
          {attended?"✓ Attended":"Mark attended"}
        </button>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        <Chip label={`📅 ${start.toLocaleDateString("en-US",{month:"long",day:"numeric"})}${end?" – "+end.toLocaleDateString("en-US",{month:"long",day:"numeric"}):""}, ${e.year}`} />
        {e.intl && <Chip label={`✈ ${e.country}`} color="#3DAA4E" />}
        {e.camp && <Chip label="⛺ Campable" color="#B86B1B" />}
      </div>

      {e.sessions && e.sessions.length > 0 && (
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:"#444", letterSpacing:1.5, textTransform:"uppercase", marginBottom:7 }}>Sessions — converted to your timezone</div>
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            {e.sessions.map((s,i) => {
              const utc = parseSessionTime(s.date||e.date, s.time);
              const myConverted = utc ? formatInTz(utc, myTz, true) : null;
              const cmpConverted = (utc && compareTz) ? formatInTz(utc, compareTz, true) : null;
              const isAllDay = s.time?.toLowerCase().includes("all day");
              const isTBC = s.time === "TBC";
              return (
                <div key={i} style={{ background:"#0C0C0E", borderRadius:5, border:"1px solid #1E1E22", padding:"8px 10px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                    <span style={{ fontSize:12, color:"#888", flexShrink:0 }}>{s.label}</span>
                    <div style={{ textAlign:"right" }}>
                      {isAllDay && <div style={{ fontSize:12, color:"#E8E6E1" }}>All day</div>}
                      {isTBC    && <div style={{ fontSize:12, color:"#666" }}>TBC</div>}
                      {myConverted && (
                        <div style={{ fontSize:12, color:"#E8E6E1", fontWeight:500 }}>
                          {myConverted} <span style={{ color:"#E8502A", fontSize:10 }}>{tzAbbr(myTz)}</span>
                        </div>
                      )}
                      {cmpConverted && (
                        <div style={{ fontSize:11, color:"#888", marginTop:2 }}>
                          {cmpConverted} <span style={{ color:"#6A9FD8", fontSize:10 }}>{tzAbbr(compareTz)}</span>
                        </div>
                      )}
                      {!myConverted && !isAllDay && !isTBC && (
                        <div style={{ fontSize:11, color:"#444" }}>{s.time}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {e.notes && <div style={{ marginTop:10, padding:"9px 11px", background:"#0C0C0E", borderRadius:5, border:"1px solid #1E1E22", fontSize:12, color:"#777", fontStyle:"italic" }}>{e.notes}</div>}
    </div>
  );
}

// ─── SHARED COMPONENTS ───────────────────────────────────────────────────────
function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#141416", border:"1px solid #2A2A2E", borderRadius:11, padding:"18px 20px", width:"100%", maxWidth:500, maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:2 }}>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#555", fontSize:17, cursor:"pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <label style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer", fontSize:11, color:value?"#E8E6E1":"#777" }}>
      <span>{label}</span>
      <div onClick={()=>onChange(!value)} style={{ width:30, height:17, borderRadius:9, background:value?"#E8502A":"#2A2A2E", position:"relative", transition:"background .2s", flexShrink:0 }}>
        <div style={{ position:"absolute", top:2.5, left:value?15:2.5, width:12, height:12, borderRadius:"50%", background:"#fff", transition:"left .2s" }} />
      </div>
    </label>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize:9, fontWeight:700, color:"#444", letterSpacing:1.4, textTransform:"uppercase", marginBottom:6 }}>{children}</div>;
}

function StatR({ label, value, accent }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
      <span style={{ color:"#555" }}>{label}</span>
      <span style={{ color:accent||"#E8E6E1", fontWeight:600 }}>{value}</span>
    </div>
  );
}

function Chip({ label, color }) {
  return <span style={{ fontSize:11, padding:"2px 8px", borderRadius:4, background:(color||"#888")+"20", color:color||"#888", border:`1px solid ${(color||"#888")+"40"}` }}>{label}</span>;
}

function Field({ label, children }) {
  return <div><div style={{ fontSize:11, color:"#555", marginBottom:3 }}>{label}</div>{children}</div>;
}

const btnSty = (bg, color="#888") => ({ padding:"5px 12px", borderRadius:5, border:`1px solid ${color}40`, background:bg, color, fontSize:12, cursor:"pointer", fontWeight:500 });
const inpSty = { width:"100%", background:"#0C0C0E", border:"1px solid #2A2A2E", borderRadius:5, padding:"6px 9px", color:"#E8E6E1", fontSize:12 };

