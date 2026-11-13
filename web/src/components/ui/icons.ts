import {
  Archive, ArrowRight, ArrowUpDown, AtSign, Ban, Bell, CalendarClock, Check, CheckCheck, ChevronDown, ChevronRight,
  CircleCheck, CircleDashed, CircleDot, CircleHelp, CircleMinus, CircleX, Clock, Copy, Ellipsis, ExternalLink, Eye,
  EyeOff, FilterX, Film, FileText, FolderKanban, Gauge, GripVertical, History, Home, Hourglass, Image, Info, KeyRound,
  Languages, Link2, ListChecks, Loader, Mail, MailCheck, MailX, Megaphone, Pause, PenLine, Plug, Plus, Radio, RefreshCw,
  Rocket, Search, Send, Shapes, ShieldBan, SlidersHorizontal, SquareCheckBig, Trash2, TriangleAlert, Undo2, Unlink,
  User, UserRound, Users, Wrench, X, type LucideIcon,
} from "lucide-react";
import { LinkedinGlyph, XGlyph, InstagramGlyph, type ChannelGlyph } from "@/components/ui/channelGlyphs";

/*
 * The icon vocabulary: one concept, one icon, everywhere. A new icon needs a
 * concept here and a word (en and he) in `i18n/mobile.ts`; `icons.test.ts`
 * fails on either missing. Sizes are 16, 20 or 24; directional icons
 * (chevrons, arrows) mirror in a right-to-left page, clocks, checks, brand
 * marks and charts never do.
 *
 * The four channels are not lucide: lucide ships no brand marks. Email is the
 * lucide envelope; the rest are `channelGlyphs.ts`.
 */
export type IconSource = LucideIcon | ChannelGlyph;

export const ICON = {
  /* records */
  note: FileText,
  release: Rocket,
  project: FolderKanban,
  area: Shapes,
  story: User,
  home: Home,
  announcement: Megaphone,
  image: Image,
  video: Film,
  iconAsset: Shapes,
  connectedApp: Plug,
  accessWrite: KeyRound,
  accessRead: Eye,
  /* state */
  draft: PenLine,
  changes: CircleDot,
  published: CircleCheck,
  scheduled: CalendarClock,
  sending: Send,
  sent: CheckCheck,
  paused: Pause,
  failed: CircleX,
  archived: Archive,
  attention: TriangleAlert,
  hidden: EyeOff,
  revoked: Ban,
  expired: Hourglass,
  loading: Loader,
  /* audience */
  contact: UserRound,
  mailable: MailCheck,
  pendingConfirm: Hourglass,
  unsubscribed: MailX,
  suppressed: ShieldBan,
  group: Users,
  language: Languages,
  /* translation */
  hebrewMissing: CircleDashed,
  hebrewStale: RefreshCw,
  hebrewDraft: PenLine,
  hebrewUnverified: CircleHelp,
  hebrewDone: Check,
  /* channels */
  linkedin: LinkedinGlyph,
  x: XGlyph,
  instagram: InstagramGlyph,
  email: Mail,
  /* journey */
  from: AtSign,
  to: Users,
  when: Clock,
  direction: ArrowRight,
  /* metrics */
  budget: Gauge,
  sentCount: Check,
  failedCount: CircleX,
  skippedCount: CircleMinus,
  usedIn: Link2,
  unused: Unlink,
  /* settings */
  everyday: SlidersHorizontal,
  channels: Radio,
  senderDelivery: Send,
  sendingLimits: Gauge,
  alerts: Bell,
  advanced: Wrench,
  info: Info,
  searchSettings: Search,
  /* actions */
  open: ChevronRight,
  expand: ChevronDown,
  copy: Copy,
  external: ExternalLink,
  markPosted: CircleCheck,
  select: ListChecks,
  selectAll: SquareCheckBig,
  filter: SlidersHorizontal,
  sort: ArrowUpDown,
  clearFilters: FilterX,
  add: Plus,
  more: Ellipsis,
  delete: Trash2,
  undo: Undo2,
  reorder: GripVertical,
  restore: History,
  close: X,
} satisfies Record<string, IconSource>;

export type Concept = keyof typeof ICON;
export const CONCEPTS = Object.keys(ICON) as Concept[];

/** Concepts whose glyph must flip in a right-to-left page. */
export const MIRRORED: ReadonlySet<Concept> = new Set<Concept>(["open", "direction"]);
