<script lang="ts">
  let { onclick }: { onclick: () => void } = $props();
</script>

<button type="button" class="help-icon" aria-label="Help" {onclick}>?</button>
