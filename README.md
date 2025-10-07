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

## Verwendung

### Case importieren
1. Klick auf "Importieren"
2. JSON-Datei auswählen
3. Bei Validierungsfehlern werden diese angezeigt

## Technische Details

- Vanilla JavaScript (kein Framework)
- localStorage für persistente Case-Speicherung
- Web Speech API für TTS
- Responsive Design (optimiert für Laptop-Bildschirme)
- ARIA-Labels für Barrierefreiheit

## Browser-Kompatibilität

- Chrome/Edge: Vollständig unterstützt
- Firefox: TTS eingeschränkt
- Safari: TTS-Unterstützung variiert

## Schema-Anforderungen

Cases müssen dem definierten JSON-Schema entsprechen:
- Genau 4 klärende Fragen
- Maximal 2 Fragen auswählbar
- Sprache: Deutsch (de)
- TTS: de-DE
- Hierarchischer Lösungsbaum (3-6 Hauptpunkte)

## Konfiguration

In `config.js` können folgende Einstellungen angepasst werden:
- `skipBehavior`: 'next' oder 'random'
- TTS-Parameter (Rate, Pitch, Volume)