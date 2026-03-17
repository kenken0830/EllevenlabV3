# note2voice

Japanese note-to-voice prompt pipeline with a Web UI and CLI.

This project generates these artifacts in order:

1. `brief`
2. `spoken_script`
3. `eleven_v3_prompt`
4. `qa_report`

The pipeline is stage-separated and does not allow one-shot conversion from note directly to final prompt.

## Requirements

- Node.js 20 or newer
- npm
- For real mode: `OPENAI_API_KEY`

## Setup

Install dependencies:

```bash
npm install
```

Create `/.env.local`:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.4
HOST=127.0.0.1
PORT=4173
```

`OPENAI_API_KEY` is used only on the server side. Do not expose it in browser code.

## Run The Web UI

Start the app:

```bash
npm run web
```

Open:

- [http://127.0.0.1:4173](http://127.0.0.1:4173)

You can use:

- sample notes
- pasted note content
- `mock` mode
- `real` mode

Generated artifacts are saved under `artifacts/<run-name>/`.

## Run From CLI

Build once:

```bash
npm run build
```

Generate artifacts:

```bash
node dist/src/cli.js generate --input samples/note-01.md --output artifacts/sample-01
```

## Use From A Tablet

To open the Web UI from a tablet on the same local network, bind the server to all interfaces.

Update `/.env.local`:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.4
HOST=0.0.0.0
PORT=4173
```

Start the app:

```bash
npm run web
```

Find the PC's local IP address:

```powershell
ipconfig
```

Look for an address like `192.168.x.x`.

Open this URL from the tablet browser:

```text
http://192.168.x.x:4173
```

## Tablet Notes

- The PC and tablet must be on the same Wi-Fi or LAN.
- The server keeps running on the PC. The tablet is only a client.
- If the tablet cannot connect, check Windows Firewall for port `4173`.
- `OPENAI_API_KEY` stays on the PC and is not sent to the tablet UI.

## Validation

Run:

```bash
npm run build
npm run typecheck
npm run lint
npm test
```

## Important Files

- Repo rules: [AGENTS.md](/D:/Cursor/GouseiShoshi/AGENTS.md)
- Handoff summary: [HANDOFF.md](/D:/Cursor/GouseiShoshi/HANDOFF.md)
- Brief few-shot reference: [brief-body-examples.md](/D:/Cursor/GouseiShoshi/.agents/skills/eleven-v3-ja-pipeline/references/brief-body-examples.md)
