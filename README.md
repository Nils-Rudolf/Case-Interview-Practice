# Interview Case Structuring Practice

## Features

- Import von Case-Dateien im JSON-Format
- Text-to-Speech über Azure Speech SDK
- Timer-Funktion für Bearbeitungszeit
- Klärende Fragen
- Strukturierte Lösungsdarstellung

## Installation

1. `index.html` in einem Browser öffnen
2. Klick auf "Importieren" und beispiel-Case aus `cases.example.de.json` importieren
3. Azure-Anmeldedaten werden in `env.js` hinterlegt

## Schema-Anforderungen

Cases müssen dem definierten JSON-Schema entsprechen:
- 2-4 klärende Fragen
- 1-2 Fragen auswählbar wovon immer so viele korrekt sind wie max. wählbare Fragen. Die anderen Fragen sind falsch.
- Sprache: Deutsch (`de`) oder Englisch (`en`)
- Hierarchischer Lösungsbaum (3-6 Hauptpunkte)

## Konfiguration

In `config.js` können folgende Einstellungen angepasst werden:
- `skipBehavior`: 'next' oder 'random'
- TTS-Parameter (Rate, Pitch, Volume)

