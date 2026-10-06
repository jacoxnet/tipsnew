<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    open = $bindable(false),
    small = false,
    contentStyle = '',
    onclose,
    children,
  }: { open?: boolean; small?: boolean; contentStyle?: string; onclose?: () => void; children: Snippet } = $props();

  function close() {
    open = false;
    onclose?.();
  }

  function onKeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') close();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="modal" class:open onclick={(e) => e.target === e.currentTarget && close()}>
  <div class="modal-content" class:modal-content-sm={small} style={contentStyle} role="dialog" aria-modal="true">
    <button type="button" class="close-modal" aria-label="Close" onclick={close}>&times;</button>
    {@render children()}
  </div>
</div>

<style>
  .close-modal {
    background: none;
    border: none;
    padding: 0;
    line-height: 1;
  }
</style>
