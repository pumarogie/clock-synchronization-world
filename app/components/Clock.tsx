"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

interface ClockProps {
  time: string; // Format: "HH:MM:SS"
  city: string;
  timezone: string;
  date: string;
  flag?: string;
  isLocal?: boolean;
}

export function Clock({
  time,
  city,
  timezone,
  date,
  flag,
  isLocal = false,
}: ClockProps) {
  // Parse time string to get hours, minutes, seconds
  const { hours, minutes, seconds, hourDegrees, minuteDegrees, secondDegrees } =
    useMemo(() => {
      const [h, m, s] = time.split(":").map(Number);

      // Calculate rotation degrees for analog clock hands
      // Second hand: 360 degrees / 60 seconds = 6 degrees per second
      const secDeg = (s / 60) * 360;
      // Minute hand: 360 degrees / 60 minutes = 6 degrees per minute, plus fractional from seconds
      const minDeg = ((m + s / 60) / 60) * 360;
      // Hour hand: 360 degrees / 12 hours = 30 degrees per hour, plus fractional from minutes
      const hrDeg = (((h % 12) + m / 60) / 12) * 360;

      return {
        hours: h,
        minutes: m,
        seconds: s,
        hourDegrees: hrDeg,
        minuteDegrees: minDeg,
        secondDegrees: secDeg,
      };
    }, [time]);

  // Determine if it's day or night (6 AM - 6 PM is day)
  const isDaytime = hours >= 6 && hours < 18;

  return (
    <motion.div
      className={`clock-container relative flex flex-col items-center p-6 rounded-2xl backdrop-blur-xl border transition-all duration-500 ${
        isLocal
          ? "bg-linear-to-br from-emerald-900/40 to-emerald-800/20 border-emerald-500/30 shadow-lg shadow-emerald-500/10"
          : "bg-linear-to-br from-slate-900/60 to-slate-800/40 border-slate-600/30"
      }`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* City name and flag */}
      <div className="flex items-center gap-2 mb-2">
        {flag && <span className="text-xl">{flag}</span>}
        <h3 className="text-lg font-semibold text-white tracking-wide">
          {city}
        </h3>
        {isLocal && (
          <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
            YOU
          </span>
        )}
      </div>

      {/* Day/Night indicator */}
      <div className="flex items-center gap-1.5 mb-4 text-xs text-slate-400">
        <span className={isDaytime ? "text-amber-400" : "text-indigo-400"}>
          {isDaytime ? "☀️" : "🌙"}
        </span>
        <span>{date}</span>
      </div>

      {/* Analog Clock */}
      <div className="relative w-36 h-36 mb-4">
        {/* Clock face */}
        <div
          className={`absolute inset-0 rounded-full border-2 ${
            isLocal ? "border-emerald-500/50" : "border-slate-500/50"
          } bg-linear-to-br from-slate-800/80 to-slate-900/80`}
        >
          {/* Hour markers */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-full h-full"
              style={{ transform: `rotate(${i * 30}deg)` }}
            >
              <div
                className={`absolute top-2 left-1/2 -translate-x-1/2 w-0.5 h-2 rounded-full ${
                  i % 3 === 0 ? "bg-white/60 h-3" : "bg-slate-500/60"
                }`}
              />
            </div>
          ))}

          {/* Center dot */}
          <div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full z-20 ${
              isLocal ? "bg-emerald-400" : "bg-cyan-400"
            }`}
          />

          {/* Hour hand */}
          <motion.div
            className="absolute top-1/2 left-1/2 origin-bottom z-10"
            style={{
              width: "4px",
              height: "32px",
              marginLeft: "-2px",
              marginTop: "-32px",
            }}
            animate={{ rotate: hourDegrees }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          >
            <div className="w-full h-full bg-linear-to-t from-white to-slate-300 rounded-full" />
          </motion.div>

          {/* Minute hand */}
          <motion.div
            className="absolute top-1/2 left-1/2 origin-bottom z-10"
            style={{
              width: "3px",
              height: "44px",
              marginLeft: "-1.5px",
              marginTop: "-44px",
            }}
            animate={{ rotate: minuteDegrees }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          >
            <div className="w-full h-full bg-linear-to-t from-slate-200 to-slate-400 rounded-full" />
          </motion.div>

          {/* Second hand */}
          <motion.div
            className="absolute top-1/2 left-1/2 origin-bottom z-10"
            style={{
              width: "2px",
              height: "50px",
              marginLeft: "-1px",
              marginTop: "-50px",
            }}
            animate={{ rotate: secondDegrees }}
            transition={{ type: "tween", duration: 0.1 }}
          >
            <div
              className={`w-full h-full rounded-full ${
                isLocal ? "bg-emerald-400" : "bg-cyan-400"
              }`}
            />
            {/* Glow effect for second hand */}
            <div
              className={`absolute inset-0 rounded-full blur-sm ${
                isLocal ? "bg-emerald-400/50" : "bg-cyan-400/50"
              }`}
            />
          </motion.div>
        </div>

        {/* Outer glow */}
        <div
          className={`absolute -inset-1 rounded-full blur-md opacity-20 ${
            isLocal ? "bg-emerald-500" : "bg-cyan-500"
          }`}
        />
      </div>

      {/* Digital time display */}
      <div className="font-mono text-3xl font-bold tracking-wider">
        <span className="text-white">{String(hours).padStart(2, "0")}</span>
        <motion.span
          className={isLocal ? "text-emerald-400" : "text-cyan-400"}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          :
        </motion.span>
        <span className="text-white">{String(minutes).padStart(2, "0")}</span>
        <motion.span
          className={isLocal ? "text-emerald-400" : "text-cyan-400"}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          :
        </motion.span>
        <span className={isLocal ? "text-emerald-300" : "text-cyan-300"}>
          {String(seconds).padStart(2, "0")}
        </span>
      </div>

      {/* Timezone label */}
      <div className="mt-2 text-xs text-slate-500 font-mono">{timezone}</div>
    </motion.div>
  );
}
