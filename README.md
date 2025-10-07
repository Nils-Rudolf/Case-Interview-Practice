# Case-Interview-Practice

Eine minimalistische Single-Page Web-App zum Üben von IT-Consulting Cases.

## Features

- Import von Case-Dateien im JSON-Format
- Strikte Validierung gegen Schema
- Text-to-Speech mit Web Speech API (Deutsch)
- Timer-Funktion für Bearbeitungszeit
- Klärende Fragen (max. 2 aus 4 wählbar)
- Strukturierte Lösungsdarstellung
- Lokale Speicherung der Cases

## Installation

1. `index.html` in einem Browser öffnen
2. Beispiel-Case aus `cases.example.de.json` importieren
3. Azure-Anmeldedaten werden in `env.js` hinterlegt.

## Verwendung

### Case importieren
1. Klick auf "Importieren"
2. JSON-Datei auswählen
3. Bei Validierungsfehlern werden diese angezeigt

## Schema-Anforderungen

Cases müssen dem definierten JSON-Schema entsprechen:
- Genau 4 klärende Fragen
- Maximal 2 Fragen auswählbar
- Sprache: Deutsch (`de`) oder Englisch (`en`)
- Hierarchischer Lösungsbaum (3-6 Hauptpunkte)

## Konfiguration

In `config.js` können folgende Einstellungen angepasst werden:
- `skipBehavior`: 'next' oder 'random'
- TTS-Parameter (Rate, Pitch, Volume)

