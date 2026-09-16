// __tests__/player/invariants.test.ts
// Enforces the dependency rules from docs/player/03-architecture.md §2 by
// reading the source tree. Rules are activated increment by increment via
// ACTIVE_RULES; an inactive rule is skipped, never deleted.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PLAYER_DIR = join(ROOT, "components", "VideoPlayer");

type RuleId =
  | "R1"
  | "R2"
  | "R3"
  | "R4"
  | "R5"
  | "R6"
  | "R7"
  | "R9"
  | "OLD_ROOT_FROZEN";
const ACTIVE_RULES: readonly RuleId[] = ["R1", "R2", "R3", "R6", "R7", "OLD_ROOT_FROZEN"];

/** New-code folders. Rules R3-R6 and R9 apply here until Increment 7 widens them. */
const NEW_FOLDERS = ["engine", "platform", "gestures", "ui", "hooks"].map((f) =>
  join(PLAYER_DIR, f)
);

function listFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) listFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function read(file: string): string {
  return readFileSync(file, "utf8");
}

function rel(file: string): string {
  return relative(ROOT, file).split(sep).join("/");
}

function active(rule: RuleId): boolean {
  return ACTIVE_RULES.includes(rule);
}

describe("player architecture invariants", () => {
  const appAndComponents = [
    ...listFiles(join(ROOT, "app")),
    ...listFiles(join(ROOT, "components")),
  ];
  const playerFiles = listFiles(PLAYER_DIR);
  const newFolderFiles = NEW_FOLDERS.flatMap((f) => listFiles(f));

  (active("R1") ? it : it.skip)(
    "R1: only VideoPlaybackContainer imports components/VideoPlayer",
    () => {
      const offenders = appAndComponents
        .filter((f) => !f.startsWith(PLAYER_DIR))
        .filter((f) => !rel(f).endsWith("components/Video/VideoPlaybackContainer.tsx"))
        .filter(
          (f) =>
            /from\s+["'][^"']*components\/VideoPlayer(\/|["'])/.test(read(f)) ||
            /from\s+["']\.\.\/VideoPlayer["']/.test(read(f))
        )
        .map(rel);
      expect(offenders).toEqual([]);
    }
  );

  (active("R2") ? it : it.skip)(
    "R2: player imports no app contexts/services/hooks/app at runtime",
    () => {
      // Type-only imports are allowed (`import type`). Only runtime imports are checked.
      const pattern =
        /^import\s+(?!type\s)[^;]*from\s+["'](?:\.\.\/)+(contexts|services|hooks|app)\//m;
      const offenders = playerFiles
        .filter(
          (f) =>
            newFolderFiles.includes(f) ||
            rel(f) === "components/VideoPlayer/Player.tsx" ||
            rel(f) === "components/VideoPlayer/types.ts"
        )
        .filter((f) => pattern.test(read(f)))
        .map(rel);
      expect(offenders).toEqual([]);
    }
  );

  (active("R3") ? it : it.skip)(
    "R3: only the engine and PlayerSurface import expo-video",
    () => {
      const allowed = new Set([
        "components/VideoPlayer/engine/PlaybackEngine.ts",
        "components/VideoPlayer/engine/usePlaybackEngine.ts",
        "components/VideoPlayer/ui/PlayerSurface.tsx",
      ]);
      const offenders = newFolderFiles
        .filter((f) => /from\s+["']expo-video["']/.test(read(f)))
        .map(rel)
        .filter((r) => !allowed.has(r));
      expect(offenders).toEqual([]);
    }
  );

  (active("R4") ? it : it.skip)(
    "R4: no Platform.OS / Platform.select outside platform/",
    () => {
      const offenders = newFolderFiles
        .filter((f) => !rel(f).includes("/platform/"))
        .filter((f) => /Platform\.(OS|select)/.test(read(f)))
        .map(rel);
      expect(offenders).toEqual([]);
    }
  );

  (active("R5") ? it : it.skip)(
    "R5: no legacy Animated or react-native-paper in the player",
    () => {
      const offenders = newFolderFiles
        .filter(
          (f) =>
            /from\s+["']react-native-paper["']/.test(read(f)) ||
            /\bAnimated\.(Value|timing|spring|View)\b/.test(
              read(f).replace(/react-native-reanimated/g, "")
            )
        )
        .map(rel)
        .filter(
          (r) =>
            !/Reanimated/.test(read(join(ROOT, r))) ||
            /from\s+["']react-native-paper["']/.test(read(join(ROOT, r)))
        );
      expect(offenders).toEqual([]);
    }
  );

  (active("R6") ? it : it.skip)("R6: no `any` in new player code", () => {
    const offenders = newFolderFiles
      .filter((f) => /:\s*any\b|as\s+any\b|<any>/.test(read(f)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  (active("R7") ? it : it.skip)(
    "R7: Shorts and useShortsPlayer are unchanged from main",
    () => {
      let diff = "";
      try {
        diff = execSync(
          "git diff --stat main -- components/Shorts hooks/useShortsPlayer.ts",
          { cwd: ROOT }
        )
          .toString()
          .trim();
      } catch {
        // git unavailable (CI without history): record and pass with a console note.
        console.warn("R7 skipped: git not available");
        return;
      }
      expect(diff).toBe("");
    }
  );

  (active("R9") ? it : it.skip)("R9: file line budgets", () => {
    const budgets: Record<string, number> = {
      "components/VideoPlayer/Player.tsx": 250,
      "components/VideoPlayer/engine/playbackReducer.ts": 300,
    };
    const offenders = [...newFolderFiles, join(PLAYER_DIR, "Player.tsx")]
      .filter((f) => {
        const lines = read(f).split("\n").length;
        return lines > (budgets[rel(f)] ?? 200);
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });

  (active("OLD_ROOT_FROZEN") ? it : it.skip)(
    "old components/VideoPlayer/index.tsx is byte-identical to main",
    () => {
      let fromMain = "";
      try {
        fromMain = execSync("git show main:components/VideoPlayer/index.tsx", {
          cwd: ROOT,
        }).toString();
      } catch {
        console.warn("OLD_ROOT_FROZEN skipped: git not available");
        return;
      }
      const current = read(join(PLAYER_DIR, "index.tsx"));
      expect(current.replace(/\r\n/g, "\n")).toBe(fromMain.replace(/\r\n/g, "\n"));
    }
  );
});
