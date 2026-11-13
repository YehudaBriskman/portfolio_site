import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { AnnounceChannel, AnnounceSummary } from "@/services/adminAnnounce";
import { releaseTag } from "../helpers";
import Composer from "./Composer";
import { useMarketingWords } from "./words";

/*
 * The phone's composer: the same Composer, inside a bottom sheet that opens
 * half way and pulls up to full. The sheet owns the title, the handle and the
 * sticky footer; the Composer fills the body and puts the per-channel Copy /
 * Open / Mark done in the footer through `footerHost`. It is mounted only
 * while open, so closing it saves a pending caption (the Composer's own
 * clean-up) and the next one starts clean.
 */
export default function InboxSheet({
  event,
  onClose,
  onChange,
  undo,
  onMarkDone,
}: {
  event: AnnounceSummary | null;
  onClose: () => void;
  onChange: (next: AnnounceSummary | null) => void;
  undo: { channel: AnnounceChannel; onUndo: () => void } | null;
  onMarkDone: (channel: AnnounceChannel) => void;
}) {
  const w = useMarketingWords();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const tag = event ? releaseTag(event) : null;
  const title = event ? (tag ? w.releaseTitle(tag) : event.title) : "";
  return (
    <BottomSheet open={event !== null} onClose={onClose} title={title} snap="half" snaps={["half", "full"]} footer={<div ref={setHost} className="mk-sheet-foot" />}>
      {event && <Composer key={event.id} embedded event={event} footerHost={host} onBack={onClose} onChange={onChange} undo={undo} onMarkDone={onMarkDone} />}
    </BottomSheet>
  );
}
