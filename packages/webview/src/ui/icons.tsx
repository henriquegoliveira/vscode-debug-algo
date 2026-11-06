import React from 'react';

const BASE: React.SVGProps<SVGSVGElement> = {
  width: 13,
  height: 13,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const FrameIcon: React.FC = () => (
  <svg {...BASE} aria-hidden="true">
    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

export const StackIcon: React.FC = () => (
  <svg {...BASE} aria-hidden="true">
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
);

export const NullIcon: React.FC = () => (
  <svg {...BASE} aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
    <path d="M6 18L18 6" />
  </svg>
);

export const FollowIcon: React.FC = () => (
  <svg {...BASE} aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M3 12h3m12 0h3M12 3v3m0 12v3" />
  </svg>
);

export const ChevronIcon: React.FC = () => (
  <svg {...BASE} width={11} height={11} aria-hidden="true">
    <path d="M19 9l-7 7-7-7" />
  </svg>
);

export const ListIcon: React.FC = () => (
  <svg {...BASE} aria-hidden="true">
    <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);

export const HistoryIcon: React.FC = () => (
  <svg {...BASE} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
