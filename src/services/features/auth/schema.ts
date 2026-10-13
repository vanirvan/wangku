import { z } from "zod";

export const signInSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = signInSchema.extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
});

export type SignUpValues = z.infer<typeof signUpSchema>;
