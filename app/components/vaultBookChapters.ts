export type VaultBookSubchapter = {
  label: string;
  title: string;
  href: string;
};

export type VaultBookChapter = {
  number: string;
  title: string;
  subchapters: VaultBookSubchapter[];
};

export const VAULT_BOOK_CHAPTERS: VaultBookChapter[] = [
  {
    number: "Chapter 1.",
    title: "Compound your life",
    subchapters: [
      { label: "a.", title: "How to do great work", href: "https://paulgraham.com/greatwork.html" },
      { label: "b.", title: "How To Be Successful", href: "https://blog.samaltman.com/how-to-be-successful" },
      { label: "c.", title: "How to get rich (without getting lucky)", href: "https://x.com/naval/status/1002103360646823936" },
      { label: "d.", title: "Option Rot", href: "https://www.terrain.com/option-rot" },
      { label: "e.", title: "not scared anymore.", href: "https://hardeepgambhir.substack.com/p/not-scared-anymore" },
    ],
  },
  {
    number: "Chapter 2.",
    title: "Building the future",
    subchapters: [
      { label: "a.", title: "Do things that don't scale", href: "https://paulgraham.com/ds.html" },
      { label: "b.", title: "How to Succeed in Mr. Beast Production", href: "https://cdn.prod.website-files.com/6623b7720b009050313e701c/66ede69453b7bbadcd2f05a8_How-To-Succeed-At-MrBeast-Production%20(2).pdf" },
      { label: "c.", title: "The New World", href: "https://colossus.com/article/joshua-kushner-thrive-new-world/" },
      { label: "d.", title: "Berkshire Hathaway Inc. (2022)", href: "https://www.berkshirehathaway.com/letters/2022ltr.pdf" },
      { label: "e.", title: "Apple top 100 leaked email", href: "https://www.documentcloud.org/documents/1104620-steve-jobs-email-in-apple-samsung-case/" },
      { label: "f.", title: "Palantir\u2019s Weirdest Book Recommendation", href: "https://substack.com/home/post/p-175106819" },
    ],
  },
  {
    number: "Chapter 3.",
    title: "Products",
    subchapters: [
      { label: "a.", title: "On Catching Magic, Even in Software", href: "https://substack.com/@manosai/p-154148108" },
      {
        label: "b.",
        title: "After Automation",
        href: "https://every.to/p/after-automation?utm_source=every_homepage&utm_medium=takeover&utm_campaign=after_automation",
      },
      { label: "c.", title: "Output isn't design", href: "https://linear.app/blog" },
    ],
  },
];

export const VAULT_BOOK_PAPER_TEXTURE = "/vault/paper-texture.png";
export const VAULT_BOOK_STAMP = "/vault/book-stamp.svg";
