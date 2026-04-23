import { assertEquals } from "jsr:@std/assert@1";
import {
  isAlreadyRegisteredError,
  isSupabaseMailerFailure,
  isUserConfirmed,
} from "./invite-errors.js";

Deno.test("isAlreadyRegisteredError detecta mensajes típicos de GoTrue", () => {
  assertEquals(isAlreadyRegisteredError({ message: "User already registered" }), true);
  assertEquals(
    isAlreadyRegisteredError({ message: "A user with this email address has already been registered" }),
    true,
  );
  assertEquals(isAlreadyRegisteredError({ message: "Network timeout" }), false);
  assertEquals(isAlreadyRegisteredError(null), false);
});

Deno.test("isSupabaseMailerFailure detecta fallos SMTP / envío de invitación", () => {
  assertEquals(
    isSupabaseMailerFailure({ message: "Error sending invite email: 535 5.7.8 BadCredentials" }),
    true,
  );
  assertEquals(isSupabaseMailerFailure({ message: "gomail: could not send" }), true);
  assertEquals(isSupabaseMailerFailure({ message: "dial tcp 127.0.0.1:587: connection refused" }), true);
  assertEquals(isSupabaseMailerFailure({ message: "rate limit exceeded" }), true);
  assertEquals(isSupabaseMailerFailure({ message: "invalid_grant" }), false);
});

Deno.test("isUserConfirmed refleja flags de Supabase Auth", () => {
  assertEquals(isUserConfirmed({ email_confirmed_at: "2020-01-01" }), true);
  assertEquals(isUserConfirmed({ confirmed_at: "2020-01-01" }), true);
  assertEquals(isUserConfirmed({ last_sign_in_at: "2020-01-01" }), true);
  assertEquals(isUserConfirmed({ email: "a@b.c" }), false);
});
