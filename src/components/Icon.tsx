"use client";

import {
  CheckCircle2, Check, AlertTriangle, Users, User, Timer, Coffee, Pencil, PenLine,
  Calendar, CalendarDays, CalendarClock, PartyPopper, Clock, AlarmClock, Settings,
  Plus, MapPin, BarChart3, TrendingUp, TrendingDown, Search, Moon, Sun, Sunrise,
  FileText, FileCheck, Files, FolderOpen, Folder, Siren, Ban, Bell, Smartphone,
  Package, SquarePen, NotebookPen, Save, Download, Upload, Send, Megaphone,
  Building2, Star, Sparkles, Lock, XCircle, X, Monitor, RefreshCw, Repeat, Shuffle,
  Umbrella, Euro, Banknote, Scale, Contact, IdCard, Wrench, Camera, Pin, Receipt, ReceiptText,
  Stethoscope, Briefcase, Scroll, GraduationCap, DoorOpen, LogOut, HelpCircle, Target,
  Inbox, Radio, Hourglass, Square, Printer, ThumbsUp, Phone, MessageSquare, Mail,
  Lightbulb, Circle, ArrowRight, ArrowLeft, ArrowUpRight, ArrowLeftRight, ChevronRight,
  type LucideIcon,
} from "lucide-react";

// ============================================================================
// <Icon e="🏢" /> — single source of truth for iconography. Maps every emoji
// used across the app to a consistent lucide line icon. Icons inherit the
// surrounding text color (currentColor) unless `color` is passed, so they pick
// up the theme automatically. Default 20px, stroke 2.
// Unknown emoji fall back to a neutral dot so nothing ever renders raw.
// ============================================================================

const MAP: Record<string, LucideIcon> = {
  "✅": CheckCircle2, "✔": Check, "✓": Check, "☑": CheckCircle2,
  "❌": XCircle, "✕": X, "⛔": Ban, "🚫": Ban,
  "⚠": AlertTriangle, "🚨": Siren,
  "👥": Users, "👤": User, "🧑": User,
  "⏱": Timer, "⏰": AlarmClock, "🕐": Clock, "⏳": Hourglass, "⏹": Square,
  "☕": Coffee,
  "✏": Pencil, "✍": PenLine, "📝": SquarePen,
  "📅": Calendar, "🗓": CalendarDays, "📆": CalendarClock,
  "🎉": PartyPopper, "🌟": Sparkles, "⭐": Star,
  "⚙": Settings, "🔧": Wrench, "🛠": Wrench, "🧰": Briefcase,
  "➕": Plus, "📍": MapPin, "📌": Pin,
  "📊": BarChart3, "📈": TrendingUp, "📉": TrendingDown,
  "🔍": Search,
  "🌙": Moon, "☀": Sun, "🌅": Sunrise,
  "📄": FileText, "📜": Scroll, "📑": Files, "🧾": ReceiptText, "🪪": IdCard,
  "📁": Folder, "🗂": FolderOpen,
  "🔔": Bell, "📣": Megaphone, "📲": Smartphone, "🖥": Monitor, "🖨": Printer,
  "🌴": Umbrella, "📦": Package,
  "💾": Save, "⬇": Download, "📤": Upload, "📥": Inbox, "📭": Inbox,
  "🏢": Building2, "🔒": Lock, "🔄": RefreshCw, "🔁": Repeat, "🔀": Shuffle,
  "💶": Euro, "💵": Banknote, "💼": Briefcase,
  "⚖": Scale, "📇": Contact, "📷": Camera,
  "🩺": Stethoscope, "🛂": IdCard, "🎓": GraduationCap, "🚪": DoorOpen, "↪": LogOut,
  "❓": HelpCircle, "🎯": Target, "📡": Radio, "👍": ThumbsUp,
  "📞": Phone, "💬": MessageSquare, "✉": Mail, "💡": Lightbulb, "📋": FileCheck,
  "🟢": Circle, "🔴": Circle, "⚪": Circle,
  "→": ArrowRight, "←": ArrowLeft, "↗": ArrowUpRight, "↔": ArrowLeftRight, "›": ChevronRight,
};

export default function Icon({ e, size = 20, color = "currentColor", className, strokeWidth = 2, fill, style }: {
  e: string; size?: number; color?: string; className?: string; strokeWidth?: number; fill?: string; style?: React.CSSProperties;
}) {
  const C = MAP[(e || "").replace(/[\uFE00-\uFE0F\u200D]/g, "").trim()] || Circle;
  return <C size={size} color={color} strokeWidth={strokeWidth} className={className} style={style} {...(fill ? { fill } : {})} />;
}

// status dots keep their semantic color regardless of surrounding text
export function StatusDot({ color = "#58d68d", size = 9 }: { color?: string; size?: number }) {
  return <Circle size={size} color={color} fill={color} strokeWidth={0} style={{ flexShrink: 0 }} />;
}