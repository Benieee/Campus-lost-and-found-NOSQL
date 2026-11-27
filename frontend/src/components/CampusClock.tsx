import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export function CampusClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  const hourAngle = ((hours % 12) + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;

  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const formattedDate = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="campus-clock-card" role="timer" aria-live="off" aria-label={`Current time ${formattedTime}`}>
      <div className="clock-dial-wrap" aria-hidden="true">
        <svg viewBox="0 0 100 100" className="clock-svg">
          <circle cx="50" cy="50" r="46" fill="rgba(255,255,255,0.95)" stroke="#f5b700" strokeWidth="3.5" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <line
              key={deg}
              x1="50"
              y1={deg % 90 === 0 ? '9' : '11'}
              x2="50"
              y2={deg % 90 === 0 ? '16' : '15'}
              stroke={deg % 90 === 0 ? '#0e4d9c' : '#64748b'}
              strokeWidth={deg % 90 === 0 ? '2.8' : '1.5'}
              strokeLinecap="round"
              transform={`rotate(${deg} 50 50)`}
            />
          ))}
          {/* Hour hand */}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="27"
            stroke="#082b59"
            strokeWidth="3.6"
            strokeLinecap="round"
            transform={`rotate(${hourAngle} 50 50)`}
          />
          {/* Minute hand */}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="18"
            stroke="#0e4d9c"
            strokeWidth="2.6"
            strokeLinecap="round"
            transform={`rotate(${minuteAngle} 50 50)`}
          />
          {/* Second hand */}
          <line
            x1="50"
            y1="56"
            x2="50"
            y2="15"
            stroke="#d92b2b"
            strokeWidth="1.5"
            strokeLinecap="round"
            transform={`rotate(${secondAngle} 50 50)`}
          />
          <circle cx="50" cy="50" r="3.4" fill="#f5b700" stroke="#082b59" strokeWidth="1.2" />
        </svg>
      </div>

      <div className="clock-readout">
        <div className="clock-label">
          <Clock size={13} aria-hidden="true" /> Campus Local Time
        </div>
        <div className="clock-time">{formattedTime}</div>
        <div className="clock-date">{formattedDate}</div>
        <div className="clock-tz">{timeZone}</div>
      </div>
    </div>
  );
}
