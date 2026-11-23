// The Ops Assistant robot (design: Venky, Nov 2026). Body poses are images in /public/assistant (visor left empty);
// the eyes and brows are drawn here so every mood has its own face. Coordinates are in the 840×840 image space.
// All six poses are stacked and cross-faded, so switching mood never waits for a download. Motion is CSS only and
// stops under prefers-reduced-motion (globals.css, ".robot").
import type { RobotMood } from "@/lib/assistant/mood";

const POSE: Record<RobotMood, string> = { idle: "idle", hello: "wave", think: "think", alert: "alert", problem: "idle", done: "cheer", sleep: "sleep" };
const POSES = ["idle", "wave", "think", "alert", "cheer", "sleep"];

const eyes = (dx = 0, dy = 0, ry = 1) => <g className="robot-eyes" transform={`translate(${dx} ${dy})`}>
  <ellipse className="robot-eye" cx={412} cy={255} rx={25} ry={45 * ry} /><ellipse className="robot-eye" cx={557} cy={249} rx={22} ry={39 * ry} />
</g>;
const brows = (l: string, r: string) => <><path className="robot-line" d={l} /><path className="robot-line" d={r} /></>;
const NORMAL = brows("M360 190 Q388 160 418 176", "M528 166 Q562 142 598 164");

const FACE: Record<RobotMood, React.ReactNode> = {
  idle: <>{NORMAL}{eyes()}</>,
  hello: <>{brows("M360 178 Q388 148 418 164", "M528 154 Q562 130 598 152")}{eyes()}</>,
  think: <>{brows("M362 176 Q390 150 420 160", "M530 170 Q562 160 596 170")}{eyes(14, -14, 0.85)}</>,
  alert: <>{brows("M358 170 Q388 136 420 154", "M526 146 Q562 118 600 142")}{eyes(0, -4, 1.12)}</>,
  problem: <>{brows("M362 188 Q392 180 420 164", "M526 160 Q556 176 590 184")}{eyes(0, 8, 0.75)}</>,
  done: <>{brows("M360 182 Q388 152 418 168", "M528 158 Q562 134 598 156")}<path className="robot-line robot-thick" d="M387 268 Q412 222 437 268" /><path className="robot-line robot-thick" d="M535 262 Q557 220 579 262" /></>,
  sleep: <><path className="robot-line robot-thick" d="M387 258 Q412 276 437 258" /><path className="robot-line robot-thick" d="M535 252 Q557 270 579 252" /><text className="robot-z" x={650} y={150}>z</text><text className="robot-z robot-z2" x={690} y={110}>z</text></>,
};

export default function RobotMascot({ mood }: { mood: RobotMood }) {
  return (
    <span className="robot" data-mood={mood} aria-hidden="true">
      {POSES.map((p) => <img key={p} src={`/assistant/robot-${p}.webp`} alt="" width={256} height={256} draggable={false} className={POSE[mood] === p ? "on" : undefined} />)}
      <svg className="robot-face" viewBox="0 0 840 840">{FACE[mood]}</svg>
    </span>
  );
}
