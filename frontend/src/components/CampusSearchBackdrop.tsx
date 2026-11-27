import {
  BookOpen,
  Briefcase,
  CreditCard,
  KeyRound,
  Laptop,
  MapPin,
  Search,
  Watch
} from 'lucide-react';

/**
 * Full-screen ambient background animation depicting someone retracing campus steps
 * with a gliding magnifying-glass beam searching for floating lost belongings.
 */
export function CampusSearchBackdrop() {
  return (
    <div className="campus-backdrop no-print" aria-hidden="true">
      {/* Sweeping radar & dashed "retracing steps" trail */}
      <svg className="backdrop-trails-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="buSearchBeam" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f5b700" stopOpacity="0.32" />
            <stop offset="55%" stopColor="#257be6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#0e4d9c" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Dotted retraced campus paths */}
        <path
          className="search-trail-path"
          d="M -40 680 C 210 560, 340 760, 590 610 S 980 420, 1210 520 S 1400 320, 1520 260"
          fill="none"
          stroke="rgba(14, 77, 156, 0.16)"
          strokeWidth="3"
          strokeDasharray="10 14"
          strokeLinecap="round"
        />
        <path
          className="search-trail-path-alt"
          d="M 1480 760 C 1180 720, 1020 580, 780 650 S 390 480, 160 540 S -20 340, -80 280"
          fill="none"
          stroke="rgba(245, 183, 0, 0.22)"
          strokeWidth="2.5"
          strokeDasharray="6 14"
          strokeLinecap="round"
        />

        {/* Pulsing campus location radar rings */}
        <g className="radar-ring-group" transform="translate(260, 240)">
          <circle r="18" fill="none" stroke="rgba(14, 77, 156, 0.22)" strokeWidth="2" className="radar-ring r1" />
          <circle r="18" fill="none" stroke="rgba(245, 183, 0, 0.28)" strokeWidth="2" className="radar-ring r2" />
          <circle r="4.5" fill="rgba(14, 77, 156, 0.35)" />
        </g>

        <g className="radar-ring-group" transform="translate(1160, 620)">
          <circle r="18" fill="none" stroke="rgba(217, 43, 43, 0.2)" strokeWidth="2" className="radar-ring r1" />
          <circle r="18" fill="none" stroke="rgba(14, 77, 156, 0.22)" strokeWidth="2" className="radar-ring r2" />
          <circle r="4.5" fill="rgba(217, 43, 43, 0.35)" />
        </g>

        <g className="radar-ring-group" transform="translate(820, 210)">
          <circle r="16" fill="none" stroke="rgba(245, 183, 0, 0.26)" strokeWidth="2" className="radar-ring r1" />
          <circle r="4" fill="rgba(245, 183, 0, 0.45)" />
        </g>
      </svg>

      {/* Gliding searchlight & magnifying-glass seeker */}
      <div className="backdrop-seeker">
        <div className="seeker-beam" />
        <div className="seeker-badge">
          <Search size={24} strokeWidth={2.4} />
        </div>
      </div>

      {/* Floating lost property icons bobbing softly and illuminating */}
      <div className="floating-lost-icon icon-1">
        <KeyRound size={22} />
      </div>
      <div className="floating-lost-icon icon-2">
        <Laptop size={24} />
      </div>
      <div className="floating-lost-icon icon-3">
        <Briefcase size={22} />
      </div>
      <div className="floating-lost-icon icon-4">
        <CreditCard size={22} />
      </div>
      <div className="floating-lost-icon icon-5">
        <BookOpen size={22} />
      </div>
      <div className="floating-lost-icon icon-6">
        <Watch size={20} />
      </div>
      <div className="floating-lost-icon icon-7">
        <MapPin size={22} />
      </div>
    </div>
  );
}

/**
 * Hero-embedded animated SVG scene showing a campus student looking through a glowing
 * magnifying glass along a trail of lost belongings that light up as they are discovered.
 */
export function HeroSearchAnimation() {
  return (
    <div className="hero-search-scene" aria-hidden="true">
      <svg viewBox="0 0 1100 420" preserveAspectRatio="xMidYMid slice" className="hero-scene-svg">
        <defs>
          <linearGradient id="heroConeGrad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#f5b700" stopOpacity="0.42" />
            <stop offset="65%" stopColor="#f5b700" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#f5b700" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Animated dashed footpath across the hero */}
        <path
          className="hero-footpath"
          d="M 40 355 Q 240 270, 440 330 T 830 280 T 1060 220"
          fill="none"
          stroke="rgba(255, 246, 214, 0.25)"
          strokeWidth="3"
          strokeDasharray="8 12"
          strokeLinecap="round"
        />

        {/* Stylized searcher silhouette + sweeping flashlight/magnifying glass beam */}
        <g className="hero-searcher-group">
          {/* Glowing Torch-Gold searchlight cone sweeping up and down */}
          <g className="hero-beam-sweep">
            <polygon points="150,245 430,130 430,335" fill="url(#heroConeGrad)" />
            {/* Magnifying glass held forward */}
            <circle
              cx="166"
              cy="242"
              r="18"
              fill="rgba(245, 183, 0, 0.22)"
              stroke="#f5b700"
              strokeWidth="4"
            />
            <line
              x1="152"
              y1="256"
              x2="138"
              y2="270"
              stroke="#fff6d6"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
          </g>

          {/* Stylized student figure leaning forward looking */}
          <circle cx="96" cy="212" r="17" fill="rgba(255, 255, 255, 0.24)" stroke="rgba(255,255,255,0.42)" strokeWidth="2" />
          <path
            d="M 78 298 C 78 258, 92 238, 114 240 C 128 242, 138 254, 144 268 L 128 274 L 122 260 L 114 298 Z"
            fill="rgba(255, 255, 255, 0.2)"
            stroke="rgba(255,255,255,0.34)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Floating question-mark / discovery spark above head */}
          <text
            x="92"
            y="184"
            fill="#f5b700"
            fontSize="22"
            fontWeight="800"
            className="hero-curiosity-mark"
          >
            ?
          </text>
        </g>

        {/* Discovered item radar pings along the trail */}
        <g transform="translate(340, 290)" className="hero-ping-node p1">
          <circle r="12" fill="none" stroke="#f5b700" strokeWidth="2" className="radar-ring r1" />
          <circle r="5" fill="#f5b700" />
        </g>
        <g transform="translate(520, 220)" className="hero-ping-node p2">
          <circle r="12" fill="none" stroke="#ffffff" strokeWidth="2" className="radar-ring r2" />
          <circle r="4.5" fill="#ffffff" />
        </g>
        <g transform="translate(650, 315)" className="hero-ping-node p3">
          <circle r="12" fill="none" stroke="#f5b700" strokeWidth="2" className="radar-ring r1" />
          <circle r="4.5" fill="#d92b2b" />
        </g>
      </svg>
    </div>
  );
}
