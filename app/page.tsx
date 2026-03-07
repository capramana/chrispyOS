import Clock from "./components/Clock";
import MusicPlayer from "./components/MusicPlayer";
import NavButton from "./components/NavButton";
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
            className="text-5xl font-medium tracking-tight text-chromed"
          >
            Chris Pramana
          </h1>
          <p className="mt-3 text-lg text-chromed-sub">
            build dynastic products with intention and care
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
          <NavButton icon={HomeIcon} active />
          <NavButton icon={JournalIcon} />
          <NavButton icon={GridIcon} />
          <NavButton icon={MoonIcon} />
          <NavButton icon={MailIcon} href="mailto:christopher.apramana@gmail.com" />

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
