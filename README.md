# Loopuff

[简体中文](README.zh.md) · [繁體中文](README.zh-Hant.md) · [English](README.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [Tiếng Việt](README.vi.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [العربية](README.ar.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

A game for learning programming with Tolang.

Read code, predict its result, change it, and solve new problems without a template.

[shixilin.com/games/loopuff](https://shixilin.com/games/loopuff/en/)

[The Vault Run](https://shixilin.com/games/loopuff/en/play/vault/) adds three connected puzzles. Use numeric output to release locks, try variables and send signals in order. Fresh clues, saved drafts and three collectible stamps support another run.

[Starport Dispatch](https://shixilin.com/games/loopuff/en/play/dispatch/): Route cargo with conditions, loops, functions and cooperating messages. New rounds bring new dispatch data.

[Bank infiltration](https://shixilin.com/games/loopuff/en/play/heist/): Write a strategy that reads the patrol and brings the case out. Every decision changes a continuous run.

## Current code

Thirteen missions cover programming foundations, Tolang conditions, loops, functions and replies, then messages and joint receives. Each mission includes prediction, explanation, modification and an independent task; the original four also retain their flight exercises. The course and interface support 12 languages, in the same order as shixilin.com. Programs run locally in a bounded teaching interpreter, not the full Tolang compiler or TVM. Independent tasks check actual output and the requested concepts that contribute to it; typing speed does not affect grades.

The playground includes a programmable pixel handheld with falling blocks, tank defence and a vertical shooter. Run `choose(1); start();` to select and start a cartridge; `pause()` and `finish()` control its lifecycle. The main console sends ordered commands. Automatic strategies alone receive a fresh game-state snapshot every 250 ms. These functions belong to the handheld host, rather than the Tolang standard library. The three new games keep their current round in this page session; course progress and existing game saves retain their established storage.

Independent challenges include a 100-point code assessment with execution, output and requirement feedback. Revise and resubmit; typing speed and matching an example do not affect the grade.

The fourth mission turns program output into a plane’s flight distance. Run a program, watch where the plane lands, then change the calculation.

## Development

```sh
npm test
npm run build
npm run dev
```

Check formatting changes with `git diff --check`. There is no separate lint task.

Optional accounts use an isolated Better Auth service on the owner's Mac mini. Games and learning progress remain local to the browser. See the [deployment and reuse plan](docs/mac-mini-account.md) for setup, validation and current limits.

## Language rules

The interface, lessons, questions, hints and errors use the selected language. Chinese names are 环灵 and 環靈; all other languages use Loopuff. Code identifiers and punctuation stay unchanged. Arabic text uses right-to-left layout, while code remains left-to-right.

## License

[PolyForm Noncommercial 1.0.0](LICENSE)

PolyForm Noncommercial 1.0.0. Commercial use requires separate written permission.

Created by Shixi Lin.
