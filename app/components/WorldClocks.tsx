'use client';

import { Clock } from './Clock';

interface WorldClocksProps {
  getSyncedTimeForTimezone: (timezone: string) => string;
  getSyncedDateForTimezone: (timezone: string) => string;
  localTimezone?: string;
}

const WORLD_CITIES = [
  { city: 'Tokyo', timezone: 'Asia/Tokyo', flag: '🇯🇵' },
  { city: 'Sydney', timezone: 'Australia/Sydney', flag: '🇦🇺' },
  { city: 'Dubai', timezone: 'Asia/Dubai', flag: '🇦🇪' },
  { city: 'London', timezone: 'Europe/London', flag: '🇬🇧' },
  { city: 'New York', timezone: 'America/New_York', flag: '🇺🇸' },
  { city: 'Los Angeles', timezone: 'America/Los_Angeles', flag: '🇺🇸' },
];

export function WorldClocks({ 
  getSyncedTimeForTimezone, 
  getSyncedDateForTimezone,
  localTimezone 
}: WorldClocksProps) {
  // Get user's local timezone
  const userTimezone = localTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-3">
          <span className="text-2xl">🌍</span>
          World Clocks
        </h2>
        <div className="text-sm text-slate-400">
          All clocks synchronized to server time
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {WORLD_CITIES.map((location) => {
          const isLocal = location.timezone === userTimezone;
          return (
            <Clock
              key={location.city}
              city={location.city}
              timezone={location.timezone}
              flag={location.flag}
              time={getSyncedTimeForTimezone(location.timezone)}
              date={getSyncedDateForTimezone(location.timezone)}
              isLocal={isLocal}
            />
          );
        })}
      </div>

      {/* Educational note */}
      <div className="mt-6 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
        <h3 className="text-sm font-semibold text-cyan-400 mb-2 flex items-center gap-2">
          <span>💡</span>
          How It Works
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          All these clocks display the <span className="text-white font-medium">same moment in time</span>, 
          just in different timezones. The synchronized timestamp from the server is converted to each 
          timezone using the <code className="px-1.5 py-0.5 bg-slate-700/50 rounded text-cyan-300 text-xs">
          Intl.DateTimeFormat</code> API. This ensures all users worldwide see consistent, accurate times.
        </p>
      </div>
    </div>
  );
}

