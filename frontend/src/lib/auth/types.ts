export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  tier: "free" | "pro" | "b2b";
  user_mode: "default" | "conservative";
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: AuthUser;
};

export type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: AuthUser }
  | { status: "anonymous" };
