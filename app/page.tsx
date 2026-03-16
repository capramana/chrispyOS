import Clock from "./components/Clock";
import NavBar from "./components/NavBar";
import WorkExperience from "./components/WorkExperience";
import ChisledText from "./components/ChisledText";
import Graffiti from "./components/Graffiti";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-white dark:bg-[#1E1E1E]">
      {/* Top Left - City */}
      <div className="fixed top-12 left-12">
        <span className="transition-blur-corner inline-block font-mono text-base tracking-wide text-primary">new york, ny</span>
      </div>

      {/* Top Right - Work Experience */}
      <div className="fixed top-12 right-12">
        <div className="transition-blur-logo">
          <WorkExperience />
        </div>
      </div>

      {/* Center Content */}
      <div className="flex min-h-screen items-center justify-center">
        <div>
          <h1 id="main-heading" className="transition-blur text-[40px] font-medium tracking-tight">
            <ChisledText>Chris Pramana</ChisledText>
          </h1>
          <p id="main-description" className="transition-blur mt-2 text-lg max-w-[460px]">
            <ChisledText sub>lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</ChisledText>
          </p>
        </div>
      </div>

      {/* Bottom Left - Clock */}
      <div className="fixed bottom-12 left-12">
        <div className="transition-blur-corner">
          <Clock />
        </div>
      </div>

      {/* Bottom Center - Navigation Bar */}
      <NavBar />

      {/* Bottom Right - Social Handle */}
      <div className="fixed bottom-12 right-12">
        <a
          href="https://x.com/chrispramana"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-blur-corner block font-mono text-base tracking-wide text-primary hover:underline"
        >
          @chrispramana
        </a>
      </div>

      {/* Graffiti - idle neon doodle (dark mode only) */}
      <Graffiti />
    </div>
  );
}
