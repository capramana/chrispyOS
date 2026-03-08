import Clock from "./components/Clock";
import NavBar from "./components/NavBar";
import WorkExperience from "./components/WorkExperience";

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
          <h1 className="text-[40px] font-medium tracking-tight text-chromed">
            Chris Pramana
          </h1>
          <p className="mt-2 text-lg text-chromed-sub max-w-[460px]">
            lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
        </div>
      </div>

      {/* Bottom Left - Clock */}
      <div className="fixed bottom-12 left-12">
        <Clock />
      </div>

      {/* Bottom Center - Navigation Bar */}
      <NavBar />

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
