<script lang="ts">
  import { app } from '../lib/store.svelte';
  import { saveJsonFile } from '../lib/download';
  import sampleCsv from '../assets/sample_ladder.csv?raw';

  const DATA_FILE_NAME = 'after_tax_TIPS_data.json';

  let message = $state('');
  let isError = $state(false);

  function report(text: string) {
    message = text;
    isError = text.startsWith('Error');
  }

  async function saveData() {
    try {
      if (await saveJsonFile(app.exportJson(), DATA_FILE_NAME)) report('File saved');
    } catch (e) {
      console.error(e);
      report('Error: file save failed');
    }
  }

  /** Read the chosen file if its extension or MIME type matches */
  async function readChosenFile(e: Event, ext: string, mime: string[]): Promise<string | null> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return null;
    if (!file.name.toLowerCase().endsWith(ext) && !mime.some((m) => file.type.startsWith(m))) {
      report(`Error: please choose a ${ext} file`);
      return null;
    }
    try {
      return await file.text();
    } catch (err) {
      console.error(err);
      report('Error: could not read file');
      return null;
    }
  }

  async function loadJson(e: Event) {
    const text = await readChosenFile(e, '.json', ['application/json']);
    if (text !== null) report(app.importJson(text));
  }

  async function loadCsv(e: Event) {
    const text = await readChosenFile(e, '.csv', ['text/csv']);
    if (text !== null) report(app.importCsv(text));
  }

  function loadSample() {
    report(app.importCsv(sampleCsv, 'Sample ladder load'));
  }

  function clearData() {
    if (!confirm('Restore default parameters and clear all owned TIPS?')) return;
    app.resetAll();
    report('All data cleared');
  }
</script>

{#snippet action(description: string)}
  <p style="margin: 0; color: var(--text-secondary);">{description}</p>
{/snippet}

<div class="card">
  <div class="flex justify-between items-center mb-4">
    <h1 style="margin-top: 0.25rem;">Save/Load Data</h1>
  </div>
  <div class="actions">
    <div class="action-row">
      <div class="action-btn">
        <button type="button" class="btn btn-secondary btn-sm" onclick={saveData}>Save Data to JSON File</button>
      </div>
      {@render action('Save current parameters and owned TIPS data to a local JSON file.')}
    </div>
    <div class="action-row">
      <div class="action-btn">
        <label class="btn btn-secondary btn-sm">
          Load Saved JSON Data
          <input type="file" accept=".json,application/json" style="display:none;" onchange={loadJson} />
        </label>
      </div>
      {@render action('Load parameters and owned TIPS data from a JSON file you saved.')}
    </div>
    <div class="action-row">
      <div class="action-btn">
        <label class="btn btn-secondary btn-sm">
          Load External or Prior CSV
          <input type="file" accept=".csv,text/csv" style="display:none;" onchange={loadCsv} />
        </label>
      </div>
      {@render action("Load owned TIPS data from another app's CSV file or prior version of this App.")}
    </div>
    <div class="action-row">
      <div class="action-btn">
        <button type="button" class="btn btn-secondary btn-sm" onclick={loadSample}>Sample Ladder</button>
      </div>
      {@render action('Load a test ladder of owned TIPS.')}
    </div>
    <div class="action-row">
      <div class="action-btn">
        <button type="button" class="btn btn-secondary btn-sm" style="color: var(--danger);" onclick={clearData}>
          Clear All Data
        </button>
      </div>
      {@render action('Restore default parameters and clear owned TIPS data.')}
    </div>
  </div>
</div>

<p role="status" style="color: {isError ? 'var(--danger)' : 'var(--text-primary)'}">{message}</p>

<style>
  .actions {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 100%;
  }
  .action-row {
    display: flex;
    align-items: center;
    gap: 2rem;
    width: 100%;
  }
  .action-btn {
    width: 250px;
    flex-shrink: 0;
  }
  .action-btn :global(.btn) {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    margin: 0;
    padding: 0.5rem 1rem;
    cursor: pointer;
  }
</style>
