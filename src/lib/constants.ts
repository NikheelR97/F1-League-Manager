export const MAX_DRIVERS_PER_RACE = 20;
export const MAX_DRIVERS_PER_SEASON = 50;
export const MAX_TEAMS_PER_LEAGUE = 15;
export const MAX_RESERVES_PER_TEAM = 3;
export const MAX_WHEEL_CIRCUITS = 24;
export const MAX_POINTS_POSITIONS = 20;
export const SESSION_CODE_LENGTH = 6;

export const F1_2025_ROUND_COUNT = 24;
export const F1_INFORMAL_RACES_PER_SESSION = 2;
export const F1_INFORMAL_RACE_PCT = 25;
export const F1_STANDARD_RACE_PCT = 50;

export const STANDARD_POINTS: Readonly<Record<number, number>> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};

export const FASTEST_LAP_BONUS = 1;
export const POLE_POSITION_BONUS = 0;

export const MAX_RESULT_SUBMISSION_SIZE_BYTES = 50_000;
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MINUTES = 15;
export const JWT_EXPIRY_SECONDS = 3600;
export const ADMIN_SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;
export const ADMIN_RATE_LIMIT_REQUESTS = 5;
export const ADMIN_RATE_LIMIT_WINDOW = "10 s";
export const AUTH_RATE_LIMIT_REQUESTS = 5;
export const AUTH_RATE_LIMIT_WINDOW = "15 m";
export const CSRF_HEADER_NAME = "x-csrf-token";
export const MAX_ERROR_MESSAGE_LENGTH = 160;
export const MAX_AUDIT_ACTION_LENGTH = 80;
export const MAX_AUDIT_METADATA_BYTES = 5_000;
export const MAX_AUTH_COOKIES = 12;

export const COUNTDOWN_TICK_MS = 1000;
export const STANDINGS_REFRESH_MS = 30_000;
export const WHEEL_SPIN_DURATION_MS = 4000;
export const WHEEL_DECEL_DURATION_MS = 2000;
