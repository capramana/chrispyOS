/** Bump when stored avatar bytes change so browsers drop stale drawing fallbacks. */
export const MEMENTO_AVATAR_URL_VERSION = 6;

export function mementoAvatarUrl(id: string): string {
  return `/api/memento/avatar/${id}?v=${MEMENTO_AVATAR_URL_VERSION}`;
}
