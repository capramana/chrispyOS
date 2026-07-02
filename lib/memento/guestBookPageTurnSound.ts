export const GUEST_BOOK_PAGE_TURN_SOUND_SRC =
  "/memento/guest-book-page-turn.mp3";
export const GUEST_BOOK_PAGE_SHUFFLE_SOUND_SRC =
  "/memento/guest-book-page-shuffle.mp3";
export const GUEST_BOOK_COVER_SOUND_SRC = "/memento/guest-book-cover.mp3";

const POOL_SIZE = 4;

type PooledAudio = {
  audio: HTMLAudioElement;
  stopTimerId: number | null;
};

const audioPools = new Map<string, PooledAudio[]>();

function getAudioPool(src: string): PooledAudio[] {
  let pool = audioPools.get(src);
  if (!pool) {
    pool = Array.from({ length: POOL_SIZE }, () => ({
      audio: new Audio(src),
      stopTimerId: null,
    }));
    pool.forEach(({ audio }) => {
      audio.preload = "auto";
    });
    audioPools.set(src, pool);
  }
  return pool;
}

function stopAudio(entry: PooledAudio): void {
  if (entry.stopTimerId !== null) {
    window.clearTimeout(entry.stopTimerId);
    entry.stopTimerId = null;
  }
  entry.audio.pause();
  entry.audio.currentTime = 0;
}

function playSound(src: string, durationMs?: number): void {
  if (typeof window === "undefined") return;

  const pool = getAudioPool(src);
  const entry =
    pool.find(({ audio }) => audio.paused || audio.ended) ?? pool[0]!;

  stopAudio(entry);
  void entry.audio.play().catch(() => {});

  if (durationMs === undefined || durationMs <= 0) return;

  entry.stopTimerId = window.setTimeout(() => {
    entry.stopTimerId = null;
    entry.audio.pause();
    entry.audio.currentTime = 0;
  }, durationMs);
}

export function playGuestBookPageTurnSound(durationMs?: number): void {
  playSound(GUEST_BOOK_PAGE_TURN_SOUND_SRC, durationMs);
}

export function playGuestBookPageShuffleSound(durationMs?: number): void {
  playSound(GUEST_BOOK_PAGE_SHUFFLE_SOUND_SRC, durationMs);
}

export function playGuestBookCoverSound(durationMs?: number): void {
  playSound(GUEST_BOOK_COVER_SOUND_SRC, durationMs);
}

export function stopAllGuestBookPageSounds(): void {
  for (const pool of audioPools.values()) {
    for (const entry of pool) {
      stopAudio(entry);
    }
  }
}
