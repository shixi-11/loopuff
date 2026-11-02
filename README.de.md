# Loopuff

[English](README.md) · [简体中文](README.zh.md) · [繁體中文](README.zh-Hant.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [العربية](README.ar.md)

Programmieren und Tolang spielerisch lernen.

Code lesen, Ergebnisse vorhersagen, Programme ändern und neue Aufgaben ohne Vorlage lösen.

[shixilin.com/games/loopuff](https://shixilin.com/games/loopuff/de/)

[Die Tresormission](https://shixilin.com/games/loopuff/de/play/vault/) bietet drei verbundene Rätsel. Öffne Schlösser mit Rechenergebnissen, nutze Namen und sende Signale in der richtigen Reihenfolge. Neue Hinweise, gespeicherter Code und drei Stempel ermöglichen weitere Versuche.

[Raumhafen-Disposition](https://shixilin.com/games/loopuff/de/play/dispatch/): Leite Fracht mit Bedingungen, Schleifen, Funktionen und zusammenarbeitenden Nachrichten. Neue Runden bringen neue Dispositionsdaten.

## Aktueller Code

Dreizehn Missionen behandeln die Grundlagen der Programmierung sowie Bedingungen, Schleifen, Funktionen und Antworten in Tolang, anschließend Nachrichten und den kombinierten Empfang mehrerer Nachrichten. Jede Mission umfasst Vorhersagen, Erklärungen, Änderungen am Code und eine eigenständig zu lösende Aufgabe; die ursprünglichen vier enthalten weiterhin ihre Flugübungen. Kurs und Benutzeroberfläche unterstützen 11 Sprachen. Programme laufen lokal in einem Lehrinterpreter mit begrenztem Funktionsumfang und festgelegten Ausführungsgrenzen, nicht im vollständigen Tolang-Compiler oder in der TVM. Bei eigenständigen Aufgaben werden die tatsächliche Ausgabe und der Einsatz der geforderten Konzepte geprüft, die zu dieser Ausgabe beitragen; die Tippgeschwindigkeit hat keinen Einfluss auf die Bewertung.

Eigenständige Aufgaben werden mit bis zu 100 Punkten für Ausführung, Ausgabe und Aufgabenbedingungen bewertet. Überarbeiten und erneut einreichen ist möglich; Tipptempo und Übereinstimmung mit dem Beispiel zählen nicht.

In der vierten Mission bestimmt die Programmausgabe die Sprungweite eines Fliegers. Führe den Code aus, beobachte die Landung und ändere die Rechnung, um die schwebende Insel zu erreichen.

## Entwicklung

```sh
npm test
npm run build
npm run dev
```

## Sprachregeln

Oberfläche, Lektionen, Fragen, Hinweise und Fehler erscheinen in der gewählten Sprache. Die chinesischen Namen sind 环灵 und 環靈; alle anderen Sprachen verwenden Loopuff. Bezeichner und Zeichen im Code werden nicht übersetzt. Arabischer Text läuft von rechts nach links, Code weiterhin von links nach rechts.

## Lizenz

[PolyForm Noncommercial 1.0.0](LICENSE)

PolyForm Noncommercial 1.0.0. Eine kommerzielle Nutzung erfordert eine gesonderte schriftliche Genehmigung.

Entwickelt von Shixi Lin.
