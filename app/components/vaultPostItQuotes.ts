export type VaultPostItQuote = {
  text: string;
  author: string;
};

export const VAULT_POSTIT_QUOTES: VaultPostItQuote[] = [
  {
    text: "I didn't have time to write a short letter, so I wrote a long one instead.",
    author: "Blaise Pascal",
  },
  {
    text: "The secret to one thing is through the lens of another",
    author: "Neri Oxman",
  },
  {
    text: "The consumer isn't a moron. She is your wife.",
    author: "David Ogilvy",
  },
  {
    text: "Hard work never killed a man. Men die of boredom, psychological conflict, and disease. They do not die of hard work.",
    author: "David Ogilvy",
  },
];

export function pickVaultPostItQuote() {
  return VAULT_POSTIT_QUOTES[
    Math.floor(Math.random() * VAULT_POSTIT_QUOTES.length)
  ]!;
}
