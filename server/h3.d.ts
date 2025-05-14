export type MinimumRequestObject = { headers: Headers };

export type TaskReturn<T = unknown> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: { message: string } };
