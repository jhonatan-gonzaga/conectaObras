import { request, setAccessToken } from "./api-core";
import type { AuthResponse, AuthUser, SelectableUserRole, UserRole } from "./api-types";

export const authApi = {
  async login(email: string, password: string) {
    const response = await request<AuthResponse>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password }),
    });
    await setAccessToken(response.accessToken);
    return response;
  },

  async register(input: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role?: UserRole;
  }) {
    const response = await request<AuthResponse>("/auth/register", {
      method: "POST",
      auth: false,
      body: JSON.stringify(input),
    });
    await setAccessToken(response.accessToken);
    return response;
  },

  async switchRole(role: SelectableUserRole) {
    const response = await request<AuthResponse>("/auth/switch-role", {
      method: "POST",
      body: JSON.stringify({ role }),
    });
    await setAccessToken(response.accessToken);
    return response;
  },

  async googleAuth(input: { email: string; name: string; avatarUrl?: string | null }) {
    const response = await request<AuthResponse>("/auth/google", {
      method: "POST",
      auth: false,
      body: JSON.stringify(input),
    });
    await setAccessToken(response.accessToken);
    return response;
  },

  forgotPassword: (email: string) =>
    request<{ message: string; temporaryPassword: string }>("/auth/forgot-password", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email }),
    }),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    request<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  me: () => request<AuthUser>("/auth/me"),
  logout: async () => { await setAccessToken(null); },
  updateMe: (input: Partial<Pick<AuthUser, "name" | "email" | "phone" | "avatarUrl">>) =>
    request<AuthUser>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteMe: async () => {
    const response = await request<{ deleted: true }>("/users/me", {
      method: "DELETE",
    });
    await setAccessToken(null);
    return response;
  },
};
