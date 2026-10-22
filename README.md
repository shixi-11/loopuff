# Loopuff

[English](README.md) · [简体中文](README.zh.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [العربية](README.ar.md)

A game for learning programming with Tolang.

Read code, predict its result, change it, and solve new problems without a template.

[shixilin.com/games/loopuff](https://shixilin.com/games/loopuff/en/)

## Current code

The first chapter is playable: four missions covering values, addition and name bindings, with predictions, explanations, modifications and independent programming. The interface and course support 11 languages. Programs run locally in a small teaching interpreter without a backend or third-party packages. This is not the full Tolang compiler or TVM; later chapters are in development.

Independent challenges include a 100-point code assessment with execution, output and requirement feedback. Revise and resubmit; typing speed and matching an example do not affect the grade.

The fourth mission turns program output into a robot’s jump distance. Run a program, watch where the robot lands, then change the calculation.

## Development

```sh
npm test
npm run build
npm run dev
```

## Language rules

The interface, lessons, questions, hints and errors use the selected language. Chinese names are 环灵 and 環靈; all other languages use Loopuff. Code identifiers and punctuation stay unchanged. Arabic text uses right-to-left layout, while code remains left-to-right.

## License

[PolyForm Noncommercial 1.0.0](LICENSE)

PolyForm Noncommercial 1.0.0. Commercial use requires separate written permission.

Created by Shixi Lin.
