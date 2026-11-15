import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "@/lib/toast";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { ICON } from "@/components/ui/icons";
import { SidePanel } from "@/components/ui/SidePanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePhone } from "@/hooks/usePhone";
import MediaPhone from "@/components/admin/MediaPhone";
import MediaDesktop from "@/components/admin/MediaDesktop";
import MediaDetail from "@/components/admin/MediaDetail";
import { useMediaPhoneWords } from "@/components/admin/mediaPhoneWords";
import { useMediaUploadWords } from "@/components/admin/mediaUploadWords";
import AdminShell from "@/components/admin/AdminShell";
import { ErrorState, PageHeader, UnreadableNote } from "@/components/admin/ui";
import MediaUpload from "@/components/admin/MediaUpload";
import {
  MEDIA_KINDS,
  media,
  type MediaItem,
  type MediaKind,
} from "@/services/media";
import { unreadableCount } from "@/services/tolerant";

/*
 * The media library (#253): every picture, icon and short video the site can
 * use, uploaded and described here rather than committed to web/public and
 * shipped with a deploy.
 *
 * On a desktop (S7) the header has one primary action, Upload; the filters,
 * the grid or list and the bulk delete are MediaDesktop's, and the open item is
 * in a side panel. The open item is in the URL (`?id=`), so a link to one item
 * works and Back closes it; so are the search (`?q=`), the kind (`?kind=`) and
 * the view (`?view=list`). Search filters what is loaded; the library is tens of
 * items, not thousands.
 *
 * Below 600px the grid is square tiles and the item is a bottom sheet (#681).
 * A sheet keeps its own history entry, so there the open item is state: a
 * link with `?id=` opens it once and the address is cleaned.
 */
export default function AdminMedia() {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const kindParam = params.get("kind");
  const kind = (MEDIA_KINDS as readonly string[]).includes(kindParam ?? "")
    ? (kindParam as MediaKind)
    : null;
  const phone = usePhone();
  const p = useMediaPhoneWords();
  const up = useMediaUploadWords();
  const pick = useRef<(() => void) | null>(null);
  const takePicker = useCallback((open: (() => void) | null) => {
    pick.current = open;
  }, []);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const openId = phone ? sheetId : params.get("id");

  useEffect(() => {
    media
      .list()
      .then((l) => (setItems(l), setSkipped(unreadableCount(l))))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : p.loadFailed),
      );
    // The words change with the language, not the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* A phone's sheet is state, not an address: take a link's `?id=` into it once and clean the address. */
  const linked = params.get("id");
  const [taken, setTaken] = useState<string | null>(null);
  if (taken !== (phone ? linked : null)) {
    setTaken(phone ? linked : null);
    if (phone && linked) setSheetId(linked);
  }
  useEffect(() => {
    if (!phone || !linked) return;
    setParams(
      (cur) => {
        const n = new URLSearchParams(cur);
        n.delete("id");
        return n;
      },
      { replace: true },
    );
  }, [phone, linked, setParams]);

  const setParam = (key: string, value: string | null) =>
    setParams(
      (cur) => {
        const n = new URLSearchParams(cur);
        if (value) n.set(key, value);
        else n.delete(key);
        return n;
      },
      { replace: key !== "id" },
    );

  const open = openId ? (items?.find((m) => m.id === openId) ?? null) : null;
  const openItem = (id: string | null) =>
    phone ? setSheetId(id) : setParam("id", id);

  const replaceItem = (next: MediaItem) =>
    setItems((list) =>
      (list ?? []).map((m) =>
        m.id === next.id ? { ...next, usedBy: next.usedBy ?? m.usedBy } : m,
      ),
    );
  const dropItems = (gone: MediaItem[]) => {
    const ids = new Set(gone.map((m) => m.id));
    setItems((list) => (list ?? []).filter((m) => !ids.has(m.id)));
  };

  const detail = (close: () => void) =>
    open && (
      <MediaDetail
        key={`${open.id}:${open._rev}`}
        item={open}
        onSaved={(next, words) => {
          replaceItem(next);
          toast.success(words);
        }}
        onDeleted={(gone) => {
          dropItems([gone]);
          toast.success(p.deleted(gone.name));
          close();
        }}
      />
    );

  return (
    <AdminShell
      title={p.title}
      section="media"
      counts={{ media: items?.length }}
    >
      <div className={phone ? undefined : "a-wrap"}>
        {phone ? (
          <div className="a-page-head !mb-3 !flex-nowrap !items-center !justify-between !pb-2">
            <h1 className="a-h1 min-w-0">{p.title}</h1>
            <InfoPopover label={p.aboutLabel} text={p.explainer} />
          </div>
        ) : (
          <PageHeader
            title={p.title}
            description={p.intro}
            info={p.explainer}
            primary={{
              id: "upload",
              label: up.upload,
              icon: ICON.add,
              onSelect: () => pick.current?.(),
            }}
          />
        )}

        <div className={phone ? "mt-4" : "mt-6"}>
          <UnreadableNote count={skipped} />
          <MediaUpload
            onPicker={phone ? undefined : takePicker}
            kinds={
              kind
                ? [kind, ...MEDIA_KINDS.filter((k) => k !== kind)]
                : MEDIA_KINDS
            }
            onUploaded={(item) => {
              setItems((list) => [item, ...(list ?? [])]);
              toast.success(p.uploaded(item.name));
              openItem(item.id);
            }}
          />
        </div>

        {error && (
          <div className={phone ? "mt-4" : "mt-8"}>
            <ErrorState message={error} />
          </div>
        )}

        {phone ? (
          <>
            <p className="sr-only" role="status">
              {items === null ? p.loading : p.count(items.length, items.length)}
            </p>
            {!error && items === null && (
              <div className="mt-4">
                <Skeleton variant="cards" rows={6} label={p.loading} />
              </div>
            )}
            {items !== null && items.length === 0 && (
              <div className="mt-4">
                <EmptyState
                  variant="first-use"
                  title={p.empty}
                  description={p.emptyHint}
                />
              </div>
            )}
            {items !== null && items.length > 0 && (
              <div className="mt-4">
                <MediaPhone
                  items={items}
                  q={q}
                  onQ={(v) => setParam("q", v || null)}
                  onOpen={(id) => setSheetId(id)}
                  onDeleted={dropItems}
                />
              </div>
            )}
          </>
        ) : (
          !error && (
            <div className="mt-6">
              <MediaDesktop
                items={items}
                openId={openId}
                onOpen={(id) => setParam("id", id)}
                onDeleted={dropItems}
                pick={pick}
              />
            </div>
          )
        )}
      </div>

      {phone ? (
        <BottomSheet
          open={Boolean(open)}
          onClose={() => setSheetId(null)}
          title={open ? open.name : p.title}
          snap="half"
        >
          {detail(() => setSheetId(null))}
        </BottomSheet>
      ) : (
        <SidePanel
          open={Boolean(open)}
          onOpenChange={(o) => !o && setParam("id", null)}
          title={open ? open.name : p.title}
        >
          {detail(() => setParam("id", null))}
        </SidePanel>
      )}
    </AdminShell>
  );
}
