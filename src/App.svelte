<script lang="ts">
  import { onMount } from 'svelte';
  import { marked } from 'marked';
  import { app } from './lib/store.svelte';
  import Modal from './components/Modal.svelte';
  import MakeLadder from './routes/MakeLadder.svelte';
  import Specs from './routes/Specs.svelte';
  import LadderDisplay from './routes/LadderDisplay.svelte';
  import OutstandingTips from './routes/OutstandingTips.svelte';
  import SaveLoad from './routes/SaveLoad.svelte';
  import howTo from './assets/how-to.md?raw';

  const routes = {
    '/make_ladder': { component: MakeLadder, title: 'Build Your Ladder' },
    '/specs': { component: Specs, title: 'Ladder Parameters' },
    '/ladder_display': { component: LadderDisplay, title: 'Ladder Results' },
    '/tips': { component: OutstandingTips, title: 'Outstanding TIPS' },
    '/save_load': { component: SaveLoad, title: 'Save and Load Data' },
  } as const;
  type Path = keyof typeof routes;
  const DEFAULT: Path = '/make_ladder';

  function currentPath(): Path {
    const p = window.location.hash.replace(/^#/, '');
    return p in routes ? (p as Path) : DEFAULT;
  }

  let path = $state<Path>(currentPath());
  let howToOpen = $state(false);
  const howToHtml = marked.parse(howTo, { async: false });

  const route = $derived(routes[path]);
  const Page = $derived(route.component);

  $effect(() => {
    document.title = `${route.title} | TIPS Ladder`;
  });

  onMount(() => {
    app.loadMarket();
    const onHash = () => {
      path = currentPath();
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });
</script>

<nav class="navbar">
  <a href="https://aerokam.github.io/Treasuries/" class="portal-link">&#8592;Portal</a>
  <div class="nav-container">
    <img src="{import.meta.env.BASE_URL}favicon.png" alt="Logo" style="max-height: 35px; max-width: 35px;" />
    <a href="#/make_ladder" class="nav-brand">After-Tax TIPS Ladder Calculator</a>
    <div class="nav-links">
      <a href="#/specs" class="nav-link">Ladder Parameters</a>
      <a href="#/make_ladder" class="nav-link">Build Your Ladder</a>
      <a href="#/ladder_display" class="nav-link">Display Results</a>
      <a href="#/tips" class="nav-link">Outstanding TIPS</a>
      <a href="#/save_load" class="nav-link">Save/Load Data</a>
    </div>
  </div>
</nav>

<main class="main-content">
  {#if app.marketError}
    <div class="notice notice-error">
      <strong>Error:</strong> could not load TIPS/CPI data ({app.marketError}).
    </div>
  {:else if !app.market}
    <div class="card"><p class="text-center text-secondary">Loading TIPS data...</p></div>
  {:else}
    {#if app.market.warning}
      <div class="notice notice-warning">{app.market.warning}</div>
    {/if}
    {#key path}
      <Page />
    {/key}
  {/if}
</main>

<footer class="footer">
  <a href="#how-to" class="how-to-link" onclick={(e) => { e.preventDefault(); howToOpen = true; }}>
    How to Use this App
  </a>
  <p>&copy; 2026 After-Tax TIPS Ladder Web App v3.0</p>
</footer>

<Modal bind:open={howToOpen}>
  <div class="markdown-body">{@html howToHtml}</div>
</Modal>
