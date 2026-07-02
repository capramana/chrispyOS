"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { DiceFive, Search } from "iconoir-react";
import {
  buildGuestBookSearchIndex,
  formatGuestBookHandleDisplay,
  guestBookRandomSearchEntryOffSpread,
  searchGuestBookEntries,
  type GuestBookPageContent,
  type GuestBookSearchEntry,
} from "@/lib/memento/guestBookPages";
import { mementoAvatarUrl } from "@/lib/memento/mementoAvatarUrl";
import "./GuestBook.css";

type GuestBookSearchProps = {
  pages: GuestBookPageContent[];
  onSelect: (entry: GuestBookSearchEntry) => void;
  navigating: boolean;
  /** Open spread step, or null when the book is closed. */
  spreadStep: number | null;
  onOpenChange?: (open: boolean) => void;
};

const SEARCH_RESULT_LIMIT = 50;

function GuestBookSearchOptionAvatar({
  entry,
  listRef,
}: {
  entry: GuestBookSearchEntry;
  listRef: RefObject<HTMLUListElement | null>;
}) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const avatarSrc = mementoAvatarUrl(entry.id);
  const drawingFallback = `/api/memento/drawing/${entry.id}`;

  useEffect(() => {
    const host = hostRef.current;
    const root = listRef.current;
    if (!host || !root) return;

    const observer = new IntersectionObserver(
      ([hit]) => {
        if (!hit?.isIntersecting) return;
        setSrc(avatarSrc);
        observer.disconnect();
      },
      { root, rootMargin: "48px" },
    );

    observer.observe(host);
    return () => observer.disconnect();
  }, [avatarSrc, entry.id, listRef]);

  return (
    <span ref={hostRef} className="guest-book-search__avatar" aria-hidden>
      {src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt=""
          decoding="async"
          draggable={false}
          onError={(event) => {
            const img = event.currentTarget;
            if (img.src !== drawingFallback) img.src = drawingFallback;
          }}
        />
      ) : null}
    </span>
  );
}

export default function GuestBookSearch({
  pages,
  onSelect,
  navigating,
  spreadStep,
  onOpenChange,
}: GuestBookSearchProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [tailFadeIndex, setTailFadeIndex] = useState<number | null>(null);

  const searchIndex = useMemo(() => buildGuestBookSearchIndex(pages), [pages]);
  const matches = useMemo(() => {
    if (!query.trim()) return searchIndex;
    return searchGuestBookEntries(searchIndex, query, SEARCH_RESULT_LIMIT);
  }, [query, searchIndex]);
  const showNoMatchPick = query.trim().length > 0 && matches.length === 0;
  const showPanel = open;
  const visibleTailFadeIndex = showPanel ? tailFadeIndex : null;
  const clampedActiveIndex =
    matches.length === 0 ? 0 : Math.min(activeIndex, matches.length - 1);

  const updateTailFade = useCallback(() => {
    const list = listRef.current;
    if (!list) {
      setTailFadeIndex(null);
      return;
    }

    const viewportTop = list.scrollTop;
    const viewportBottom = list.scrollTop + list.clientHeight;
    const hasMoreBelow =
      list.scrollTop + list.clientHeight < list.scrollHeight - 1;

    if (!hasMoreBelow) {
      setTailFadeIndex(null);
      return;
    }

    const items = list.querySelectorAll<HTMLElement>("[data-search-option]");
    let lastVisibleIndex: number | null = null;

    items.forEach((item, index) => {
      const top = item.offsetTop;
      const bottom = top + item.offsetHeight;
      if (bottom > viewportTop && top < viewportBottom) {
        lastVisibleIndex = index;
      }
    });

    setTailFadeIndex(lastVisibleIndex);
  }, []);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!showPanel) return;

    const list = listRef.current;
    if (!list) return;

    list.addEventListener("scroll", updateTailFade, { passive: true });
    const observer = new ResizeObserver(() => updateTailFade());
    observer.observe(list);

    return () => {
      list.removeEventListener("scroll", updateTailFade);
      observer.disconnect();
    };
  }, [showPanel, matches, updateTailFade]);

  const focusActiveOption = useCallback(
    (index: number) => {
      requestAnimationFrame(() => {
        const list = listRef.current;
        const active = list?.querySelector<HTMLElement>(
          `[data-search-option-index="${index}"]`,
        );
        active?.scrollIntoView({ block: "nearest" });
        updateTailFade();
      });
    },
    [updateTailFade],
  );

  const pick = (entry: GuestBookSearchEntry) => {
    onSelect(entry);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const pickRandomOffSpread = () => {
    if (navigating) return;
    const entry = guestBookRandomSearchEntryOffSpread(searchIndex, spreadStep);
    if (entry) pick(entry);
  };

  const submitSearch = () => {
    if (navigating) return;
    if (showNoMatchPick) {
      pickRandomOffSpread();
      return;
    }
    const entry = matches[clampedActiveIndex];
    if (entry) pick(entry);
  };

  return (
    <div ref={rootRef} className="guest-book-search">
      <label className="guest-book-search__label" htmlFor={`${listId}-input`}>
        Search guestbook
      </label>

      {showPanel ? (
        <div className="guest-book-search__panel guest-book-search__panel--enter">
          <ul
            ref={listRef}
            id={`${listId}-listbox`}
            className="guest-book-search__list"
            role="listbox"
          >
            {showNoMatchPick ? (
              <li
                id={`${listId}-option-random-pick`}
                role="option"
                aria-selected
                data-search-option
                data-search-option-index={0}
              >
                <button
                  type="button"
                  className="guest-book-search__option guest-book-search__option--active guest-book-search__empty-pick"
                  disabled={navigating}
                  onClick={pickRandomOffSpread}
                >
                  <DiceFive
                    className="guest-book-search__empty-pick-icon"
                    width={14}
                    height={14}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span className="guest-book-search__empty-pick-text">
                    No matches, pick for me
                  </span>
                </button>
              </li>
            ) : matches.length === 0 ? (
              <li className="guest-book-search__empty" role="presentation">
                No entries
              </li>
            ) : (
              matches.map((entry, index) => (
                <li
                  key={entry.id}
                  id={`${listId}-option-${entry.id}`}
                  role="option"
                  aria-selected={index === clampedActiveIndex}
                  data-search-option
                  data-search-option-index={index}
                  className={
                    index === visibleTailFadeIndex
                      ? "guest-book-search__item--tail-fade"
                      : undefined
                  }
                >
                  <button
                    type="button"
                    className={`guest-book-search__option${
                      index === clampedActiveIndex
                        ? " guest-book-search__option--active"
                        : ""
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => pick(entry)}
                  >
                    <GuestBookSearchOptionAvatar
                      key={entry.id}
                      entry={entry}
                      listRef={listRef}
                    />
                    <span className="guest-book-search__option-text">
                      <span className="guest-book-search__option-name">
                        {entry.name}
                      </span>
                      <span className="guest-book-search__option-handle">
                        {formatGuestBookHandleDisplay(
                          entry.socialHandle,
                          entry.socialType,
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      <div
        className="guest-book-search__pill"
        onClick={() => inputRef.current?.focus()}
      >
        <span className="guest-book-search__icon" aria-hidden>
          <Search width={14} height={14} strokeWidth={2} />
        </span>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          className="guest-book-search__input"
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={showPanel ? `${listId}-listbox` : undefined}
          aria-autocomplete="list"
          aria-activedescendant={
            showPanel && showNoMatchPick
              ? `${listId}-option-random-pick`
              : showPanel && matches[clampedActiveIndex]
                ? `${listId}-option-${matches[clampedActiveIndex].id}`
                : undefined
          }
          placeholder="Search"
          value={query}
          disabled={navigating}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
            requestAnimationFrame(() => {
              listRef.current?.scrollTo({ top: 0 });
              updateTailFade();
            });
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              inputRef.current?.blur();
              return;
            }

            if (event.key === "Enter") {
              event.preventDefault();
              submitSearch();
              return;
            }

            if (!showPanel) return;

            if (showNoMatchPick) {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
              }
              return;
            }

            if (matches.length === 0) return;

            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => {
                const next = (index + 1) % matches.length;
                focusActiveOption(next);
                return next;
              });
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => {
                const next = (index - 1 + matches.length) % matches.length;
                focusActiveOption(next);
                return next;
              });
            }
          }}
        />
      </div>
    </div>
  );
}
