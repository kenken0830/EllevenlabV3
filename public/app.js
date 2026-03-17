const EMPTY_PROMPT_MESSAGE = "まだ prompt は生成されていません。";

const state = {
  currentTab: "sourceNote",
  result: null,
  samples: [],
  health: null,
};

const artifactTabs = [
  { key: "sourceNote", label: "00-source-note.json" },
  { key: "brief", label: "01-brief.json" },
  { key: "spokenScript", label: "02-spoken-script.json" },
  { key: "elevenV3Prompt", label: "03-eleven-v3-prompt.json" },
  { key: "qaReport", label: "04-qa-report.json" },
  { key: "manifest", label: "manifest.json" },
];

const refs = {
  sampleStrip: document.getElementById("sample-strip"),
  runName: document.getElementById("run-name"),
  executionMode: document.getElementById("execution-mode"),
  stageMode: document.getElementById("stage-mode"),
  stageValueField: document.getElementById("stage-value-field"),
  stageValue: document.getElementById("stage-value"),
  noteInput: document.getElementById("note-input"),
  charCount: document.getElementById("char-count"),
  generateButton: document.getElementById("generate-button"),
  copyPromptButton: document.getElementById("copy-prompt-button"),
  statusPill: document.getElementById("status-pill"),
  resultPath: document.getElementById("result-path"),
  modeNote: document.getElementById("mode-note"),
  errorBox: document.getElementById("error-box"),
  resultSummary: document.getElementById("result-summary"),
  promptMeta: document.getElementById("prompt-meta"),
  promptOutput: document.getElementById("prompt-output"),
  viewerTabs: document.getElementById("viewer-tabs"),
  jsonViewer: document.getElementById("json-viewer"),
};

function setStatus(kind, label) {
  refs.statusPill.className = `status-pill ${kind}`;
  refs.statusPill.textContent = label;
}

function updateCharCount() {
  refs.charCount.textContent = `${refs.noteInput.value.length} chars`;
}

function getStagePayload() {
  const stageMode = refs.stageMode.value;

  if (stageMode === "all") {
    return {
      stageMode,
      stageValue: undefined,
    };
  }

  return {
    stageMode,
    stageValue: refs.stageValue.value,
  };
}

function clearError() {
  refs.errorBox.hidden = true;
  refs.errorBox.textContent = "";
}

function showError(message) {
  refs.errorBox.hidden = false;
  refs.errorBox.textContent = message;
}

function renderSamples() {
  refs.sampleStrip.innerHTML = "";

  for (const sample of state.samples) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sample-chip";
    button.innerHTML = `
      <span>
        <strong>${sample.title}</strong>
        <span>${sample.id}</span>
      </span>
      <span>読み込む</span>
    `;
    button.addEventListener("click", () => {
      refs.noteInput.value = sample.content;
      refs.runName.value = sample.id;
      updateCharCount();
      setStatus("idle", `Loaded ${sample.id}`);
    });
    refs.sampleStrip.append(button);
  }
}

function getAvailableTabs() {
  if (!state.result) {
    return [];
  }

  return artifactTabs.filter((tab) => state.result.artifacts[tab.key]);
}

function getAverageScore(scores) {
  const values = Object.values(scores).map((entry) => entry.score);

  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce((total, value) => total + value, 0) / values.length
  ).toFixed(1);
}

function renderModeNote() {
  const realConfigured = Boolean(state.health?.openaiConfigured);

  if (refs.executionMode.value === "real") {
    refs.modeNote.textContent = realConfigured
      ? "real mode は server 側で OpenAI API を呼びます。API key は browser に出しません。"
      : "real mode は選べますが、現在 server に OPENAI_API_KEY が見つかっていません。";
    return;
  }

  refs.modeNote.textContent =
    "mock mode は保存形式と段構造を固定したまま、実 API を呼ばずに 4 段を検証します。";
}

function renderPrompt(result) {
  const prompt = result?.artifacts?.elevenV3Prompt?.final_prompt;

  if (!prompt) {
    refs.promptOutput.value = EMPTY_PROMPT_MESSAGE;
    refs.promptMeta.innerHTML =
      "ここには <code>03-eleven-v3-prompt.json</code> の <code>final_prompt</code> が表示されます。";
    refs.copyPromptButton.disabled = true;
    refs.copyPromptButton.textContent = "Copy prompt";
    return;
  }

  refs.promptOutput.value = prompt;
  refs.promptMeta.innerHTML =
    "表示中の文字列が、そのまま <code>03-eleven-v3-prompt.json</code> の <code>final_prompt</code> です。";
  refs.copyPromptButton.disabled = false;
  refs.copyPromptButton.textContent = "Copy prompt";
}

function renderSummary(result) {
  const { artifacts, outputDir, inputFile, writtenStages } = result;
  refs.resultPath.textContent = outputDir;

  const qaPreview = artifacts.qaReport
    ? `<article class="summary-card">
        <h3>QA</h3>
        <p><strong>overall_pass:</strong> ${artifacts.qaReport.overall_pass}</p>
        <p><strong>average score:</strong> ${getAverageScore(artifacts.qaReport.scores)}</p>
      </article>`
    : "";
  const promptLocation = artifacts.elevenV3Prompt
    ? `<article class="summary-card">
        <h3>Prompt location</h3>
        <p><strong>top panel:</strong> Eleven v3 final prompt</p>
        <p><strong>json tab:</strong> 03-eleven-v3-prompt.json</p>
      </article>`
    : "";

  refs.resultSummary.innerHTML = `
    <div class="summary-grid">
      <article class="summary-card">
        <h3>Generated now</h3>
        <ul>
          <li><strong>input-note.md</strong>: 保存済み</li>
          <li><strong>00-source-note.json</strong>: 保存済み</li>
          <li><strong>manifest.json</strong>: 保存済み</li>
          <li><strong>mode:</strong> ${artifacts.manifest.execution_mode}</li>
          ${writtenStages.map((stage) => `<li><strong>${stage}</strong>: generated</li>`).join("")}
        </ul>
      </article>
      <article class="summary-card">
        <h3>Source note</h3>
        <p><strong>ID:</strong> ${artifacts.sourceNote.id}</p>
        <p><strong>Title:</strong> ${artifacts.sourceNote.title}</p>
        <p><strong>Saved input:</strong> ${inputFile}</p>
      </article>
      ${qaPreview}
      ${promptLocation}
    </div>
  `;
}

function renderViewerTabs() {
  const tabs = getAvailableTabs();

  if (tabs.length === 0) {
    refs.viewerTabs.hidden = true;
    refs.viewerTabs.innerHTML = "";
    return;
  }

  refs.viewerTabs.hidden = false;
  refs.viewerTabs.innerHTML = tabs
    .map((tab) => {
      const activeClass = tab.key === state.currentTab ? " active" : "";
      return `<button class="tab-button${activeClass}" data-tab="${tab.key}" type="button">${tab.label}</button>`;
    })
    .join("");
}

function renderJsonView() {
  if (!state.result) {
    refs.jsonViewer.textContent = "まだ生成されていません。";
    refs.viewerTabs.hidden = true;
    renderPrompt(null);
    return;
  }

  const payload = state.result.artifacts[state.currentTab];
  refs.jsonViewer.textContent = JSON.stringify(payload, null, 2);
  renderViewerTabs();
  renderPrompt(state.result);
}

async function loadHealth() {
  const response = await fetch("/api/health");
  const payload = await response.json();
  state.health = payload;
  renderModeNote();
}

async function loadSamples() {
  const response = await fetch("/api/samples");
  const payload = await response.json();

  if (!payload.ok) {
    throw new Error(payload.error || "Failed to load samples.");
  }

  state.samples = payload.data;
  renderSamples();

  if (state.samples[0]) {
    refs.noteInput.value = state.samples[0].content;
    refs.runName.value = state.samples[0].id;
    updateCharCount();
  }
}

async function generateArtifacts() {
  const noteContent = refs.noteInput.value.trim();

  if (!noteContent) {
    setStatus("error", "Note is empty");
    showError("note が空です。");
    return;
  }

  refs.generateButton.disabled = true;
  clearError();
  setStatus("loading", "Generating pipeline");

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        noteContent,
        runName: refs.runName.value,
        mock: refs.executionMode.value === "mock",
        ...getStagePayload(),
      }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      const stageLabel = payload.stage ? `${payload.stage} / ` : "";
      const kindLabel = payload.kind ? `${payload.kind}: ` : "";
      throw new Error(
        `${stageLabel}${kindLabel}${payload.error || "Failed to generate artifacts."}`,
      );
    }

    state.result = payload.data;
    state.currentTab = payload.data.artifacts.elevenV3Prompt
      ? "elevenV3Prompt"
      : "sourceNote";
    renderSummary(payload.data);
    renderJsonView();
    refs.promptOutput.scrollTop = 0;
    setStatus("success", `${refs.executionMode.value} pipeline complete`);
  } catch (error) {
    state.result = null;
    refs.resultSummary.innerHTML = `<div class="empty-state">生成に失敗しました。manifest.json を確認してください。</div>`;
    refs.resultPath.textContent = "Generation failed";
    refs.jsonViewer.textContent = "生成に失敗しました。";
    refs.viewerTabs.hidden = true;
    renderPrompt(null);
    showError(error.message);
    setStatus("error", "Failed");
  } finally {
    refs.generateButton.disabled = false;
  }
}

refs.executionMode.addEventListener("change", renderModeNote);
refs.stageMode.addEventListener("change", () => {
  refs.stageValueField.hidden = refs.stageMode.value === "all";
});
refs.noteInput.addEventListener("input", updateCharCount);
refs.generateButton.addEventListener("click", generateArtifacts);
refs.copyPromptButton.addEventListener("click", async () => {
  const prompt = refs.promptOutput.value;

  if (!prompt || prompt === EMPTY_PROMPT_MESSAGE) {
    return;
  }

  try {
    await navigator.clipboard.writeText(prompt);
    refs.copyPromptButton.textContent = "Copied";
    window.setTimeout(() => {
      refs.copyPromptButton.textContent = "Copy prompt";
    }, 1200);
  } catch {
    refs.copyPromptButton.textContent = "Copy failed";
    window.setTimeout(() => {
      refs.copyPromptButton.textContent = "Copy prompt";
    }, 1200);
  }
});
refs.viewerTabs.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const tab = target.dataset.tab;

  if (!artifactTabs.some((entry) => entry.key === tab)) {
    return;
  }

  state.currentTab = tab;
  renderJsonView();
});

setStatus("idle", "Loading samples");
Promise.all([loadHealth(), loadSamples()])
  .then(() => {
    clearError();
    setStatus("idle", "Ready");
  })
  .catch((error) => {
    refs.resultSummary.innerHTML = `<div class="empty-state">${error.message}</div>`;
    showError(error.message);
    setStatus("error", "Load failed");
  });
updateCharCount();
renderPrompt(null);
renderModeNote();
renderJsonView();
