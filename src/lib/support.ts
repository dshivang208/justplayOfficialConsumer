/**
 * Support tickets (player side). A player raises a ticket, the JustPlay team
 * answers from the admin app, and the conversation continues here.
 *
 * Reads go straight to the tables (RLS: you only ever see your own tickets,
 * and never the team's internal notes). Writes go through SECURITY DEFINER
 * RPCs from 20261023050000_support_tickets.sql.
 */
import { supabase } from "./supabaseClient";

export type TicketStatus = "open" | "in_progress" | "waiting_user" | "resolved" | "closed";
export type TicketCategory =
  | "booking"
  | "payment_refund"
  | "venue"
  | "account"
  | "game_group"
  | "other";

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  booking: "A booking",
  payment_refund: "Payment or refund",
  venue: "A venue",
  account: "My account",
  game_group: "A game or group",
  other: "Something else",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "Being looked at",
  waiting_user: "Reply from the team",
  resolved: "Resolved",
  closed: "Closed",
};

export type SupportTicket = {
  id: string;
  ticketNo: number;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  bookingId: string | null;
  createdAt: string;
  lastMessageAt: string;
  lastSenderKind: "user" | "admin";
};

export type SupportMessage = {
  id: string;
  ticketId: string;
  senderKind: "user" | "admin";
  body: string;
  createdAt: string;
};

type TicketRow = {
  id: string;
  ticket_no: number | string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  booking_id: string | null;
  created_at: string;
  last_message_at: string;
  last_sender_kind: "user" | "admin";
};

type MessageRow = {
  id: string;
  ticket_id: string;
  sender_kind: "user" | "admin";
  body: string;
  created_at: string;
};

const TICKET_COLS =
  "id, ticket_no, subject, category, status, booking_id, created_at, last_message_at, last_sender_kind";

const toTicket = (r: TicketRow): SupportTicket => ({
  id: r.id,
  ticketNo: Number(r.ticket_no),
  subject: r.subject,
  category: r.category,
  status: r.status,
  bookingId: r.booking_id,
  createdAt: r.created_at,
  lastMessageAt: r.last_message_at,
  lastSenderKind: r.last_sender_kind,
});

const toMessage = (r: MessageRow): SupportMessage => ({
  id: r.id,
  ticketId: r.ticket_id,
  senderKind: r.sender_kind,
  body: r.body,
  createdAt: r.created_at,
});

const ERRORS: Record<string, string> = {
  AUTH_REQUIRED: "Please sign in to contact support.",
  SUBJECT_REQUIRED: "Add a short subject (at least 3 characters).",
  MESSAGE_TOO_SHORT: "Please describe the problem in at least 10 characters.",
  MESSAGE_TOO_LONG: "Messages can be up to 2000 characters.",
  MESSAGE_REQUIRED: "Write a message first.",
  INVALID_BOOKING: "That booking isn't on your account.",
  TOO_MANY_OPEN: "You already have 10 open tickets. Please wait for a reply or mark one solved.",
  TOO_FAST: "You're going too fast. Please wait a little and try again.",
  TICKET_CLOSED: "This ticket is closed. Please open a new one.",
  TICKET_NOT_FOUND: "We couldn't find that ticket.",
};

function friendly(message: string, notInstalled: string): Error {
  if (/could not find the function|PGRST202|support_tickets/i.test(message) && /does not exist|schema cache|could not find/i.test(message)) {
    return new Error(notInstalled);
  }
  const code = Object.keys(ERRORS).find((k) => message.includes(k));
  return new Error(code ? ERRORS[code]! : "Something went wrong. Please try again.");
}

const NOT_READY = "Support isn't available yet. Please try again later.";

export async function fetchMyTickets(): Promise<SupportTicket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select(TICKET_COLS)
    .order("last_message_at", { ascending: false })
    .limit(100)
    .returns<TicketRow[]>();
  if (error) {
    console.error("fetchMyTickets failed:", error.message);
    return [];
  }
  return (data ?? []).map(toTicket);
}

export async function fetchTicket(
  ticketId: string,
): Promise<{ ticket: SupportTicket; messages: SupportMessage[] } | null> {
  const [t, m] = await Promise.all([
    supabase
      .from("support_tickets")
      .select(TICKET_COLS)
      .eq("id", ticketId)
      .maybeSingle<TicketRow>(),
    supabase
      .from("support_ticket_messages")
      .select("id, ticket_id, sender_kind, body, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .returns<MessageRow[]>(),
  ]);
  if (t.error || !t.data) return null;
  return { ticket: toTicket(t.data), messages: (m.data ?? []).map(toMessage) };
}

export async function createTicket(input: {
  subject: string;
  category: TicketCategory;
  message: string;
  bookingId?: string | null;
}): Promise<SupportTicket> {
  const { data, error } = await supabase.rpc("create_support_ticket", {
    p_subject: input.subject,
    p_category: input.category,
    p_message: input.message,
    p_booking_id: input.bookingId ?? null,
  });
  if (error) throw friendly(error.message, NOT_READY);
  return toTicket(data as TicketRow);
}

export async function sendTicketMessage(ticketId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc("add_support_message", {
    p_ticket_id: ticketId,
    p_body: body,
  });
  if (error) throw friendly(error.message, NOT_READY);
}

export async function resolveMyTicket(ticketId: string): Promise<void> {
  const { error } = await supabase.rpc("resolve_my_support_ticket", { p_ticket_id: ticketId });
  if (error) throw friendly(error.message, NOT_READY);
}
