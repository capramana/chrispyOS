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
  {
    text: "Being the richest man in the cemetery doesn't matter to me. Going to bed at night saying we've done something wonderful... that's what matters to me.",
    author: "Steve Jobs",
  },
  {
    text: "I believe we are the best place in the world to fail (we have plenty of practice!), and failure and invention are inseparable twins. To invent you have to experiment, and if you know in advance that it's going to work, it's not an experiment.",
    author: "Jeff Bezos",
  },
];

export function pickVaultPostItQuote() {
  return VAULT_POSTIT_QUOTES[
    Math.floor(Math.random() * VAULT_POSTIT_QUOTES.length)
  ]!;
}
