import {
  Phone,
  MessageCircle,
  Store,
  HelpCircle,
  UserCog,
  User,
  UserCircle,
  UserPlus,
  Camera,
  ThumbsUp,
  PlayCircle,
  Repeat2,
} from "lucide-react";
import type { SaleSource } from "../types";

// The one list of "where did this customer come from" -- used by the Customer
// Tracker (sales) and Appointments, so a source added in one is in the other.
export const SOURCE_LABELS: Record<SaleSource, string> = {
  call: "Call",
  whatsapp: "WhatsApp",
  walk_in: "Walk-in",
  owner: "Owner",
  dastagir: "Dastagir",
  karthik: "Karthik",
  referral: "Referral",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  regular_customer: "Regular Customer",
  unknown: "Unknown",
};

export const SOURCE_ICONS: Record<SaleSource, typeof Phone> = {
  call: Phone,
  whatsapp: MessageCircle,
  walk_in: Store,
  owner: UserCog,
  dastagir: User,
  karthik: UserCircle,
  referral: UserPlus,
  instagram: Camera,
  facebook: ThumbsUp,
  youtube: PlayCircle,
  regular_customer: Repeat2,
  unknown: HelpCircle,
};

export const SOURCE_OPTIONS = (Object.keys(SOURCE_LABELS) as SaleSource[]).map((value) => ({ value, label: SOURCE_LABELS[value] }));
