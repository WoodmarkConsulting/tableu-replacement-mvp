Erstelle einen neuen Custom Agent unter `.github/agents/`, der einen Benutzer Schritt für Schritt durch die Erstellung eines neuen Dashboards führt.

Bevor du den Agent erstellst:

1. Lies die `AGENTS.md` im Repository-Root.
2. Lies die `agentProcess.md` vollständig.
3. Prüfe bestehende Agents unter `.github/agents/`, damit sich der neue Agent in die vorhandene Struktur und das bestehende Berechtigungskonzept einfügt.
4. Prüfe die tatsächlich vorhandenen npm-Scripts und relevanten Dateien im Repository. Übernimm keine Befehle oder Pfade ungeprüft aus der Dokumentation.

## Aufgabe des Agents

Der Agent soll den in `agentProcess.md` beschriebenen Dashboard-Creation-Flow mit dem Benutzer durchführen.

`agentProcess.md` ist dabei die maßgebliche Beschreibung des Ablaufs. Der Agent darf den dort definierten Prozess nicht eigenständig vereinfachen, überspringen oder neu strukturieren.

Der Agent soll insbesondere:

- den Benutzer Schritt für Schritt führen
- immer nur die Informationen abfragen, die für den aktuellen Schritt benötigt werden
- zuerst die grobe Dashboard-Struktur bestimmen
- anschließend jede Visualisierung vollständig abschließen, bevor die nächste begonnen wird
- vorhandene Module anhand ihrer Dokumentation auswählen
- für jede Visualisierung eine `chartID` über das vorhandene npm-Script erzeugen
- die benötigten Databricks-Tabellen vom Benutzer erfragen
- deren Schemas über das vorhandene npm-Script abrufen
- die Schema-Dateien lesen
- die jeweilige `modules/<ModuleName>/instructions.md` lesen
- die Modul-Konfiguration gemeinsam mit dem Benutzer festlegen
- SQL passend zum tatsächlichen Tabellenschema und `chartDataSchema.ts` erzeugen
- die erzeugten Dateien an den im Repository vorgesehenen Stellen speichern
- am Ende die Dashboard-Konfiguration und Registrierung gemäß `agentProcess.md` erstellen
- die vorhandenen Validatoren und Generatoren verwenden, wenn dies im Ablauf vorgesehen ist

## Kommunikation mit dem Benutzer

Der Agent richtet sich ausdrücklich auch an Benutzer ohne technische Kenntnisse.

Deshalb:

- Verwende einfache und kurze Sprache.
- Vermeide Fachbegriffe, wenn sie für die Entscheidung des Benutzers nicht notwendig sind.
- Zeige keine internen TypeScript-Property-Namen, wenn die gleiche Frage verständlicher formuliert werden kann.
- Erkläre Auswahlmöglichkeiten anhand ihrer sichtbaren Wirkung.
- Stelle möglichst nur eine zusammenhängende Entscheidung auf einmal.
- Frage nicht alle Dashboard-Informationen in einer einzigen Nachricht ab.
- Wenn mehrere feste Auswahlmöglichkeiten existieren, stelle sie als klare Auswahl dar.
- Falls VS Code für den Agent-Chat eine geeignete interaktive Auswahlmöglichkeit unterstützt, nutze diese. Andernfalls verwende eine kurze nummerierte Auswahl.
- Freitext soll nur verlangt werden, wenn keine sinnvolle feste Auswahl möglich ist.

Beispiel:

Nicht:

`Welchen curve-Wert möchtest du: linear, monotone oder step?`

Sondern:

`Wie soll die Linie aussehen?`

1. Gerade
2. Weich / geglättet
3. Stufenförmig

Der Agent übersetzt die Auswahl anschließend selbst in den technischen Config-Wert.

## Modulnutzung

Der Benutzer muss keine Modulnamen kennen.

Der Agent soll anhand des gewünschten Ergebnisses und `modules/instructions.md` ein geeignetes Modul auswählen oder wenige geeignete Optionen erklären.

Nach Auswahl eines Moduls muss der Agent dessen `instructions.md`, `chartType.d.ts` und `chartDataSchema.ts` entsprechend dem in `agentProcess.md` festgelegten Zeitpunkt verwenden.

Der Agent darf bei normaler Dashboard-Erstellung keine Modulimplementierungen verändern.

Wenn kein vorhandenes Modul die gewünschte Visualisierung unterstützt, soll der Agent dies dem Benutzer verständlich mitteilen und nicht eigenständig ein bestehendes Modul umbauen.

## Sicherheit und Rechte

Berücksichtige das bestehende Hook- und Berechtigungskonzept des Repositories.

Der neue Agent soll nur die Rechte und Tools erhalten, die er für den Dashboard-Creation-Flow tatsächlich benötigt.

Er soll insbesondere nicht unnötig allgemeine Entwicklungsrechte erhalten, wenn diese für den beschriebenen Workflow nicht erforderlich sind.

Falls für bestimmte Schritte Shell-Ausführung oder Dateischreibzugriffe notwendig sind, konfiguriere diese gezielt entsprechend dem bestehenden Berechtigungssystem.

Ändere das bestehende Berechtigungssystem nicht, außer dies ist zwingend notwendig. Falls eine Änderung notwendig erscheint, erkläre sie zuerst, statt sie ungefragt umzubauen.

## Ergebnis

Erstelle die vollständige `Dashboard.agent.md`-Datei für diesen Agent.

Wähle einen eindeutigen und verständlichen Namen, der erkennen lässt, dass dieser Agent für die geführte Erstellung von Dashboards gedacht ist.

Halte die Agent-Instructions selbst kompakt. Dupliziere nicht die komplette `agentProcess.md` in der Agent-Datei. Der Agent soll stattdessen ausdrücklich angewiesen werden, `agentProcess.md` als Workflow-Quelle zu verwenden.

Wenn einzelne wiederverwendbare Teilaufgaben sinnvoll als Skills ausgelagert werden sollten, identifiziere diese. Erstelle jedoch nicht unnötig Skills für Schritte, die direkt und verständlich im Agent-Workflow bleiben können.

## Änderungen während des Ablaufs

Der Benutzer darf frühere Entscheidungen jederzeit ändern, solange die aktuelle Visualisierung noch nicht abgeschlossen wurde.

Behandle die aktuelle Visualisierung bis zur finalen Bestätigung als Entwurf.

Wenn der Benutzer eine frühere Entscheidung ändert:

1. Ändere nur die betroffenen Werte.
2. Prüfe, welche späteren Schritte davon abhängen.
3. Wiederhole nur diese abhängigen Schritte.
4. Behalte alle unabhängigen Entscheidungen unverändert.
5. Starte den kompletten Visualisierungs-Workflow nur dann neu, wenn die Änderung das bisherige Modul oder Datenmodell grundsätzlich ungültig macht.

Beispiele:

- Änderung der Linienform → nur `chartConfig` anpassen und erneut validieren.
- Änderung eines Filters → `filterConfig` und gegebenenfalls SQL anpassen.
- Änderung der Gruppierung oder Datenbasis → SQL und eventuell `chartConfig` neu erzeugen.
- Wechsel des Moduls → Modul-Konfiguration und SQL neu prüfen, da sich der Datenvertrag ändern kann.

Bevor der Agent mit der nächsten Visualisierung fortfährt, soll er die aktuelle Visualisierung kurz zusammenfassen und den Benutzer fragen, ob sie so abgeschlossen werden kann oder noch Änderungen gewünscht sind.
