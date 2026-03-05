import Clock from "./components/Clock";
import MusicPlayer from "./components/MusicPlayer";
import WorkExperience from "./components/WorkExperience";
import { HomeSimple as HomeIcon, EditPencil as JournalIcon, BookmarkBook as GridIcon, HalfMoon as MoonIcon, MailOut as MailIcon } from "iconoir-react";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-white">
      {/* Top Left - City */}
      <div className="fixed top-12 left-12">
        <span className="font-mono text-base tracking-wide text-primary">new york, ny</span>
      </div>

      {/* Top Right - Work Experience */}
      <div className="fixed top-12 right-12">
        <WorkExperience />
      </div>

      {/* Center Content */}
      <div className="flex min-h-screen items-center justify-center">
        <div>
          <h1
            className="text-5xl font-bold tracking-tight text-chromed"
          >
            Chris Pramana
          </h1>
          <p className="mt-3 text-lg text-gray-400">
            builds products with intention and care :)
          </p>
        </div>
      </div>

      {/* Bottom Left - Clock */}
      <div className="fixed bottom-12 left-12">
        <Clock />
      </div>

      {/* Bottom Center - Navigation Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white pl-3 pr-2 py-2 shadow-sm">
          {/* Home Icon */}
          <div className="relative">
            <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <HomeIcon width={20} height={20} strokeWidth={2} color="var(--color-primary)" />
            </button>
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ backgroundColor: "var(--color-secondary)" }} />
          </div>

          {/* Journal Icon */}
          <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <JournalIcon width={20} height={20} strokeWidth={2} color="var(--color-primary)" />
          </button>

          {/* Grid Icon */}
          <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <GridIcon width={20} height={20} strokeWidth={2} color="var(--color-primary)" />
          </button>

          {/* Moon Icon */}
          <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <MoonIcon width={20} height={20} strokeWidth={2} color="var(--color-primary)" />
          </button>

          {/* Mail Icon */}
          <a href="mailto:christopher.apramana@gmail.com" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <MailIcon width={20} height={20} strokeWidth={2} color="var(--color-primary)" />
          </a>

          {/* Divider */}
          <div className="mx-1 h-6 w-px bg-gray-200" />

          {/* Music Player Widget */}
          <MusicPlayer />
        </div>
      </div>

      {/* Bottom Right - Social Handle */}
      <div className="fixed bottom-12 right-12">
        <a
          href="https://x.com/chrispramana"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-base tracking-wide text-primary hover:underline"
        >
          @chrispramana
        </a>
      </div>
    </div>
  );
}
